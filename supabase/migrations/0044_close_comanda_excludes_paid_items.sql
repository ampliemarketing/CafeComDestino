-- ============================================================================
-- Fechamento da comanda deixa de relistar os itens já quitados por
-- "adiantamento por produto".
--
-- ANTES: close_comanda_and_pay (migration 0035) passava TODOS os itens da
-- comanda para o pedido (jsonb_set(p_order,'{items}', v_comanda->'items')) e
-- descontava o valor adiantado como "já pago". O comprovante final saía
-- relistando produtos que outra pessoa já tinha pago e levado o comprovante.
--
-- DEPOIS: só os itens ainda em aberto (isPaid <> true) entram no pedido/
-- comprovante. O valor já adiantado que corresponde a esses itens pagos deixa
-- de ser subtraído de novo (senão seria descontado duas vezes); adiantamentos
-- "por valor" continuam sendo abatidos normalmente.
--
-- Matemática (itens=100, A adianta itens de 30 + taxa 3; B adianta 20 por valor):
--   v_advances_items = (33-3) + 20 = 50
--   v_paid_items_value = 30
--   itens no comprovante = 70 ; já_pago repassado = 50 - 30 = 20
--   total = 70 + taxa(7) + couvert(0) - 20 - desconto  → mesmo valor de antes,
--   só que o comprovante lista R$ 70 em itens em vez de R$ 100.
--
-- Estorno de adiantamento (reverse_partial_payment, 0027) já volta isPaid=false
-- nos itens, então um item estornado reaparece no comprovante automaticamente.
--
-- Seguro de aplicar com o caixa aberto: só reescreve close_comanda_and_pay,
-- que continua retornando void e com a mesma assinatura.
-- ============================================================================

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
  v_adv_service numeric;
  v_adv_couvert numeric;
  v_advances_items numeric;
  v_paid_items_value numeric;
  v_items_subtotal numeric;
  v_open_items jsonb;
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

  select coalesce(sum((adv->>'amount')::numeric), 0),
         coalesce(sum(coalesce((adv->>'serviceFeePortion')::numeric, 0)), 0),
         coalesce(sum(coalesce((adv->>'couvertPortion')::numeric, 0)), 0)
    into v_advances_total, v_adv_service, v_adv_couvert
  from jsonb_array_elements(coalesce(v_comanda->'advancePayments', '[]'::jsonb)) adv
  where adv->>'status' = 'ativo';

  v_advances_items := greatest(0, v_advances_total - v_adv_service - v_adv_couvert);

  -- Base do % de taxa de serviço = subtotal de TODOS os itens não cancelados
  -- (inclusive os já pagos: a taxa incide sobre o consumo inteiro da comanda).
  select coalesce(sum((it->>'unitPrice')::numeric * (it->>'quantity')::numeric), 0) into v_items_subtotal
  from jsonb_array_elements(coalesce(v_comanda->'items', '[]'::jsonb)) it
  where coalesce(it->>'status', 'ativo') <> 'cancelado';

  -- Valor dos itens já quitados via adiantamento "por produto".
  select coalesce(sum((it->>'unitPrice')::numeric * (it->>'quantity')::numeric), 0) into v_paid_items_value
  from jsonb_array_elements(coalesce(v_comanda->'items', '[]'::jsonb)) it
  where coalesce(it->>'status', 'ativo') <> 'cancelado'
    and coalesce((it->>'isPaid')::boolean, false) = true;

  -- Itens que ENTRAM no comprovante final: os ainda em aberto. Cancelados
  -- seguem no array (create_order_and_credit_cash os ignora no subtotal, mas
  -- mantê-los preserva o histórico do pedido).
  select coalesce(jsonb_agg(it), '[]'::jsonb) into v_open_items
  from jsonb_array_elements(coalesce(v_comanda->'items', '[]'::jsonb)) it
  where coalesce((it->>'isPaid')::boolean, false) = false;

  select service_fee_percent, service_fee_enabled, couvert_value, couvert_enabled
    into v_cfg
  from company_profile where id = true;

  if coalesce(v_cfg.service_fee_enabled, false)
     and coalesce((v_comanda->>'serviceFeeApplied')::boolean, true) then
    v_service_fee := greatest(0, round(v_items_subtotal * coalesce(v_cfg.service_fee_percent, 0) / 100, 2) - v_adv_service);
  end if;

  if coalesce(v_cfg.couvert_enabled, false)
     and coalesce((v_comanda->>'couvertApplied')::boolean, true) then
    v_couvert := greatest(0, round(coalesce(v_cfg.couvert_value, 0)
                                   * coalesce((v_comanda->>'couvertQty')::numeric, 1), 2) - v_adv_couvert);
  end if;

  perform public.create_order_and_credit_cash(
    jsonb_set(p_order, '{items}', v_open_items),
    p_cash_amount,
    p_payment_method,
    '[]'::jsonb,
    p_split_payments,
    greatest(0, round(v_advances_items - v_paid_items_value, 2)),
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
