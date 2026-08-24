-- Permite fechar uma comanda com o pagamento dividido em múltiplas formas
-- (ex: parte em PIX + parte em dinheiro), assim como já era possível nos
-- adiantamentos parciais.

alter table orders add column if not exists split_payments jsonb;

create or replace function public.create_order_and_credit_cash(
  p_order jsonb,
  p_cash_amount numeric,
  p_payment_method text,
  p_stock_items jsonb default '[]'::jsonb,
  p_split_payments jsonb default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_shift_id text;
begin
  perform public.deduct_stock_for_items(p_stock_items);

  insert into orders (
    id, order_number, channel, table_number, customer, items, service_type,
    subtotal, delivery_fee, discount, total, payment_method, payment_status,
    order_status, prepared_at, delivered_at, tuna_transaction_id,
    delivery_driver_name, waiter_name, notes, fiscal_issued, nfce_key, split_payments
  )
  select
    p_order->>'id', (p_order->>'orderNumber')::int, p_order->>'channel',
    nullif(p_order->>'tableNumber','')::int, p_order->'customer', p_order->'items',
    p_order->>'serviceType', (p_order->>'subtotal')::numeric, (p_order->>'deliveryFee')::numeric,
    (p_order->>'discount')::numeric, (p_order->>'total')::numeric, p_order->>'paymentMethod',
    p_order->>'paymentStatus', p_order->>'orderStatus', p_order->>'preparedAt', p_order->>'deliveredAt',
    p_order->>'tunaTransactionId', p_order->>'deliveryDriverName', p_order->>'waiterName',
    p_order->>'notes', (p_order->>'fiscalIssued')::boolean, p_order->>'nfceKey', p_split_payments;

  select id into v_shift_id from cash_shifts where status = 'aberto' limit 1;

  if v_shift_id is not null then
    if p_split_payments is not null and jsonb_array_length(p_split_payments) > 0 then
      update cash_shifts set
        sales_cash = sales_cash + coalesce((
          select sum((elem->>'amount')::numeric) from jsonb_array_elements(p_split_payments) elem
          where elem->>'method' = 'dinheiro'
        ), 0),
        sales_card = sales_card + coalesce((
          select sum((elem->>'amount')::numeric) from jsonb_array_elements(p_split_payments) elem
          where elem->>'method' in ('cartao_credito', 'cartao_debito')
        ), 0),
        sales_pix = sales_pix + coalesce((
          select sum((elem->>'amount')::numeric) from jsonb_array_elements(p_split_payments) elem
          where elem->>'method' = 'pix'
        ), 0)
      where id = v_shift_id;
    elsif p_cash_amount is not null then
      update cash_shifts set
        sales_cash = sales_cash + case when p_payment_method = 'dinheiro' then p_cash_amount else 0 end,
        sales_card = sales_card + case when p_payment_method in ('cartao_credito','cartao_debito') then p_cash_amount else 0 end,
        sales_pix  = sales_pix  + case when p_payment_method = 'pix' then p_cash_amount else 0 end
      where id = v_shift_id;
    end if;
  end if;
end;
$$;

create or replace function public.close_comanda_and_pay(
  p_table_id text,
  p_comanda_id text,
  p_order jsonb,
  p_cash_amount numeric,
  p_payment_method text,
  p_split_payments jsonb default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_remaining jsonb;
begin
  perform public.create_order_and_credit_cash(p_order, p_cash_amount, p_payment_method, '[]'::jsonb, p_split_payments);

  select coalesce(jsonb_agg(elem), '[]'::jsonb) into v_remaining
  from jsonb_array_elements((select comandas from dining_tables where id = p_table_id)) as elem
  where elem->>'id' <> p_comanda_id;

  update dining_tables set
    comandas = v_remaining,
    status = public.compute_table_status(v_remaining)
  where id = p_table_id;
end;
$$;
