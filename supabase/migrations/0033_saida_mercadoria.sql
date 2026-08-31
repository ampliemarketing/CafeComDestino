-- Controle de saída de mercadoria: toda venda passa a lançar, além das
-- entradas de pagamento, uma linha 'saida_mercadoria' com o VALOR DE MENU
-- dos itens (mesmo em cortesia/desconto). No livro-caixa a saída abate a
-- entrada:
--   venda limpa  -> venda +7 / saida_mercadoria -7  => saldo 0
--   com desconto -> venda +5 / saida_mercadoria -7  => saldo -2 (o desconto)
--   cortesia     -> saida_mercadoria -7             => saldo -7 (custo)
--
-- A coluna "Saldo" do livro-caixa vira um INDICADOR DE CONFERÊNCIA (zero =
-- tudo batendo). O "dinheiro esperado na gaveta" (cash_shift_expected_cash)
-- NÃO muda — saida_mercadoria tem payment_method nulo e não entra ali.

-- ---------------------------------------------------------------------------
-- 1. Novo tipo de lançamento + coluna acumuladora
-- ---------------------------------------------------------------------------
alter table public.cash_ledger drop constraint if exists cash_ledger_entry_type_check;
alter table public.cash_ledger add constraint cash_ledger_entry_type_check check (entry_type in (
  'abertura', 'venda', 'adiantamento', 'estorno_venda', 'estorno_adiantamento',
  'sangria', 'suprimento', 'troco', 'despesa', 'taxa_servico', 'couvert', 'ajuste',
  'saida_mercadoria'));

alter table public.cash_shifts add column if not exists goods_out numeric(10,2) not null default 0;

-- ---------------------------------------------------------------------------
-- 2. Trigger de cache — trata saida_mercadoria (não toca em sales_* nem no
--    dinheiro da gaveta; só acumula goods_out, respeitando a direção para o
--    caso de estorno).
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
    goods_out          = s.goods_out          + (case when new.entry_type = 'saida_mercadoria' then -d else 0 end),
    additions          = s.additions          + (case when new.entry_type = 'suprimento' then new.amount else 0 end),
    withdrawals        = s.withdrawals        + (case when new.entry_type = 'sangria'     then new.amount else 0 end),
    cash_change_given  = s.cash_change_given  + (case when new.entry_type = 'troco'       then new.amount else 0 end),
    cash_expenses      = s.cash_expenses      + (case when new.entry_type = 'despesa'     then new.amount else 0 end)
  where s.id = new.shift_id;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. create_order_and_credit_cash — calcula o valor de menu dos itens
--    (v_goods_value) e emite a linha saida_mercadoria.
-- ---------------------------------------------------------------------------
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
-- 4. reverse_paid_order — espelha também as linhas de saida_mercadoria.
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
    -- Reverte a saída de mercadoria (entra de volta).
    for r in select id, amount from cash_ledger
             where order_id = p_order_id and entry_type = 'saida_mercadoria' and direction = 'saida'
    loop
      perform public._cash_ledger_add(v_target_shift, 'saida_mercadoria', 'entrada', null,
        r.amount, p_order_id, null, null, r.id, p_reason || ' (estorno de mercadoria)');
    end loop;
  else
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
