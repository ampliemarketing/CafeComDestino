-- ============================================================================
-- Corrige o teto de couvert adiantável em credit_partial_payment (0035): ele
-- comparava a soma já adiantada contra `company_profile.couvert_value` (valor
-- de UMA pessoa), nunca multiplicado por `couvertQty` da comanda.
--
-- Efeito do bug: numa comanda com couvert para várias pessoas (ex: 3 pessoas
-- x R$8 = R$24 devidos), o adiantamento de couvert nunca podia passar de R$8
-- de uma vez — a mesma trava disparava mesmo estando corretíssimo pedir os
-- R$24, obrigando o couvert inteiro a sobrar sempre para o fechamento final.
-- Não gerava perda de dinheiro (o fechamento cobra a diferença certa), mas
-- entrava em conflito com comandaCouvert() do frontend, que já usa
-- couvertValue × couvertQty como total devido.
--
-- Corpo idêntico à migration 0035, só troca a comparação do teto de couvert
-- (v_couvert_value passa a ser multiplicado por couvertQty da comanda).
-- ============================================================================

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
  v_service_portion numeric := round(greatest(0, coalesce((p_payment->>'serviceFeePortion')::numeric, 0)), 2);
  v_couvert_portion numeric := round(greatest(0, coalesce((p_payment->>'couvertPortion')::numeric, 0)), 2);
  v_item_portion numeric;
  v_couvert_value numeric;
  v_couvert_already numeric;
  v_shift_id text;
  v_pay_id text := coalesce(p_payment->>'id', 'adv-' || (extract(epoch from now()) * 1000)::bigint);
  v_paid_at text := to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY, HH24:MI:SS');
  v_name text;
  v_person text;
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
  v_person := coalesce(v_comanda->>'personName', 'comanda');

  select id into v_shift_id from cash_shifts where status = 'aberto' limit 1;
  if v_shift_id is null then raise exception 'Nenhum caixa aberto.'; end if;

  v_item_portion := round(v_amount - v_service_portion - v_couvert_portion, 2);

  select coalesce(sum((it->>'unitPrice')::numeric * (it->>'quantity')::numeric), 0) into v_consumed
  from jsonb_array_elements(coalesce(v_comanda->'items', '[]'::jsonb)) it
  where coalesce(it->>'status', 'ativo') <> 'cancelado';

  -- parte de ITENS já adiantada (amount - parcelas de taxa/couvert)
  select coalesce(sum((adv->>'amount')::numeric
                      - coalesce((adv->>'serviceFeePortion')::numeric, 0)
                      - coalesce((adv->>'couvertPortion')::numeric, 0)), 0),
         coalesce(sum(coalesce((adv->>'couvertPortion')::numeric, 0)), 0)
    into v_advanced, v_couvert_already
  from jsonb_array_elements(coalesce(v_comanda->'advancePayments', '[]'::jsonb)) adv
  where adv->>'status' = 'ativo';

  v_remaining := greatest(0, v_consumed - v_advanced);

  if v_amount is null or v_amount <= 0 then
    raise exception 'Valor de adiantamento inválido.';
  end if;
  if v_item_portion < -0.05 or v_item_portion > v_remaining + 0.05 then
    raise exception 'Valor de itens do adiantamento (R$ %) acima do saldo restante (R$ %).', v_item_portion, v_remaining;
  end if;

  if v_couvert_portion > 0 then
    select couvert_value into v_couvert_value from company_profile where id = true;
    -- Total devido de couvert = valor por pessoa × couvertQty da comanda (default 1),
    -- mesma conta de comandaCouvert() no frontend — não só o valor de 1 pessoa.
    v_couvert_value := coalesce(v_couvert_value, 0) * coalesce((v_comanda->>'couvertQty')::numeric, 1);
    if coalesce(v_couvert_already, 0) + v_couvert_portion > v_couvert_value + 0.05 then
      raise exception 'Couvert já foi adiantado nesta comanda.';
    end if;
  end if;

  v_remaining_after := greatest(0, v_remaining - v_item_portion);

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
    'amount', v_amount, 'serviceFeePortion', v_service_portion, 'couvertPortion', v_couvert_portion,
    'paymentMethod', p_payment->>'paymentMethod', 'splitPayments', p_payment->'splitPayments',
    'type', coalesce(p_payment->>'type', 'by_amount'), 'itemIdsPaid', v_paid_ids,
    'paidItemsDetails', coalesce(p_payment->'paidItemsDetails', '[]'::jsonb),
    'customerName', coalesce(p_payment->>'customerName', v_person),
    'paidAt', v_paid_at, 'userName', coalesce(v_name, 'Sistema'), 'notes', p_payment->>'notes',
    'status', 'ativo', 'remainingBalanceAfter', v_remaining_after);

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

  -- Linhas do livro-caixa: itens -> adiantamento; taxa -> taxa_servico; couvert -> couvert.
  if v_item_portion > 0 then
    for a in select * from jsonb_array_elements(public._alloc_by_split(v_split, v_item_portion))
    loop
      perform public._cash_ledger_add(v_shift_id, 'adiantamento', 'entrada', a->>'method',
        (a->>'amount')::numeric, null, p_comanda_id, v_table.number::text, null,
        coalesce(nullif(trim(coalesce(p_payment->>'notes', '')), ''), 'Adiantamento - ' || v_person),
        jsonb_build_object('partialPaymentId', v_pay_id, 'personName', v_person, 'tableNumber', v_table.number));
    end loop;
  end if;
  if v_service_portion > 0 then
    for a in select * from jsonb_array_elements(public._alloc_by_split(v_split, v_service_portion))
    loop
      perform public._cash_ledger_add(v_shift_id, 'taxa_servico', 'entrada', a->>'method',
        (a->>'amount')::numeric, null, p_comanda_id, v_table.number::text, null,
        'Taxa de serviço (adiantamento) - ' || v_person,
        jsonb_build_object('partialPaymentId', v_pay_id, 'tableNumber', v_table.number));
    end loop;
  end if;
  if v_couvert_portion > 0 then
    for a in select * from jsonb_array_elements(public._alloc_by_split(v_split, v_couvert_portion))
    loop
      perform public._cash_ledger_add(v_shift_id, 'couvert', 'entrada', a->>'method',
        (a->>'amount')::numeric, null, p_comanda_id, v_table.number::text, null,
        'Couvert (adiantamento) - ' || v_person,
        jsonb_build_object('partialPaymentId', v_pay_id, 'tableNumber', v_table.number));
    end loop;
  end if;

  perform public.write_audit_log('Adiantamento Parcial de Comanda', 'Atendimento / Caixa', 'comanda', p_comanda_id,
    null, v_amount, jsonb_build_object('tableNumber', v_table.number, 'personName', v_person,
      'partialPaymentId', v_pay_id, 'serviceFeePortion', v_service_portion, 'couvertPortion', v_couvert_portion));

  return v_new_advance;
end;
$$;

grant execute on function public.credit_partial_payment(text, text, jsonb) to authenticated;
revoke execute on function public.credit_partial_payment(text, text, jsonb) from public, anon;
