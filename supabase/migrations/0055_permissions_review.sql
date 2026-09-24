-- ============================================================================
-- Revisão do sistema de permissões (auditoria set/2026).
--
-- 1. Desconto acima do teto passa a ser aprovado por PERMISSÃO, não por cargo:
--    o PIN digitado precisa ser de um usuário ativo com
--    `pdv.desconto_acima_limite` (venda no PDV) ou `mesas.desconto_acima_limite`
--    (fechamento de comanda) — ou admin. Antes era qualquer admin/gerente
--    (validate_manager_pin) e as duas chaves do catálogo não faziam nada.
--    O nome de quem aprovou vai para orders.discount_authorized_by.
--    validate_manager_pin continua existindo para cortesia e estorno de venda.
--
-- 2. Gerência de usuários deixa de ser exclusiva do admin: quem tem
--    usuarios.editar_permissoes / usuarios.ativar_inativar / usuarios.definir_pin
--    pode editar outros usuários, com travas contra escalada de privilégio:
--      - ninguém não-admin altera o próprio cargo/status/PIN/permissões;
--      - não-admin não cria, promove nem edita usuário admin;
--      - não-admin só concede permissões que ele mesmo possui.
--    (a criação de usuário segue a mesma regra na Edge Function admin-create-user)
--
-- 3. company_profile: UPDATE era liberado para qualquer funcionário logado
--    (migration 0018). Agora cada grupo de colunas exige a permissão da tela:
--    perfil, mídia, preços do buffet, regras de caixa (nova) e dados fiscais.
--
-- 4. tax_groups: escrita era liberada para qualquer funcionário logado
--    (migration 0049). Agora exige fiscal.grupos_tributarios (nova).
--
-- 5. Chaves renomeadas/novas no catálogo (src/lib/permissions.ts):
--      vendas.emitir_nfce      -> fiscal.emitir_nfce
--      vendas.estornar_pagbank -> fiscal.estornar_pagbank
--      + fiscal.grupos_tributarios, + empresa.editar_regras_caixa
--    Backfill para ninguém perder acesso no deploy + limpeza de chaves que não
--    existem mais no catálogo (ex.: online_menu.finalizar_pedido).
--
-- Seguro de aplicar com o caixa aberto: create_order_and_credit_cash mantém a
-- mesma assinatura e só muda o bloco de autorização do desconto.
-- DEPLOY CONJUNTO com o frontend e com as Edge Functions emit-nfce,
-- pagbank-cancel e admin-create-user (as chaves antigas deixam de existir).
-- ============================================================================

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- 1. Aprovação de desconto por permissão
-- ---------------------------------------------------------------------------
-- Retorna o nome de quem aprovou (null = PIN inválido). Uso interno do
-- create_order_and_credit_cash — não é exposta ao cliente porque devolve nome.
create or replace function public.discount_approver_name(p_pin text, p_keys text[])
returns text
language plpgsql
security definer set search_path = public, extensions
as $$
declare
  v_name text;
begin
  if public.pin_is_locked() then
    return null;
  end if;
  select coalesce(nullif(name, ''), email) into v_name
  from public.profiles
  where active
    and (role = 'admin' or permissions && p_keys)
    and code is not null and code <> ''
    and char_length(coalesce(p_pin, '')) between 4 and 8
    and code = crypt(p_pin, code)
  order by (role = 'admin') desc
  limit 1;
  if v_name is null then
    perform public.register_pin_failure();
  else
    delete from public.pin_attempts where actor_id = auth.uid();
  end if;
  return v_name;
end;
$$;

revoke execute on function public.discount_approver_name(text, text[]) from public, anon, authenticated;

-- Pré-checagem usada pela UI (PDV / fechamento de comanda) antes de enviar a
-- venda. p_scope limitado às duas chaves de aprovação para não virar oráculo
-- de "quem tem a permissão X".
create or replace function public.validate_discount_approver_pin(p_pin text, p_scope text)
returns boolean
language plpgsql
security definer set search_path = public, extensions
as $$
begin
  if p_scope not in ('pdv', 'mesas') then
    raise exception 'Escopo de aprovação inválido.';
  end if;
  return public.discount_approver_name(p_pin, array[p_scope || '.desconto_acima_limite']) is not null;
end;
$$;

revoke execute on function public.validate_discount_approver_pin(text, text) from public, anon;
grant execute on function public.validate_discount_approver_pin(text, text) to authenticated;

-- create_order_and_credit_cash: cópia fiel da migration 0033, trocando só o
-- bloco "Desconto acima do limite" (validate_manager_pin -> aprovador por
-- permissão). Comanda (channel 'garcom') usa mesas.*; o resto usa pdv.*.
create or replace function public.create_order_and_credit_cash(
  p_order jsonb,
  p_cash_amount numeric,
  p_payment_method text,
  p_stock_items jsonb default '[]'::jsonb,
  p_split_payments jsonb default null,
  p_already_paid numeric default 0,
  p_service_fee numeric default 0,
  p_couvert numeric default 0,
  p_discount_reason text default null,
  p_manager_pin text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_shift_id text;
  v_item jsonb;
  v_addition jsonb;
  v_product products%rowtype;
  v_unit_price numeric;
  v_menu_unit_price numeric;
  v_addition_price numeric;
  v_additions_total numeric;
  v_validated_additions jsonb;
  v_validated_items jsonb := '[]'::jsonb;
  v_subtotal numeric := 0;
  v_goods_value numeric := 0;
  v_delivery_fee numeric;
  v_discount numeric;
  v_service_fee numeric;
  v_couvert numeric;
  v_total numeric;
  v_venda_portion numeric;
  v_split_sum numeric;
  v_min_order_value numeric;
  v_is_anon boolean := auth.role() = 'anon';
  v_qty numeric;
  v_split jsonb;
  v_role text;
  v_limit numeric;
  v_pct numeric;
  v_disc_auth text;
  v_approver text;
  a jsonb;
begin
  if v_is_anon then
    if coalesce(p_order->>'channel', '') <> 'online' then
      raise exception 'Canal inválido para pedido público.';
    end if;
    if coalesce(jsonb_array_length(p_order->'items'), 0) not between 1 and 50 then
      raise exception 'Pedido com número de itens inválido.';
    end if;
    if char_length(coalesce(p_order->'customer'->>'name', '')) not between 2 and 120 then
      raise exception 'Nome do cliente inválido.';
    end if;
    if char_length(regexp_replace(coalesce(p_order->'customer'->>'phone', ''), '\D', '', 'g')) not between 10 and 11 then
      raise exception 'Telefone do cliente inválido.';
    end if;
    if char_length(coalesce(p_order->>'notes', '')) > 1000 then
      raise exception 'Observação do pedido muito longa.';
    end if;
  end if;

  for v_qty in
    select coalesce((e->>'quantity')::numeric, 0)
    from jsonb_array_elements(coalesce(p_stock_items, '[]'::jsonb)) e
  loop
    if v_qty <= 0 or v_qty > 100000 then
      raise exception 'Quantidade de item inválida (%).', v_qty;
    end if;
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_order->'items', '[]'::jsonb))
  loop
    if coalesce(v_item->>'status', 'ativo') = 'cancelado' then
      v_validated_items := v_validated_items || v_item;
      continue;
    end if;

    v_qty := coalesce((v_item->>'quantity')::numeric, 1);
    if v_qty <= 0 or v_qty > 100000 then
      raise exception 'Quantidade inválida no item % .', v_item->>'productId';
    end if;

    if (v_item->>'isCourtesy')::boolean is true then
      v_unit_price := 0;
      v_validated_additions := coalesce(v_item->'additions', '[]'::jsonb);
      -- Cortesia: preço de menu vem do produto (para a saída de mercadoria).
      select coalesce(promo_price, price) into v_menu_unit_price from products where id = v_item->>'productId';
      v_menu_unit_price := coalesce(v_menu_unit_price, (v_item->>'unitPrice')::numeric, 0);
    elsif v_item->>'productId' in ('prod-kg-almoco', 'prod-kg-cafe') then
      v_unit_price := coalesce((v_item->>'unitPrice')::numeric, 0);
      v_menu_unit_price := v_unit_price;
      v_validated_additions := coalesce(v_item->'additions', '[]'::jsonb);
    else
      select * into v_product from products where id = v_item->>'productId';
      if not found then
        raise exception 'Produto % não encontrado — venda rejeitada.', v_item->>'productId';
      end if;

      v_validated_additions := '[]'::jsonb;
      v_additions_total := 0;
      for v_addition in select * from jsonb_array_elements(coalesce(v_item->'additions', '[]'::jsonb))
      loop
        select (elem->>'price')::numeric into v_addition_price
        from jsonb_array_elements(coalesce(v_product.additions, '[]'::jsonb)) elem
        where elem->>'id' = v_addition->>'id';

        if v_addition_price is null then
          raise exception 'Adicional % inválido para o produto % — venda rejeitada.', v_addition->>'id', v_product.name;
        end if;

        v_additions_total := v_additions_total + v_addition_price;
        v_validated_additions := v_validated_additions || jsonb_build_object('id', v_addition->>'id', 'name', v_addition->>'name', 'price', v_addition_price);
      end loop;

      v_unit_price := coalesce(v_product.promo_price, v_product.price) + v_additions_total;
      v_menu_unit_price := v_unit_price;
    end if;

    v_subtotal := v_subtotal + v_unit_price * v_qty;
    v_goods_value := v_goods_value + coalesce(v_menu_unit_price, 0) * v_qty;
    v_validated_items := v_validated_items || (v_item || jsonb_build_object('unitPrice', v_unit_price, 'additions', v_validated_additions));
  end loop;

  if p_order->>'channel' = 'online' then
    select min_order_value into v_min_order_value from company_profile where id = true;
    if v_min_order_value is not null and v_subtotal < v_min_order_value then
      raise exception 'Pedido abaixo do mínimo de R$ % (subtotal: R$ %) — venda rejeitada.', v_min_order_value, v_subtotal;
    end if;
  end if;

  v_delivery_fee := greatest(0, coalesce((p_order->>'deliveryFee')::numeric, 0));
  v_discount := case when v_is_anon then 0 else greatest(0, coalesce((p_order->>'discount')::numeric, 0)) end;
  v_discount := least(v_discount, v_subtotal);
  v_service_fee := case when v_is_anon then 0 else greatest(0, coalesce(p_service_fee, 0)) end;
  v_couvert := case when v_is_anon then 0 else greatest(0, coalesce(p_couvert, 0)) end;

  if not v_is_anon and v_discount > 0 and v_subtotal > 0 then
    select role into v_role from profiles where id = auth.uid();
    v_limit := public.discount_limit_percent(coalesce(v_role, ''));
    v_pct := v_discount / v_subtotal * 100;
    if v_pct > v_limit + 0.001 then
      if coalesce(trim(p_discount_reason), '') = '' then
        raise exception 'Desconto acima do limite do cargo (limite %, aplicado %). Informe o motivo do desconto.', v_limit, round(v_pct, 1);
      end if;
      v_approver := public.discount_approver_name(
        p_manager_pin,
        case when p_order->>'channel' = 'garcom'
             then array['mesas.desconto_acima_limite']
             else array['pdv.desconto_acima_limite'] end
      );
      if v_approver is null then
        raise exception 'Desconto acima do limite: PIN inválido ou de alguém sem permissão para aprovar desconto acima do teto.';
      end if;
      v_disc_auth := 'PIN: ' || v_approver;
    end if;
  end if;

  v_total := greatest(0, v_subtotal + v_delivery_fee + v_service_fee + v_couvert
                        - coalesce(case when v_is_anon then 0 else p_already_paid end, 0) - v_discount);
  v_venda_portion := greatest(0, v_total - v_service_fee - v_couvert);

  perform public.deduct_stock_for_items(p_stock_items);

  select id into v_shift_id from cash_shifts where status = 'aberto' limit 1;

  insert into orders (
    id, order_number, channel, table_number, customer, items, service_type,
    subtotal, delivery_fee, discount, total, payment_method, payment_status,
    order_status, prepared_at, delivered_at, tuna_transaction_id,
    delivery_driver_name, waiter_name, notes, fiscal_issued, nfce_key,
    split_payments, shift_id, service_fee, couvert, discount_reason, discount_authorized_by
  )
  values (
    p_order->>'id', (p_order->>'orderNumber')::int, p_order->>'channel',
    nullif(p_order->>'tableNumber','')::int, p_order->'customer', v_validated_items,
    p_order->>'serviceType', v_subtotal, v_delivery_fee,
    v_discount, v_total, p_order->>'paymentMethod',
    p_order->>'paymentStatus', p_order->>'orderStatus', p_order->>'preparedAt', p_order->>'deliveredAt',
    p_order->>'tunaTransactionId', p_order->>'deliveryDriverName', p_order->>'waiterName',
    p_order->>'notes', (p_order->>'fiscalIssued')::boolean, p_order->>'nfceKey',
    p_split_payments, v_shift_id, v_service_fee, v_couvert,
    nullif(trim(coalesce(p_discount_reason, '')), ''), v_disc_auth
  );

  if v_shift_id is not null then
    if p_split_payments is not null and jsonb_array_length(p_split_payments) > 0 then
      select coalesce(sum((elem->>'amount')::numeric), 0) into v_split_sum
      from jsonb_array_elements(p_split_payments) elem;
      if abs(v_split_sum - v_total) > 0.05 then
        raise exception 'Soma das formas de pagamento (R$ %) não bate com o total da venda (R$ %) — venda rejeitada.', v_split_sum, v_total;
      end if;
      select coalesce(jsonb_agg(jsonb_build_object(
               'method', public._ledger_method(elem->>'method'),
               'amount', (elem->>'amount')::numeric)), '[]'::jsonb)
        into v_split
      from jsonb_array_elements(p_split_payments) elem;
    else
      v_split := jsonb_build_array(jsonb_build_object(
        'method', public._ledger_method(p_payment_method), 'amount', v_total));
    end if;

    for a in select * from jsonb_array_elements(public._alloc_by_split(v_split, v_venda_portion))
    loop
      perform public._cash_ledger_add(v_shift_id, 'venda', 'entrada', a->>'method',
        (a->>'amount')::numeric, p_order->>'id', null, nullif(p_order->>'tableNumber',''),
        null, null, jsonb_build_object('orderNumber', p_order->>'orderNumber'));
    end loop;

    if v_service_fee > 0 then
      for a in select * from jsonb_array_elements(public._alloc_by_split(v_split, v_service_fee))
      loop
        perform public._cash_ledger_add(v_shift_id, 'taxa_servico', 'entrada', a->>'method',
          (a->>'amount')::numeric, p_order->>'id', null, nullif(p_order->>'tableNumber',''));
      end loop;
    end if;

    if v_couvert > 0 then
      for a in select * from jsonb_array_elements(public._alloc_by_split(v_split, v_couvert))
      loop
        perform public._cash_ledger_add(v_shift_id, 'couvert', 'entrada', a->>'method',
          (a->>'amount')::numeric, p_order->>'id', null, nullif(p_order->>'tableNumber',''));
      end loop;
    end if;

    -- Saída de mercadoria: valor de menu dos itens (abate as entradas de venda).
    if v_goods_value > 0 then
      perform public._cash_ledger_add(v_shift_id, 'saida_mercadoria', 'saida', null,
        v_goods_value, p_order->>'id', null, nullif(p_order->>'tableNumber',''), null,
        'Mercadoria/serviço entregue', jsonb_build_object('orderNumber', p_order->>'orderNumber'));
    end if;

    if (p_split_payments is null or jsonb_array_length(p_split_payments) = 0)
       and p_payment_method = 'dinheiro'
       and p_cash_amount is not null and p_cash_amount > v_total + 0.005 then
      perform public._cash_ledger_add(v_shift_id, 'troco', 'saida', 'dinheiro',
        p_cash_amount - v_total, p_order->>'id');
    end if;
  end if;

  if v_disc_auth is not null then
    perform public.write_audit_log('Desconto acima do limite', 'PDV / Caixa', 'order', p_order->>'id',
      v_subtotal, v_total, jsonb_build_object('percent', round(v_pct, 2), 'limit', v_limit, 'reason', p_discount_reason));
  end if;
  perform public.write_audit_log(
    case when p_order->>'channel' = 'online' then 'Venda Online' else 'Venda PDV' end,
    'Frente de Caixa', 'order', p_order->>'id', null, v_total,
    jsonb_build_object('orderNumber', p_order->>'orderNumber', 'paymentMethod', p_order->>'paymentMethod'));
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Gerência de usuários por permissão (não só admin)
-- ---------------------------------------------------------------------------
create or replace function public.prevent_self_privilege_escalation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_caller public.profiles%rowtype;
  v_added text[];
begin
  -- service_role (Edge Functions administrativas / migrations) segue liberado.
  if auth.uid() is null then
    return new;
  end if;

  if new.role is not distinct from old.role
     and new.active is not distinct from old.active
     and new.code is not distinct from old.code
     and new.permissions is not distinct from old.permissions then
    return new;
  end if;

  select * into v_caller from public.profiles where id = auth.uid();

  if v_caller.role = 'admin' and v_caller.active then
    return new;
  end if;

  if not coalesce(v_caller.active, false) then
    raise exception 'Usuário inativo não pode alterar outros usuários.';
  end if;
  if new.id = auth.uid() then
    raise exception 'Você não pode alterar seu próprio cargo, status, PIN ou permissões.';
  end if;
  if old.role = 'admin' or new.role = 'admin' then
    raise exception 'Apenas administradores podem criar, promover ou alterar usuários administradores.';
  end if;
  if (new.role is distinct from old.role or new.permissions is distinct from old.permissions)
     and not ('usuarios.editar_permissoes' = any(coalesce(v_caller.permissions, '{}'))) then
    raise exception 'Sem permissão para alterar cargo/permissões de usuário.';
  end if;
  if new.active is distinct from old.active
     and not ('usuarios.ativar_inativar' = any(coalesce(v_caller.permissions, '{}'))) then
    raise exception 'Sem permissão para ativar/inativar usuário.';
  end if;
  if new.code is distinct from old.code
     and not ('usuarios.definir_pin' = any(coalesce(v_caller.permissions, '{}'))) then
    raise exception 'Sem permissão para definir PIN de usuário.';
  end if;

  -- Só concede o que o próprio editor possui (remover é livre).
  select array_agg(k) into v_added from (
    select unnest(coalesce(new.permissions, '{}'))
    except
    select unnest(coalesce(old.permissions, '{}'))
    except
    select unnest(coalesce(v_caller.permissions, '{}'))
  ) s(k);
  if v_added is not null then
    raise exception 'Você não pode conceder permissões que não possui: %', array_to_string(v_added, ', ');
  end if;

  return new;
end;
$$;

-- Policy de UPDATE para quem gerencia usuários (admin já tem a
-- admin_update_any_profile). Linha de admin fica fora do alcance.
drop policy if exists manage_update_profiles on public.profiles;
create policy manage_update_profiles on public.profiles
  for update
  using (role <> 'admin' and public.has_any_permission(array[
    'usuarios.editar_permissoes', 'usuarios.ativar_inativar', 'usuarios.definir_pin'
  ]))
  with check (role <> 'admin' and public.has_any_permission(array[
    'usuarios.editar_permissoes', 'usuarios.ativar_inativar', 'usuarios.definir_pin'
  ]));

-- ---------------------------------------------------------------------------
-- 3. company_profile — escrita por permissão, conferida coluna a coluna
-- ---------------------------------------------------------------------------
drop policy if exists "authenticated_update_company_profile" on public.company_profile;
drop policy if exists permission_update_company_profile on public.company_profile;
create policy permission_update_company_profile on public.company_profile
  for update
  using (public.has_any_permission(array[
    'empresa.editar_perfil', 'empresa.editar_midia', 'empresa.editar_precos_buffet',
    'empresa.editar_regras_caixa', 'fiscal.editar_dados_empresa'
  ]))
  with check (public.has_any_permission(array[
    'empresa.editar_perfil', 'empresa.editar_midia', 'empresa.editar_precos_buffet',
    'empresa.editar_regras_caixa', 'fiscal.editar_dados_empresa'
  ]));

create or replace function public.guard_company_profile_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  o jsonb := to_jsonb(old);
  n jsonb := to_jsonb(new);
  -- name/address são editados tanto no Perfil quanto no Fiscal (razão social,
  -- código IBGE) — basta uma das duas permissões.
  c_shared text[] := array['name', 'address'];
  c_fiscal text[] := array['cnpj', 'ie', 'fiscal_info'];
  c_media  text[] := array['logo_url', 'cover_url'];
  c_buffet text[] := array['buffet_prices'];
  c_rules  text[] := array['service_fee_percent', 'service_fee_enabled', 'couvert_value',
                           'couvert_enabled', 'blind_conference_threshold', 'discount_limits'];
  k text;
begin
  if auth.uid() is null then
    return new;
  end if;

  foreach k in array c_shared loop
    if o->k is distinct from n->k
       and not public.has_any_permission(array['empresa.editar_perfil', 'fiscal.editar_dados_empresa']) then
      raise exception 'Sem permissão para alterar o nome/endereço da empresa.';
    end if;
  end loop;
  foreach k in array c_fiscal loop
    if o->k is distinct from n->k and not public.has_any_permission(array['fiscal.editar_dados_empresa']) then
      raise exception 'Sem permissão para alterar os dados fiscais da empresa.';
    end if;
  end loop;
  foreach k in array c_media loop
    if o->k is distinct from n->k and not public.has_any_permission(array['empresa.editar_midia']) then
      raise exception 'Sem permissão para alterar logo/capa do cardápio.';
    end if;
  end loop;
  foreach k in array c_buffet loop
    if o->k is distinct from n->k and not public.has_any_permission(array['empresa.editar_precos_buffet']) then
      raise exception 'Sem permissão para alterar os preços do buffet.';
    end if;
  end loop;
  foreach k in array c_rules loop
    if o->k is distinct from n->k and not public.has_any_permission(array['empresa.editar_regras_caixa']) then
      raise exception 'Sem permissão para alterar as regras de caixa (taxa de serviço, couvert, teto de desconto).';
    end if;
  end loop;

  -- Qualquer outra coluna (telefone, entrega, pedido mínimo, cor, etc.).
  if (o - c_shared - c_fiscal - c_media - c_buffet - c_rules)
     is distinct from (n - c_shared - c_fiscal - c_media - c_buffet - c_rules)
     and not public.has_any_permission(array['empresa.editar_perfil']) then
    raise exception 'Sem permissão para editar o perfil da empresa.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_company_profile_update on public.company_profile;
create trigger trg_guard_company_profile_update
  before update on public.company_profile
  for each row execute function public.guard_company_profile_update();

-- ---------------------------------------------------------------------------
-- 4. tax_groups — leitura para logados, escrita com fiscal.grupos_tributarios
-- ---------------------------------------------------------------------------
drop policy if exists "authenticated_all_tax_groups" on public.tax_groups;
drop policy if exists authenticated_select_tax_groups on public.tax_groups;
drop policy if exists permission_insert_tax_groups on public.tax_groups;
drop policy if exists permission_update_tax_groups on public.tax_groups;
drop policy if exists permission_delete_tax_groups on public.tax_groups;

create policy authenticated_select_tax_groups on public.tax_groups
  for select using (auth.role() = 'authenticated');
create policy permission_insert_tax_groups on public.tax_groups
  for insert with check (public.has_any_permission(array['fiscal.grupos_tributarios']));
create policy permission_update_tax_groups on public.tax_groups
  for update
  using (public.has_any_permission(array['fiscal.grupos_tributarios']))
  with check (public.has_any_permission(array['fiscal.grupos_tributarios']));
create policy permission_delete_tax_groups on public.tax_groups
  for delete using (public.has_any_permission(array['fiscal.grupos_tributarios']));

-- ---------------------------------------------------------------------------
-- 5. orders — troca a chave renomeada na policy de UPDATE (0022)
-- ---------------------------------------------------------------------------
drop policy if exists permission_update_orders on public.orders;
create policy permission_update_orders on public.orders
  for update
  using (public.has_any_permission(array[
    'kitchen.avancar_status', 'entregas.despachar', 'fiscal.emitir_nfce',
    'vendas.acessar', 'online_menu.acessar'
  ]))
  with check (public.has_any_permission(array[
    'kitchen.avancar_status', 'entregas.despachar', 'fiscal.emitir_nfce',
    'vendas.acessar', 'online_menu.acessar'
  ]));

-- ---------------------------------------------------------------------------
-- 6. Backfill de profiles.permissions (admin é liberado por role, não precisa)
--    Roda como postgres (auth.uid() null) — o trigger do passo 2 não bloqueia.
-- ---------------------------------------------------------------------------
-- Emitir NFC-e: quem emitia pela tela (vendas.emitir_nfce ou, na UI antiga,
-- fiscal.editar_dados_empresa) continua emitindo.
update public.profiles set permissions = (
  select array_agg(distinct p) from unnest(permissions || array['fiscal.emitir_nfce']) p
) where permissions && array['vendas.emitir_nfce', 'fiscal.editar_dados_empresa'];

update public.profiles set permissions = (
  select array_agg(distinct p) from unnest(permissions || array['fiscal.estornar_pagbank']) p
) where permissions && array['vendas.estornar_pagbank'];

-- Grupos tributários eram controlados por fiscal.editar_dados_empresa.
update public.profiles set permissions = (
  select array_agg(distinct p) from unnest(permissions || array['fiscal.grupos_tributarios']) p
) where permissions && array['fiscal.editar_dados_empresa'];

-- Regras de caixa eram controladas por empresa.editar_perfil.
update public.profiles set permissions = (
  select array_agg(distinct p) from unnest(permissions || array['empresa.editar_regras_caixa']) p
) where permissions && array['empresa.editar_perfil'];

-- Gerente passa a criar e editar usuários (definir PIN continua a critério do admin).
update public.profiles set permissions = (
  select array_agg(distinct p) from unnest(permissions || array[
    'usuarios.acessar', 'usuarios.criar', 'usuarios.editar_permissoes', 'usuarios.ativar_inativar'
  ]) p
) where role = 'gerente';

-- Remove chaves que não existem mais no catálogo (src/lib/permissions.ts).
with catalog as (
  select array[
    'dashboard.acessar','online_menu.acessar','waiter.acessar','mesas.acessar','mesas.criar','mesas.excluir',
    'mesas.abrir_comanda','mesas.lancar_item','mesas.cancelar_item','mesas.transferir','mesas.cortesia',
    'mesas.pagamento_parcial','mesas.estornar_pagamento_parcial','mesas.desconto','mesas.desconto_acima_limite',
    'mesas.remover_taxa_servico','mesas.fechar_comanda','mesas.imprimir','kitchen.acessar','kitchen.avancar_status',
    'kitchen.chamar_apoio','pdv.acessar','pdv.lancar_item_kg','pdv.desconto','pdv.desconto_acima_limite',
    'pdv.finalizar_venda','pdv.imprimir','caixas.acessar','caixas.abrir','caixas.movimentacao','caixas.fechar',
    'caixas.estornar_venda','caixas.reabrir','caixas.imprimir','livro_caixa.acessar','livro_caixa.exportar',
    'vendas.acessar','vendas.reimprimir','produtos.acessar','produtos.criar','produtos.editar','produtos.excluir',
    'estoque.acessar','estoque.criar_insumo','estoque.editar_insumo','estoque.excluir_insumo','estoque.entrada',
    'estoque.perda','estoque.cortesia','grupos.acessar','grupos.gerenciar','fornecedores.acessar',
    'fornecedores.criar','fornecedores.editar','fornecedores.ativar_inativar','fornecedores.excluir',
    'entregas.acessar','entregas.despachar','fiscal.acessar','fiscal.emitir_nfce','fiscal.baixar_xml',
    'fiscal.estornar_pagbank','fiscal.grupos_tributarios','fiscal.editar_dados_empresa','impressoras.acessar',
    'relatorios.acessar','relatorios.exportar','empresa.acessar','empresa.editar_perfil','empresa.editar_midia',
    'empresa.editar_precos_buffet','empresa.editar_regras_caixa','usuarios.acessar','usuarios.criar',
    'usuarios.editar_permissoes','usuarios.ativar_inativar','usuarios.definir_pin','auditoria.acessar'
  ]::text[] as keys
)
update public.profiles pr set permissions = coalesce(
  (select array_agg(p) from unnest(pr.permissions) p where p = any(c.keys)), '{}'
)
from catalog c
where not (pr.permissions <@ c.keys);
