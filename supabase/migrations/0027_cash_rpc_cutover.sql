-- CUTOVER do módulo de caixa. Passo sensível: reescreve TODAS as RPCs que
-- creditavam o caixa para gravarem no livro-caixa (cash_ledger) em vez de
-- fazerem UPDATE acumulador direto em cash_shifts, e cria o trigger que
-- mantém cash_shifts.sales_* como cache atômico a partir do ledger.
--
-- O trigger e a reescrita das RPCs PRECISAM entrar juntos: se o trigger
-- existir enquanto qualquer RPC ainda faz `update cash_shifts set sales_* =
-- sales_* + ...`, o valor conta em dobro.
--
-- Aplicar junto com o deploy do frontend correspondente e com o caixa
-- fechado (o frontend antigo faz update direto em cash_shifts, que passa a
-- ser negado pela migration 0028).
--
-- Novas RPCs: open_cash_shift, close_cash_shift, credit_partial_payment,
-- reverse_partial_payment, reverse_paid_order, record_cash_expense.
-- Reescritas: create_order_and_credit_cash (nova aridade), close_comanda_and_pay
-- (nova aridade), add_cash_movement (mesma aridade).

-- ---------------------------------------------------------------------------
-- 0. Helpers internos
-- ---------------------------------------------------------------------------

-- Insere uma linha no livro-caixa resolvendo autor pelo auth.uid(). Só é
-- chamada de dentro de outras funções security definer.
create or replace function public._cash_ledger_add(
  p_shift_id text,
  p_entry_type text,
  p_direction text,
  p_payment_method text,
  p_amount numeric,
  p_order_id text default null,
  p_comanda_id text default null,
  p_table_id text default null,
  p_related uuid default null,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_name text;
  v_role text;
  v_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    return null;
  end if;
  select name, role into v_name, v_role from public.profiles where id = auth.uid();
  insert into public.cash_ledger (
    shift_id, entry_type, direction, payment_method, amount, order_id,
    comanda_id, table_id, related_ledger_id, reason, created_by, created_by_name, metadata
  )
  values (
    p_shift_id, p_entry_type, p_direction, p_payment_method, round(p_amount, 2), p_order_id,
    p_comanda_id, p_table_id, p_related, p_reason, auth.uid(),
    coalesce(v_name, 'Sistema'), coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- Rateia p_amount entre as formas de pagamento de p_split (array
-- [{method, amount}]) proporcionalmente ao peso de cada uma; a última linha
-- absorve o arredondamento. Retorna [{method, amount}] somando p_amount.
create or replace function public._alloc_by_split(p_split jsonb, p_amount numeric)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_total numeric;
  v_n int;
  v_i int := 0;
  v_acc numeric := 0;
  v_part numeric;
  v_out jsonb := '[]'::jsonb;
  r record;
begin
  if p_amount is null or p_amount = 0 then
    return '[]'::jsonb;
  end if;
  select coalesce(sum((e->>'amount')::numeric), 0), count(*)
    into v_total, v_n
  from jsonb_array_elements(coalesce(p_split, '[]'::jsonb)) e;

  if v_total <= 0 or v_n = 0 then
    return jsonb_build_array(jsonb_build_object('method', 'outro', 'amount', round(p_amount, 2)));
  end if;

  for r in select (e->>'method') as method, (e->>'amount')::numeric as amount
           from jsonb_array_elements(p_split) e
  loop
    v_i := v_i + 1;
    if v_i = v_n then
      v_part := round(p_amount - v_acc, 2);
    else
      v_part := round(p_amount * r.amount / v_total, 2);
      v_acc := v_acc + v_part;
    end if;
    if v_part <> 0 then
      v_out := v_out || jsonb_build_object('method', coalesce(r.method, 'outro'), 'amount', v_part);
    end if;
  end loop;
  return v_out;
end;
$$;

-- Normaliza um método de pagamento de pedido para o vocabulário do ledger.
create or replace function public._ledger_method(p_method text)
returns text
language sql
immutable
as $$
  select case p_method
    when 'dinheiro' then 'dinheiro'
    when 'cartao_credito' then 'cartao_credito'
    when 'cartao_debito' then 'cartao_debito'
    when 'pix' then 'pix'
    when 'vale_refeicao' then 'vale_refeicao'
    when 'boleto' then 'boleto'
    else 'outro'
  end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Trigger de cache — cash_ledger AFTER INSERT -> cash_shifts.sales_*
-- ---------------------------------------------------------------------------
create or replace function public.cash_ledger_apply_to_shift()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  d numeric := case when new.direction = 'entrada' then new.amount else -new.amount end;
  is_sale boolean := new.entry_type in
    ('venda', 'adiantamento', 'estorno_venda', 'estorno_adiantamento');
begin
  update public.cash_shifts s set
    sales_cash         = s.sales_cash         + (case when is_sale and new.payment_method = 'dinheiro'       then d else 0 end),
    sales_credit       = s.sales_credit       + (case when is_sale and new.payment_method = 'cartao_credito' then d else 0 end),
    sales_debit        = s.sales_debit        + (case when is_sale and new.payment_method = 'cartao_debito'  then d else 0 end),
    sales_card         = s.sales_card         + (case when is_sale and new.payment_method in ('cartao_credito', 'cartao_debito') then d else 0 end),
    sales_pix          = s.sales_pix          + (case when is_sale and new.payment_method = 'pix'            then d else 0 end),
    sales_meal_voucher = s.sales_meal_voucher + (case when is_sale and new.payment_method = 'vale_refeicao'  then d else 0 end),
    sales_other        = s.sales_other        + (case when is_sale and new.payment_method in ('boleto', 'outro') then d else 0 end),
    sales_service_fee  = s.sales_service_fee  + (case when new.entry_type = 'taxa_servico' then d else 0 end),
    sales_couvert      = s.sales_couvert      + (case when new.entry_type = 'couvert'      then d else 0 end),
    additions          = s.additions          + (case when new.entry_type = 'suprimento' then new.amount else 0 end),
    withdrawals        = s.withdrawals        + (case when new.entry_type = 'sangria'     then new.amount else 0 end),
    cash_change_given  = s.cash_change_given  + (case when new.entry_type = 'troco'       then new.amount else 0 end),
    cash_expenses      = s.cash_expenses      + (case when new.entry_type = 'despesa'     then new.amount else 0 end)
  where s.id = new.shift_id;
  return null;
end;
$$;

drop trigger if exists cash_ledger_apply on public.cash_ledger;
create trigger cash_ledger_apply after insert on public.cash_ledger
  for each row execute function public.cash_ledger_apply_to_shift();

-- ---------------------------------------------------------------------------
-- 2. create_order_and_credit_cash — nova aridade (10 args)
-- ---------------------------------------------------------------------------
drop function if exists public.create_order_and_credit_cash(jsonb, numeric, text, jsonb, jsonb, numeric);

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
  v_addition_price numeric;
  v_additions_total numeric;
  v_validated_additions jsonb;
  v_validated_items jsonb := '[]'::jsonb;
  v_line_total numeric;
  v_subtotal numeric := 0;
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
  v_alloc jsonb;
  v_role text;
  v_limit numeric;
  v_pct numeric;
  v_disc_auth text;
  a jsonb;
begin
  -- Guarda para chamador anônimo (cardápio público).
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
    elsif v_item->>'productId' in ('prod-kg-almoco', 'prod-kg-cafe') then
      v_unit_price := coalesce((v_item->>'unitPrice')::numeric, 0);
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
    end if;

    v_line_total := v_unit_price * v_qty;
    v_subtotal := v_subtotal + v_line_total;
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
  -- Chamador anônimo nunca aplica taxa de serviço / couvert.
  v_service_fee := case when v_is_anon then 0 else greatest(0, coalesce(p_service_fee, 0)) end;
  v_couvert := case when v_is_anon then 0 else greatest(0, coalesce(p_couvert, 0)) end;

  -- Teto de desconto por cargo (não se aplica a anônimo, que já tem desconto 0).
  if not v_is_anon and v_discount > 0 and v_subtotal > 0 then
    select role into v_role from profiles where id = auth.uid();
    v_limit := public.discount_limit_percent(coalesce(v_role, ''));
    v_pct := v_discount / v_subtotal * 100;
    if v_pct > v_limit + 0.001 then
      if coalesce(trim(p_discount_reason), '') = '' then
        raise exception 'Desconto acima do limite do cargo (limite %, aplicado %). Informe o motivo do desconto.', v_limit, round(v_pct, 1);
      end if;
      if not public.validate_manager_pin(p_manager_pin) then
        raise exception 'Desconto acima do limite: PIN de gerente inválido ou ausente.';
      end if;
      v_disc_auth := 'PIN gerente';
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
    -- Monta a lista de formas de pagamento (split explícito ou forma única).
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

    -- Linhas de venda (produto), rateadas pelas formas de pagamento.
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

    -- Troco: só forma única em dinheiro com valor entregue acima do total.
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
-- 3. close_comanda_and_pay — nova aridade (8 args): taxa de serviço/couvert
--    calculados no servidor + repasse de motivo/PIN de desconto.
-- ---------------------------------------------------------------------------
drop function if exists public.close_comanda_and_pay(text, text, jsonb, numeric, text, jsonb);

create or replace function public.close_comanda_and_pay(
  p_table_id text,
  p_comanda_id text,
  p_order jsonb,
  p_cash_amount numeric,
  p_payment_method text,
  p_split_payments jsonb default null,
  p_discount_reason text default null,
  p_manager_pin text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_remaining jsonb;
  v_comanda jsonb;
  v_advances_total numeric;
  v_items_subtotal numeric;
  v_guests numeric;
  v_cfg record;
  v_service_fee numeric := 0;
  v_couvert numeric := 0;
begin
  select elem into v_comanda
  from jsonb_array_elements((select comandas from dining_tables where id = p_table_id)) as elem
  where elem->>'id' = p_comanda_id;

  if v_comanda is null then
    raise exception 'Comanda % não encontrada na mesa % — operação rejeitada.', p_comanda_id, p_table_id;
  end if;

  select coalesce(sum((adv->>'amount')::numeric), 0) into v_advances_total
  from jsonb_array_elements(coalesce(v_comanda->'advancePayments', '[]'::jsonb)) adv
  where adv->>'status' = 'ativo';

  select coalesce(sum((it->>'unitPrice')::numeric * (it->>'quantity')::numeric), 0) into v_items_subtotal
  from jsonb_array_elements(coalesce(v_comanda->'items', '[]'::jsonb)) it
  where coalesce(it->>'status', 'ativo') <> 'cancelado';

  select service_fee_percent, service_fee_enabled, couvert_value, couvert_enabled
    into v_cfg
  from company_profile where id = true;

  if coalesce(v_cfg.service_fee_enabled, false)
     and coalesce((v_comanda->>'serviceFeeApplied')::boolean, true) then
    v_service_fee := round(v_items_subtotal * coalesce(v_cfg.service_fee_percent, 0) / 100, 2);
  end if;

  if coalesce(v_cfg.couvert_enabled, false) then
    v_guests := coalesce((v_comanda->>'couvertQty')::numeric, (v_comanda->>'guestCount')::numeric, 0);
    v_couvert := round(coalesce(v_cfg.couvert_value, 0) * v_guests, 2);
  end if;

  perform public.create_order_and_credit_cash(
    jsonb_set(p_order, '{items}', coalesce(v_comanda->'items', '[]'::jsonb)),
    p_cash_amount,
    p_payment_method,
    '[]'::jsonb,
    p_split_payments,
    v_advances_total,
    v_service_fee,
    v_couvert,
    p_discount_reason,
    p_manager_pin
  );

  select coalesce(jsonb_agg(elem), '[]'::jsonb) into v_remaining
  from jsonb_array_elements((select comandas from dining_tables where id = p_table_id)) as elem
  where elem->>'id' <> p_comanda_id;

  update dining_tables set
    comandas = v_remaining,
    status = public.compute_table_status(v_remaining)
  where id = p_table_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. open_cash_shift / close_cash_shift
-- ---------------------------------------------------------------------------
create or replace function public.open_cash_shift(
  p_initial_float numeric,
  p_notes text default null
)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_id text;
  v_name text;
  v_role text;
  v_opened_by text;
  v_opened_at text := to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY, HH24:MI:SS');
begin
  if not public.has_any_permission(array['caixas.abrir']) then
    raise exception 'Sem permissão para abrir o caixa.';
  end if;
  if coalesce(p_initial_float, -1) < 0 then
    raise exception 'Fundo de troco inválido.';
  end if;
  if exists (select 1 from cash_shifts where status = 'aberto') then
    raise exception 'Já existe um caixa aberto. Feche-o antes de abrir outro.';
  end if;

  select name, role into v_name, v_role from profiles where id = auth.uid();
  v_opened_by := coalesce(v_name, 'Sistema') || ' (' || coalesce(v_role, '') || ')';
  v_id := 'shift-' || (extract(epoch from now()) * 1000)::bigint;

  insert into cash_shifts (id, opened_by, opened_at, initial_float, status, expected_total, notes)
  values (v_id, v_opened_by, v_opened_at, round(p_initial_float, 2), 'aberto', round(p_initial_float, 2),
          coalesce(nullif(trim(coalesce(p_notes, '')), ''), 'Abertura de caixa realizada.'));

  if p_initial_float > 0 then
    perform public._cash_ledger_add(v_id, 'abertura', 'entrada', 'dinheiro', p_initial_float,
      null, null, null, null, 'Fundo de troco');
  end if;

  perform public.write_audit_log('Abertura de Caixa', 'Controle de Caixa', 'cash_shift', v_id,
    null, p_initial_float, jsonb_build_object('initialFloat', p_initial_float));
  return v_id;
end;
$$;

create or replace function public.close_cash_shift(
  p_conferred jsonb,
  p_notes text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_shift cash_shifts%rowtype;
  v_has_ledger boolean;
  v_expected_cash numeric;
  v_conf_cash numeric := coalesce((p_conferred->>'cash')::numeric, 0);
  v_diff numeric;
  v_name text;
  v_role text;
  v_open_tables text := '';
  r record;
  v_bal numeric;
begin
  if not public.has_any_permission(array['caixas.fechar']) then
    raise exception 'Sem permissão para fechar o caixa.';
  end if;

  select * into v_shift from cash_shifts where status = 'aberto' limit 1;
  if not found then
    raise exception 'Nenhum caixa aberto para fechar.';
  end if;

  -- Recusa fechamento com mesa/comanda aberta com saldo devedor.
  for r in select id, number, comandas from dining_tables where jsonb_array_length(coalesce(comandas, '[]'::jsonb)) > 0
  loop
    select coalesce(sum(
      (select coalesce(sum((it->>'unitPrice')::numeric * (it->>'quantity')::numeric), 0)
       from jsonb_array_elements(coalesce(c->'items', '[]'::jsonb)) it
       where coalesce(it->>'status', 'ativo') <> 'cancelado')
      - (select coalesce(sum((adv->>'amount')::numeric), 0)
         from jsonb_array_elements(coalesce(c->'advancePayments', '[]'::jsonb)) adv
         where adv->>'status' = 'ativo')
    ), 0) into v_bal
    from jsonb_array_elements(r.comandas) c;
    if v_bal > 0.05 then
      v_open_tables := v_open_tables || 'Mesa ' || r.number || ' (R$ ' || to_char(v_bal, 'FM999999990.00') || '); ';
    end if;
  end loop;
  if v_open_tables <> '' then
    raise exception 'Há mesas com saldo em aberto: %. Feche as comandas antes de fechar o caixa.', v_open_tables;
  end if;

  select exists (select 1 from cash_ledger where shift_id = v_shift.id) into v_has_ledger;
  if v_has_ledger then
    v_expected_cash := public.cash_shift_expected_cash(v_shift.id);
  else
    v_expected_cash := v_shift.initial_float + v_shift.sales_cash + v_shift.additions - v_shift.withdrawals;
  end if;

  v_diff := round(v_conf_cash - v_expected_cash, 2);

  if abs(v_diff) > coalesce((select blind_conference_threshold from company_profile where id = true), 10)
     and coalesce(trim(coalesce(p_notes, '')), '') = '' then
    raise exception 'Diferença de R$ % exige justificativa nas observações.', v_diff;
  end if;

  select name, role into v_name, v_role from profiles where id = auth.uid();

  update cash_shifts set
    status = 'fechado',
    closed_by = coalesce(v_name, 'Sistema') || ' (' || coalesce(v_role, '') || ')',
    closed_at = to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY, HH24:MI:SS'),
    expected_total = v_expected_cash,
    actual_total = v_conf_cash,
    difference = v_diff,
    conferred_credit = (p_conferred->>'credit')::numeric,
    conferred_debit = (p_conferred->>'debit')::numeric,
    conferred_pix = (p_conferred->>'pix')::numeric,
    conferred_meal_voucher = (p_conferred->>'meal_voucher')::numeric,
    conferred_other = (p_conferred->>'other')::numeric,
    notes = coalesce(nullif(trim(coalesce(p_notes, '')), ''), 'Fechamento concluído.')
  where id = v_shift.id;

  if v_diff <> 0 and v_has_ledger then
    perform public._cash_ledger_add(v_shift.id, 'ajuste',
      case when v_diff > 0 then 'entrada' else 'saida' end, 'dinheiro', abs(v_diff),
      null, null, null, null, 'Diferença de fechamento de caixa');
  end if;

  perform public.write_audit_log('Fechamento de Caixa', 'Controle de Caixa', 'cash_shift', v_shift.id,
    v_expected_cash, v_conf_cash, jsonb_build_object('difference', v_diff));
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. add_cash_movement — endurecida (mesma aridade)
-- ---------------------------------------------------------------------------
create or replace function public.add_cash_movement(
  p_movement jsonb
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_shift_id text;
  v_type text := p_movement->>'type';
  v_amount numeric := (p_movement->>'amount')::numeric;
  v_name text;
begin
  if not public.has_any_permission(array['caixas.movimentacao']) then
    raise exception 'Sem permissão para movimentar o caixa.';
  end if;
  if v_type not in ('reforco', 'sangria') then
    raise exception 'Tipo de movimentação inválido.';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'Valor da movimentação deve ser maior que zero.';
  end if;

  select id into v_shift_id from cash_shifts where status = 'aberto' limit 1;
  if v_shift_id is null then
    raise exception 'Nenhum caixa aberto para movimentar.';
  end if;

  select name into v_name from profiles where id = auth.uid();

  insert into cash_movements (id, shift_id, type, amount, name, reason, user_name, "timestamp")
  values (
    coalesce(p_movement->>'id', 'mov-' || (extract(epoch from now()) * 1000)::bigint),
    v_shift_id, v_type, round(v_amount, 2),
    coalesce(p_movement->>'name', ''), coalesce(p_movement->>'reason', ''),
    coalesce(v_name, 'Sistema'),
    coalesce(p_movement->>'timestamp', to_char(now() at time zone 'America/Sao_Paulo', 'HH24:MI'))
  );

  perform public._cash_ledger_add(
    v_shift_id,
    case when v_type = 'reforco' then 'suprimento' else 'sangria' end,
    case when v_type = 'reforco' then 'entrada' else 'saida' end,
    'dinheiro', v_amount, null, null, null, null,
    coalesce(p_movement->>'reason', p_movement->>'name'),
    jsonb_build_object('name', p_movement->>'name'));

  perform public.write_audit_log(
    'Movimentação de Caixa (' || v_type || ')', 'Caixa', 'cash_shift', v_shift_id,
    null, v_amount, jsonb_build_object('name', p_movement->>'name', 'reason', p_movement->>'reason'));
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. credit_partial_payment / reverse_partial_payment (adiantamento de comanda)
-- ---------------------------------------------------------------------------
create or replace function public.credit_partial_payment(
  p_table_id text,
  p_comanda_id text,
  p_payment jsonb
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_table dining_tables%rowtype;
  v_comanda jsonb;
  v_consumed numeric;
  v_advanced numeric;
  v_remaining numeric;
  v_amount numeric := (p_payment->>'amount')::numeric;
  v_shift_id text;
  v_pay_id text := coalesce(p_payment->>'id', 'adv-' || (extract(epoch from now()) * 1000)::bigint);
  v_paid_at text := to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY, HH24:MI:SS');
  v_name text;
  v_remaining_after numeric;
  v_split jsonb;
  v_split_sum numeric;
  v_new_advance jsonb;
  v_paid_ids jsonb := coalesce(p_payment->'itemIdsPaid', '[]'::jsonb);
  v_by_item boolean := coalesce(p_payment->>'type', 'by_amount') = 'by_item';
  v_new_items jsonb;
  v_new_comandas jsonb;
  a jsonb;
begin
  if not public.has_any_permission(array['mesas.pagamento_parcial']) then
    raise exception 'Sem permissão para registrar pagamento parcial.';
  end if;

  select * into v_table from dining_tables where id = p_table_id;
  if not found then raise exception 'Mesa não encontrada.'; end if;

  select elem into v_comanda from jsonb_array_elements(v_table.comandas) elem where elem->>'id' = p_comanda_id;
  if v_comanda is null then raise exception 'Comanda não encontrada.'; end if;

  select id into v_shift_id from cash_shifts where status = 'aberto' limit 1;
  if v_shift_id is null then raise exception 'Nenhum caixa aberto.'; end if;

  select coalesce(sum((it->>'unitPrice')::numeric * (it->>'quantity')::numeric), 0) into v_consumed
  from jsonb_array_elements(coalesce(v_comanda->'items', '[]'::jsonb)) it
  where coalesce(it->>'status', 'ativo') <> 'cancelado';

  select coalesce(sum((adv->>'amount')::numeric), 0) into v_advanced
  from jsonb_array_elements(coalesce(v_comanda->'advancePayments', '[]'::jsonb)) adv
  where adv->>'status' = 'ativo';

  v_remaining := greatest(0, v_consumed - v_advanced);
  if v_amount is null or v_amount <= 0 or v_amount > v_remaining + 0.05 then
    raise exception 'Valor de adiantamento inválido. Saldo restante: R$ %.', v_remaining;
  end if;
  v_remaining_after := greatest(0, v_remaining - v_amount);

  -- Formas de pagamento normalizadas.
  if p_payment->'splitPayments' is not null and jsonb_array_length(p_payment->'splitPayments') > 0 then
    select coalesce(sum((e->>'amount')::numeric), 0) into v_split_sum
    from jsonb_array_elements(p_payment->'splitPayments') e;
    if abs(v_split_sum - v_amount) > 0.05 then
      raise exception 'Soma das formas (R$ %) não bate com o adiantamento (R$ %).', v_split_sum, v_amount;
    end if;
    select coalesce(jsonb_agg(jsonb_build_object(
             'method', public._ledger_method(e->>'method'), 'amount', (e->>'amount')::numeric)), '[]'::jsonb)
      into v_split
    from jsonb_array_elements(p_payment->'splitPayments') e;
  else
    v_split := jsonb_build_array(jsonb_build_object(
      'method', public._ledger_method(p_payment->>'paymentMethod'), 'amount', v_amount));
  end if;

  select name into v_name from profiles where id = auth.uid();

  v_new_advance := jsonb_build_object(
    'id', v_pay_id, 'tableId', p_table_id, 'tableNumber', v_table.number, 'comandaId', p_comanda_id,
    'amount', v_amount, 'paymentMethod', p_payment->>'paymentMethod', 'splitPayments', p_payment->'splitPayments',
    'type', coalesce(p_payment->>'type', 'by_amount'), 'itemIdsPaid', v_paid_ids,
    'paidItemsDetails', coalesce(p_payment->'paidItemsDetails', '[]'::jsonb),
    'customerName', coalesce(p_payment->>'customerName', v_comanda->>'personName'),
    'paidAt', v_paid_at, 'userName', coalesce(v_name, 'Sistema'), 'notes', p_payment->>'notes',
    'status', 'ativo', 'remainingBalanceAfter', v_remaining_after);

  -- Marca itens pagos (modo by_item).
  select coalesce(jsonb_agg(
    case when v_by_item and v_paid_ids ? (it->>'id')
      then it || jsonb_build_object('isPaid', true, 'paidAt', v_paid_at, 'partialPaymentId', v_pay_id)
      else it end
  ), '[]'::jsonb) into v_new_items
  from jsonb_array_elements(coalesce(v_comanda->'items', '[]'::jsonb)) it;

  select jsonb_agg(
    case when elem->>'id' = p_comanda_id then
      elem
      || jsonb_build_object('items', v_new_items)
      || jsonb_build_object('advancePayments', coalesce(elem->'advancePayments', '[]'::jsonb) || jsonb_build_array(v_new_advance))
      || (case when v_remaining_after = 0 then jsonb_build_object('status', 'aguardando_fechamento') else '{}'::jsonb end)
    else elem end
  ) into v_new_comandas
  from jsonb_array_elements(v_table.comandas) elem;

  update dining_tables set comandas = v_new_comandas, status = public.compute_table_status(v_new_comandas)
  where id = p_table_id;

  for a in select * from jsonb_array_elements(public._alloc_by_split(v_split, v_amount))
  loop
    perform public._cash_ledger_add(v_shift_id, 'adiantamento', 'entrada', a->>'method',
      (a->>'amount')::numeric, null, p_comanda_id, p_table_id, null, p_payment->>'notes',
      jsonb_build_object('partialPaymentId', v_pay_id));
  end loop;

  perform public.write_audit_log('Adiantamento Parcial de Comanda', 'Atendimento / Caixa', 'comanda', p_comanda_id,
    null, v_amount, jsonb_build_object('tableNumber', v_table.number, 'partialPaymentId', v_pay_id));

  return v_new_advance;
end;
$$;

create or replace function public.reverse_partial_payment(
  p_table_id text,
  p_comanda_id text,
  p_payment_id text,
  p_reason text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_table dining_tables%rowtype;
  v_comanda jsonb;
  v_adv jsonb;
  v_name text;
  v_canceled_at text := to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY, HH24:MI:SS');
  v_new_items jsonb;
  v_new_comandas jsonb;
  r record;
begin
  if not public.has_any_permission(array['mesas.estornar_pagamento_parcial']) then
    raise exception 'Sem permissão para estornar adiantamento.';
  end if;
  if coalesce(trim(coalesce(p_reason, '')), '') = '' then
    raise exception 'Informe o motivo do estorno.';
  end if;

  select * into v_table from dining_tables where id = p_table_id;
  if not found then raise exception 'Mesa não encontrada.'; end if;
  select elem into v_comanda from jsonb_array_elements(v_table.comandas) elem where elem->>'id' = p_comanda_id;
  if v_comanda is null then raise exception 'Comanda não encontrada.'; end if;

  select elem into v_adv from jsonb_array_elements(coalesce(v_comanda->'advancePayments', '[]'::jsonb)) elem
  where elem->>'id' = p_payment_id;
  if v_adv is null then raise exception 'Adiantamento não encontrado.'; end if;
  if v_adv->>'status' = 'estornado' then raise exception 'Adiantamento já estornado.'; end if;

  select name into v_name from profiles where id = auth.uid();

  select coalesce(jsonb_agg(
    case when it->>'partialPaymentId' = p_payment_id
      then (it - 'partialPaymentId' - 'paidAt') || jsonb_build_object('isPaid', false)
      else it end
  ), '[]'::jsonb) into v_new_items
  from jsonb_array_elements(coalesce(v_comanda->'items', '[]'::jsonb)) it;

  select jsonb_agg(
    case when elem->>'id' = p_comanda_id then
      elem
      || jsonb_build_object('items', v_new_items)
      || jsonb_build_object('advancePayments', (
           select coalesce(jsonb_agg(
             case when a->>'id' = p_payment_id
               then a || jsonb_build_object('status', 'estornado', 'canceledAt', v_canceled_at,
                                            'canceledBy', coalesce(v_name, 'Sistema'), 'cancelReason', p_reason)
               else a end
           ), '[]'::jsonb)
           from jsonb_array_elements(coalesce(elem->'advancePayments', '[]'::jsonb)) a))
    else elem end
  ) into v_new_comandas
  from jsonb_array_elements(v_table.comandas) elem;

  update dining_tables set comandas = v_new_comandas, status = public.compute_table_status(v_new_comandas)
  where id = p_table_id;

  -- Espelha no ledger cada linha do adiantamento original (se houver — os
  -- adiantamentos anteriores ao livro-caixa não têm linha e só são marcados).
  for r in select id, shift_id, payment_method, amount from cash_ledger
           where entry_type = 'adiantamento' and metadata->>'partialPaymentId' = p_payment_id
  loop
    perform public._cash_ledger_add(r.shift_id, 'estorno_adiantamento', 'saida',
      r.payment_method, r.amount, null, p_comanda_id, p_table_id, r.id, p_reason);
  end loop;

  perform public.write_audit_log('Estorno de Adiantamento', 'Caixa / Atendimento', 'comanda', p_comanda_id,
    (v_adv->>'amount')::numeric, 0, jsonb_build_object('partialPaymentId', p_payment_id, 'reason', p_reason));
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. reverse_paid_order — estorno de venda paga (PDV e comanda)
-- ---------------------------------------------------------------------------
create or replace function public.reverse_paid_order(
  p_order_id text,
  p_reason text,
  p_manager_pin text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_shift_status text;
  v_target_shift text;
  v_open_shift text;
  v_reopened boolean := false;
  v_has_lines boolean;
  r record;
  a jsonb;
  v_split jsonb;
  v_cash_reversed numeric := 0;
  v_shift cash_shifts%rowtype;
begin
  if not public.has_any_permission(array['caixas.estornar_venda']) then
    raise exception 'Sem permissão para estornar venda.';
  end if;
  if coalesce(trim(coalesce(p_reason, '')), '') = '' then
    raise exception 'Informe o motivo do estorno.';
  end if;
  if not public.validate_manager_pin(p_manager_pin) then
    raise exception 'PIN de gerente inválido ou ausente.';
  end if;

  select * into v_order from orders where id = p_order_id;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if v_order.payment_status = 'pagamento_estornado' or v_order.order_status = 'cancelado' then
    raise exception 'Este pedido já foi estornado ou cancelado.';
  end if;
  if v_order.payment_status <> 'pagamento_aprovado' then
    raise exception 'Só é possível estornar venda com pagamento aprovado.';
  end if;

  select id into v_open_shift from cash_shifts where status = 'aberto' limit 1;

  v_target_shift := v_order.shift_id;
  if v_target_shift is not null then
    select status into v_shift_status from cash_shifts where id = v_target_shift;
  end if;

  if v_target_shift is null or v_shift_status is null then
    v_target_shift := v_open_shift;
    if v_target_shift is null then
      raise exception 'Abra um caixa para lançar o estorno.';
    end if;
  elsif v_shift_status = 'fechado' then
    if not public.has_any_permission(array['caixas.reabrir']) then
      raise exception 'A venda pertence a um caixa já fechado. É necessária a permissão de reabrir caixa.';
    end if;
    update cash_shifts set status = 'aberto' where id = v_target_shift;
    v_reopened := true;
  end if;

  update orders set payment_status = 'pagamento_estornado', order_status = 'cancelado',
    updated_at = now() where id = p_order_id;

  perform public.reverse_stock_for_items(v_order.items);

  select exists (select 1 from cash_ledger where order_id = p_order_id
                 and entry_type in ('venda', 'taxa_servico', 'couvert')) into v_has_lines;

  if v_has_lines then
    for r in select id, entry_type, payment_method, amount from cash_ledger
             where order_id = p_order_id and entry_type in ('venda', 'taxa_servico', 'couvert')
    loop
      perform public._cash_ledger_add(v_target_shift, 'estorno_venda', 'saida', r.payment_method,
        r.amount, p_order_id, null, null, r.id, p_reason);
      if r.payment_method = 'dinheiro' then
        v_cash_reversed := v_cash_reversed + r.amount;
      end if;
    end loop;
  else
    -- Pedido anterior ao livro-caixa: reconstrói a partir de split/forma/total.
    if v_order.split_payments is not null and jsonb_array_length(v_order.split_payments) > 0 then
      select coalesce(jsonb_agg(jsonb_build_object(
               'method', public._ledger_method(e->>'method'), 'amount', (e->>'amount')::numeric)), '[]'::jsonb)
        into v_split
      from jsonb_array_elements(v_order.split_payments) e;
    else
      v_split := jsonb_build_array(jsonb_build_object(
        'method', public._ledger_method(v_order.payment_method), 'amount', v_order.total));
    end if;
    for a in select * from jsonb_array_elements(v_split)
    loop
      perform public._cash_ledger_add(v_target_shift, 'estorno_venda', 'saida', a->>'method',
        (a->>'amount')::numeric, p_order_id, null, null, null,
        p_reason || ' (venda anterior ao livro-caixa)');
      if a->>'method' = 'dinheiro' then
        v_cash_reversed := v_cash_reversed + (a->>'amount')::numeric;
      end if;
    end loop;
  end if;

  if v_reopened then
    select * into v_shift from cash_shifts where id = v_target_shift;
    update cash_shifts set
      status = 'fechado',
      closed_at = to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY, HH24:MI:SS'),
      expected_total = public.cash_shift_expected_cash(v_target_shift),
      actual_total = coalesce(v_shift.actual_total, 0) - v_cash_reversed,
      difference = round(coalesce(v_shift.actual_total, 0) - v_cash_reversed
                         - public.cash_shift_expected_cash(v_target_shift), 2)
    where id = v_target_shift;
    perform public.write_audit_log('Reabertura de Caixa', 'Controle de Caixa', 'cash_shift', v_target_shift,
      null, null, jsonb_build_object('motivo', 'estorno de venda', 'orderId', p_order_id));
  end if;

  perform public.write_audit_log('Estorno de Venda', 'Frente de Caixa', 'order', p_order_id,
    v_order.total, 0, jsonb_build_object('reason', p_reason, 'shiftReopened', v_reopened));
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. record_cash_expense — despesa paga em dinheiro do caixa
-- ---------------------------------------------------------------------------
create or replace function public.record_cash_expense(
  p_entry jsonb
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_shift_id text;
  v_amount numeric := (p_entry->>'amount')::numeric;
  v_name text;
  v_ledger uuid;
  v_id text := coalesce(p_entry->>'id', 'fin-' || (extract(epoch from now()) * 1000)::bigint);
begin
  if not public.has_any_permission(array['financeiro_dre.lancar']) then
    raise exception 'Sem permissão para lançar despesa.';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'Valor da despesa deve ser maior que zero.';
  end if;

  select id into v_shift_id from cash_shifts where status = 'aberto' limit 1;
  if v_shift_id is null then raise exception 'Nenhum caixa aberto.'; end if;

  select name into v_name from profiles where id = auth.uid();

  v_ledger := public._cash_ledger_add(v_shift_id, 'despesa', 'saida', 'dinheiro', v_amount,
    null, null, null, null, coalesce(p_entry->>'description', 'Despesa'),
    jsonb_build_object('category', p_entry->>'category'));

  insert into financial_entries (id, type, description, category, amount, due_date, status,
    payment_method, shift_id, ledger_id, created_by, created_by_name)
  values (v_id, 'despesa', coalesce(p_entry->>'description', ''), coalesce(p_entry->>'category', ''),
    round(v_amount, 2), (now() at time zone 'America/Sao_Paulo')::date, 'pago', 'dinheiro',
    v_shift_id, v_ledger, auth.uid(), coalesce(v_name, 'Sistema'));

  perform public.write_audit_log('Despesa em Dinheiro', 'Financeiro', 'financial_entry', v_id,
    null, v_amount, jsonb_build_object('description', p_entry->>'description'));
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Grants
-- ---------------------------------------------------------------------------
revoke execute on function public._cash_ledger_add(text, text, text, text, numeric, text, text, text, uuid, text, jsonb) from public, anon;
revoke execute on function public._alloc_by_split(jsonb, numeric) from public, anon;
revoke execute on function public._ledger_method(text) from public, anon;
grant execute on function public._alloc_by_split(jsonb, numeric) to authenticated;
grant execute on function public._ledger_method(text) to authenticated;

grant execute on function public.create_order_and_credit_cash(jsonb, numeric, text, jsonb, jsonb, numeric, numeric, numeric, text, text) to authenticated, anon;
revoke execute on function public.create_order_and_credit_cash(jsonb, numeric, text, jsonb, jsonb, numeric, numeric, numeric, text, text) from public;

grant execute on function public.close_comanda_and_pay(text, text, jsonb, numeric, text, jsonb, text, text) to authenticated;
revoke execute on function public.close_comanda_and_pay(text, text, jsonb, numeric, text, jsonb, text, text) from public, anon;

grant execute on function public.open_cash_shift(numeric, text) to authenticated;
grant execute on function public.close_cash_shift(jsonb, text) to authenticated;
grant execute on function public.add_cash_movement(jsonb) to authenticated;
grant execute on function public.credit_partial_payment(text, text, jsonb) to authenticated;
grant execute on function public.reverse_partial_payment(text, text, text, text) to authenticated;
grant execute on function public.reverse_paid_order(text, text, text) to authenticated;
grant execute on function public.record_cash_expense(jsonb) to authenticated;

revoke execute on function public.open_cash_shift(numeric, text) from public, anon;
revoke execute on function public.close_cash_shift(jsonb, text) from public, anon;
revoke execute on function public.add_cash_movement(jsonb) from public, anon;
revoke execute on function public.credit_partial_payment(text, text, jsonb) from public, anon;
revoke execute on function public.reverse_partial_payment(text, text, text, text) from public, anon;
revoke execute on function public.reverse_paid_order(text, text, text) from public, anon;
revoke execute on function public.record_cash_expense(jsonb) from public, anon;
