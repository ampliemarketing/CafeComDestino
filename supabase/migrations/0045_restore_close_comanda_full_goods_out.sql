-- ============================================================================
-- Reverte, no lado do banco, a exclusão de itens já pagos por adiantamento
-- "por produto" que a migration 0044 introduziu no close_comanda_and_pay.
--
-- BUG da 0044: ao remover os itens com isPaid=true do pedido de fechamento,
-- a linha 'saida_mercadoria' passou a valer só o menu dos itens EM ABERTO
-- (ex.: R$ 25), mas as linhas de 'adiantamento' desses itens continuam
-- contando na "Conferência (mercadoria × pagamento)" do livro-caixa. Sem a
-- saída de mercadoria correspondente o "Saldo conf." nunca zera — ficou
-- R$ 35 pendurado num turno com uma comanda paga em vários adiantamentos.
--
-- Numérico (comida R$ 60, couvert R$ 15, adiantamentos R$ 55, venda final R$ 5):
--   0044:  55 + 5 − 25 = 35  (errado)
--   0045:  55 + 5 − 60 = 0   (correto — toda a mercadoria saiu)
--
-- Esta migration restaura o corpo do close_comanda_and_pay da migration 0035:
-- o pedido de fechamento volta a carregar TODOS os itens da comanda e a
-- 'saida_mercadoria' volta a ser o valor de menu completo. Descontar o já
-- adiantado continua sendo feito via p_already_paid = valor de itens dos
-- adiantamentos ativos.
--
-- O "não listar item já pago no cupom de fechamento" continua funcionando —
-- isso é feito no frontend (newOrder.items filtrado + linha "ADIANTAMENTO
-- PAGO" no PrintReceiptModal), não depende do servidor.
--
-- Seguro de aplicar com o caixa aberto: mesma assinatura, retorna void, não
-- muda o valor cobrado do cliente (só a linha de saída de mercadoria no
-- livro-caixa volta ao valor certo).
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

  select coalesce(sum((adv->>'amount')::numeric), 0),
         coalesce(sum(coalesce((adv->>'serviceFeePortion')::numeric, 0)), 0),
         coalesce(sum(coalesce((adv->>'couvertPortion')::numeric, 0)), 0)
    into v_advances_total, v_adv_service, v_adv_couvert
  from jsonb_array_elements(coalesce(v_comanda->'advancePayments', '[]'::jsonb)) adv
  where adv->>'status' = 'ativo';

  v_advances_items := greatest(0, v_advances_total - v_adv_service - v_adv_couvert);

  select coalesce(sum((it->>'unitPrice')::numeric * (it->>'quantity')::numeric), 0) into v_items_subtotal
  from jsonb_array_elements(coalesce(v_comanda->'items', '[]'::jsonb)) it
  where coalesce(it->>'status', 'ativo') <> 'cancelado';

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

  -- Pedido de fechamento carrega TODOS os itens da comanda (inclusive os já
  -- quitados por adiantamento por produto): a saida_mercadoria em
  -- create_order_and_credit_cash precisa do menu completo para o livro-caixa
  -- fechar em zero. O que já foi adiantado é abatido via p_already_paid.
  perform public.create_order_and_credit_cash(
    jsonb_set(p_order, '{items}', coalesce(v_comanda->'items', '[]'::jsonb)),
    p_cash_amount,
    p_payment_method,
    '[]'::jsonb,
    p_split_payments,
    v_advances_items,
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
