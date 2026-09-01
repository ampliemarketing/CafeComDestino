-- Couvert: passa a ser um valor FIXO por comanda (não multiplica pelo número
-- de pessoas). Antes usava couvertQty ?? guestCount ?? 0, então uma comanda
-- de 2 pessoas com couvert de R$10 cobrava R$20. Agora é o valor configurado
-- (× couvertQty se alguém definir explicitamente, default 1).
--
-- Também passa a respeitar comanda.couvertApplied === false (garçom/gerente
-- removeu o couvert daquela comanda), igual já acontece com serviceFeeApplied.

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

  if coalesce(v_cfg.couvert_enabled, false)
     and coalesce((v_comanda->>'couvertApplied')::boolean, true) then
    v_couvert := round(coalesce(v_cfg.couvert_value, 0)
                       * coalesce((v_comanda->>'couvertQty')::numeric, 1), 2);
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

grant execute on function public.close_comanda_and_pay(text, text, jsonb, numeric, text, jsonb, text, text) to authenticated;
revoke execute on function public.close_comanda_and_pay(text, text, jsonb, numeric, text, jsonb, text, text) from public, anon;
