-- Tela de conferência/fechamento de caixa: separa Débito de Crédito (antes
-- somados em sales_card), adiciona Vale-refeição/Outros como formas de
-- pagamento, guarda o valor conferido pelo operador por forma de pagamento
-- (não só o dinheiro) e liga cada pedido ao turno de caixa em que foi
-- vendido, para permitir estatísticas de vendas por turno.

alter table orders drop constraint if exists orders_payment_method_check;
alter table orders add constraint orders_payment_method_check
  check (payment_method in ('pix', 'cartao_credito', 'cartao_debito', 'dinheiro', 'boleto', 'multiplo', 'vale_refeicao'));

alter table orders add column if not exists shift_id text references cash_shifts(id);

alter table cash_shifts
  add column if not exists sales_credit numeric(10,2) not null default 0,
  add column if not exists sales_debit numeric(10,2) not null default 0,
  add column if not exists sales_meal_voucher numeric(10,2) not null default 0,
  add column if not exists sales_other numeric(10,2) not null default 0,
  add column if not exists conferred_credit numeric(10,2),
  add column if not exists conferred_debit numeric(10,2),
  add column if not exists conferred_pix numeric(10,2),
  add column if not exists conferred_meal_voucher numeric(10,2),
  add column if not exists conferred_other numeric(10,2);

-- create_order_and_credit_cash: além de creditar sales_cash/sales_card/sales_pix
-- como já fazia, agora também grava o turno em orders.shift_id e passa a
-- separar o crédito do caixa por forma de pagamento em vez de somar
-- crédito+débito em sales_card (mantido apenas como espelho de compatibilidade
-- para turnos abertos antes desta migration).
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

  select id into v_shift_id from cash_shifts where status = 'aberto' limit 1;

  insert into orders (
    id, order_number, channel, table_number, customer, items, service_type,
    subtotal, delivery_fee, discount, total, payment_method, payment_status,
    order_status, prepared_at, delivered_at, tuna_transaction_id,
    delivery_driver_name, waiter_name, notes, fiscal_issued, nfce_key,
    split_payments, shift_id
  )
  select
    p_order->>'id', (p_order->>'orderNumber')::int, p_order->>'channel',
    nullif(p_order->>'tableNumber','')::int, p_order->'customer', p_order->'items',
    p_order->>'serviceType', (p_order->>'subtotal')::numeric, (p_order->>'deliveryFee')::numeric,
    (p_order->>'discount')::numeric, (p_order->>'total')::numeric, p_order->>'paymentMethod',
    p_order->>'paymentStatus', p_order->>'orderStatus', p_order->>'preparedAt', p_order->>'deliveredAt',
    p_order->>'tunaTransactionId', p_order->>'deliveryDriverName', p_order->>'waiterName',
    p_order->>'notes', (p_order->>'fiscalIssued')::boolean, p_order->>'nfceKey',
    p_split_payments, v_shift_id;

  if v_shift_id is not null then
    if p_split_payments is not null and jsonb_array_length(p_split_payments) > 0 then
      update cash_shifts set
        sales_cash = sales_cash + coalesce((
          select sum((elem->>'amount')::numeric) from jsonb_array_elements(p_split_payments) elem
          where elem->>'method' = 'dinheiro'
        ), 0),
        sales_credit = sales_credit + coalesce((
          select sum((elem->>'amount')::numeric) from jsonb_array_elements(p_split_payments) elem
          where elem->>'method' = 'cartao_credito'
        ), 0),
        sales_debit = sales_debit + coalesce((
          select sum((elem->>'amount')::numeric) from jsonb_array_elements(p_split_payments) elem
          where elem->>'method' = 'cartao_debito'
        ), 0),
        sales_card = sales_card + coalesce((
          select sum((elem->>'amount')::numeric) from jsonb_array_elements(p_split_payments) elem
          where elem->>'method' in ('cartao_credito', 'cartao_debito')
        ), 0),
        sales_pix = sales_pix + coalesce((
          select sum((elem->>'amount')::numeric) from jsonb_array_elements(p_split_payments) elem
          where elem->>'method' = 'pix'
        ), 0),
        sales_meal_voucher = sales_meal_voucher + coalesce((
          select sum((elem->>'amount')::numeric) from jsonb_array_elements(p_split_payments) elem
          where elem->>'method' = 'vale_refeicao'
        ), 0),
        sales_other = sales_other + coalesce((
          select sum((elem->>'amount')::numeric) from jsonb_array_elements(p_split_payments) elem
          where elem->>'method' not in ('dinheiro', 'cartao_credito', 'cartao_debito', 'pix', 'vale_refeicao')
        ), 0)
      where id = v_shift_id;
    elsif p_cash_amount is not null then
      update cash_shifts set
        sales_cash = sales_cash + case when p_payment_method = 'dinheiro' then p_cash_amount else 0 end,
        sales_credit = sales_credit + case when p_payment_method = 'cartao_credito' then p_cash_amount else 0 end,
        sales_debit = sales_debit + case when p_payment_method = 'cartao_debito' then p_cash_amount else 0 end,
        sales_card = sales_card + case when p_payment_method in ('cartao_credito','cartao_debito') then p_cash_amount else 0 end,
        sales_pix  = sales_pix  + case when p_payment_method = 'pix' then p_cash_amount else 0 end,
        sales_meal_voucher = sales_meal_voucher + case when p_payment_method = 'vale_refeicao' then p_cash_amount else 0 end,
        sales_other = sales_other + case when p_payment_method not in ('dinheiro','cartao_credito','cartao_debito','pix','vale_refeicao') then p_cash_amount else 0 end
      where id = v_shift_id;
    end if;
  end if;
end;
$$;
