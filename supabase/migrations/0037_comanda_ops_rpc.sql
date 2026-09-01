-- ============================================================================
-- #03 + #06 do checklist de go-live — operações de comanda atômicas no servidor.
--
-- ANTES: addComandaItem / cancelComandaItem / setComandaCharge / transferComanda
-- faziam read-modify-write do JSON `comandas` inteiro a partir do estado local
-- do React. Dois garçons mexendo na mesma mesa ao mesmo tempo → a última
-- gravação sobrescreve a outra e o item some. E a baixa de estoque do
-- lançamento era uma segunda chamada, fora da transação (item #06).
--
-- DEPOIS: cada operação é uma RPC security definer que:
--   1. trava a(s) linha(s) de dining_tables com SELECT ... FOR UPDATE
--      (serializa gravações concorrentes na mesma mesa);
--   2. relê `comandas` já travado, aplica a mudança na comanda/item por id;
--   3. grava de volta e recalcula o status agregado da mesa;
--   4. no lançamento, dá baixa de estoque na MESMA transação.
--
-- Preço do item continua vindo do cliente (mesmo que hoje) — é re-validado
-- contra a tabela products no fechamento (create_order_and_credit_cash), que
-- segue sendo a fronteira de segurança de preço.
--
-- Aplicar junto com o deploy do frontend correspondente (AppContext passa a
-- chamar estas RPCs em vez de UPDATE direto). Seguro com caixa aberto.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. comanda_add_items — lança N linhas de item + baixa de estoque
-- ---------------------------------------------------------------------------
create or replace function public.comanda_add_items(
  p_table_id text,
  p_comanda_id text,
  p_items jsonb,
  p_stock_items jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_table dining_tables%rowtype;
  v_comanda jsonb;
  v_name text;
  v_now_label text := to_char(now() at time zone 'America/Sao_Paulo', 'HH24:MI');
  v_stamped jsonb;
  v_new_items jsonb;
  v_subtotal numeric;
  v_new_comandas jsonb;
  v_qty numeric;
begin
  if not public.has_any_permission(array['mesas.lancar_item']) then
    raise exception 'Sem permissão para lançar item na comanda.';
  end if;
  if coalesce(jsonb_array_length(p_items), 0) = 0 then
    raise exception 'Nenhum item para lançar.';
  end if;

  for v_qty in
    select coalesce((e->>'quantity')::numeric, 0) from jsonb_array_elements(p_items) e
  loop
    if v_qty <= 0 or v_qty > 100000 then
      raise exception 'Quantidade de item inválida (%).', v_qty;
    end if;
  end loop;

  perform 1 from dining_tables where id = p_table_id for update;
  select * into v_table from dining_tables where id = p_table_id;
  if not found then raise exception 'Mesa não encontrada.'; end if;

  select elem into v_comanda
  from jsonb_array_elements(v_table.comandas) elem
  where elem->>'id' = p_comanda_id;
  if v_comanda is null then raise exception 'Comanda não encontrada na mesa.'; end if;

  select name into v_name from profiles where id = auth.uid();

  -- Servidor carimba hora e garçom de cada linha (não confia no relógio do cliente).
  select coalesce(jsonb_agg(
    it || jsonb_build_object(
      'status', coalesce(it->>'status', 'ativo'),
      'createdAt', v_now_label,
      'waiterName', coalesce(v_name, 'Sistema'))
  ), '[]'::jsonb) into v_stamped
  from jsonb_array_elements(p_items) it;

  v_new_items := coalesce(v_comanda->'items', '[]'::jsonb) || v_stamped;

  select coalesce(sum((it->>'unitPrice')::numeric * (it->>'quantity')::numeric), 0) into v_subtotal
  from jsonb_array_elements(v_new_items) it
  where coalesce(it->>'status', 'ativo') <> 'cancelado';

  select jsonb_agg(
    case when elem->>'id' = p_comanda_id
      then elem || jsonb_build_object('items', v_new_items, 'subtotal', v_subtotal)
      else elem end
  ) into v_new_comandas
  from jsonb_array_elements(v_table.comandas) elem;

  update dining_tables
    set comandas = v_new_comandas, status = public.compute_table_status(v_new_comandas)
  where id = p_table_id;

  perform public.deduct_stock_for_items(p_stock_items);

  perform public.write_audit_log(
    'Lançamento de Item na Comanda', 'Mesas', 'comanda', p_comanda_id,
    null, v_subtotal,
    jsonb_build_object('tableId', p_table_id, 'tableNumber', v_table.number,
                       'lines', jsonb_array_length(v_stamped)));
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. comanda_cancel_item — marca item como cancelado + repõe estoque
-- ---------------------------------------------------------------------------
create or replace function public.comanda_cancel_item(
  p_table_id text,
  p_comanda_id text,
  p_item_id text,
  p_reason text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_table dining_tables%rowtype;
  v_comanda jsonb;
  v_item jsonb;
  v_new_items jsonb;
  v_subtotal numeric;
  v_new_comandas jsonb;
begin
  if not public.has_any_permission(array['mesas.cancelar_item']) then
    raise exception 'Sem permissão para cancelar item de comanda.';
  end if;
  if coalesce(trim(coalesce(p_reason, '')), '') = '' then
    raise exception 'Informe o motivo do cancelamento.';
  end if;

  perform 1 from dining_tables where id = p_table_id for update;
  select * into v_table from dining_tables where id = p_table_id;
  if not found then raise exception 'Mesa não encontrada.'; end if;

  select elem into v_comanda
  from jsonb_array_elements(v_table.comandas) elem
  where elem->>'id' = p_comanda_id;
  if v_comanda is null then raise exception 'Comanda não encontrada na mesa.'; end if;

  select elem into v_item
  from jsonb_array_elements(coalesce(v_comanda->'items', '[]'::jsonb)) elem
  where elem->>'id' = p_item_id;
  if v_item is null then raise exception 'Item não encontrado na comanda.'; end if;
  if coalesce(v_item->>'status', 'ativo') = 'cancelado' then
    return; -- já cancelado, no-op idempotente
  end if;

  select coalesce(jsonb_agg(
    case when it->>'id' = p_item_id then it || jsonb_build_object('status', 'cancelado') else it end
  ), '[]'::jsonb) into v_new_items
  from jsonb_array_elements(coalesce(v_comanda->'items', '[]'::jsonb)) it;

  select coalesce(sum((it->>'unitPrice')::numeric * (it->>'quantity')::numeric), 0) into v_subtotal
  from jsonb_array_elements(v_new_items) it
  where coalesce(it->>'status', 'ativo') <> 'cancelado';

  select jsonb_agg(
    case when elem->>'id' = p_comanda_id
      then elem || jsonb_build_object('items', v_new_items, 'subtotal', v_subtotal)
      else elem end
  ) into v_new_comandas
  from jsonb_array_elements(v_table.comandas) elem;

  update dining_tables
    set comandas = v_new_comandas, status = public.compute_table_status(v_new_comandas)
  where id = p_table_id;

  -- Repõe o estoque baixado no lançamento (cortesia não baixou, então não repõe).
  if coalesce((v_item->>'isCourtesy')::boolean, false) = false then
    perform public.reverse_stock_for_items(jsonb_build_array(jsonb_build_object(
      'productId', v_item->>'productId',
      'quantity', (v_item->>'quantity')::numeric)));
  end if;

  perform public.write_audit_log(
    'Cancelamento de Item de Comanda', 'Mesas', 'comanda', p_comanda_id,
    null, v_subtotal,
    jsonb_build_object('tableNumber', v_table.number, 'productName', v_item->>'productName',
                       'quantity', v_item->>'quantity', 'reason', trim(p_reason)));
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. comanda_set_charge — liga/desliga taxa de serviço OU couvert da comanda
-- ---------------------------------------------------------------------------
create or replace function public.comanda_set_charge(
  p_table_id text,
  p_comanda_id text,
  p_charge text,       -- 'serviceFee' | 'couvert'
  p_applied boolean,
  p_reason text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_table dining_tables%rowtype;
  v_comanda jsonb;
  v_name text;
  v_patch jsonb;
  v_new_comandas jsonb;
begin
  if p_charge not in ('serviceFee', 'couvert') then
    raise exception 'Tipo de cobrança inválido.';
  end if;
  -- Remover exige permissão; reativar (voltar ao padrão) é livre para quem edita.
  if not p_applied and not public.has_any_permission(array['mesas.remover_taxa_servico']) then
    raise exception 'Sem permissão para remover a %.',
      case when p_charge = 'serviceFee' then 'taxa de serviço' else 'couvert' end;
  end if;

  perform 1 from dining_tables where id = p_table_id for update;
  select * into v_table from dining_tables where id = p_table_id;
  if not found then raise exception 'Mesa não encontrada.'; end if;

  select elem into v_comanda
  from jsonb_array_elements(v_table.comandas) elem
  where elem->>'id' = p_comanda_id;
  if v_comanda is null then raise exception 'Comanda não encontrada na mesa.'; end if;

  select name into v_name from profiles where id = auth.uid();

  if p_charge = 'serviceFee' then
    v_patch := jsonb_build_object(
      'serviceFeeApplied', p_applied,
      'serviceFeeRemovedBy', case when p_applied then null else coalesce(v_name, 'Sistema') end,
      'serviceFeeRemovedReason', case when p_applied then null else nullif(trim(coalesce(p_reason, '')), '') end);
  else
    v_patch := jsonb_build_object(
      'couvertApplied', p_applied,
      'couvertRemovedBy', case when p_applied then null else coalesce(v_name, 'Sistema') end,
      'couvertRemovedReason', case when p_applied then null else nullif(trim(coalesce(p_reason, '')), '') end);
  end if;

  select jsonb_agg(
    case when elem->>'id' = p_comanda_id then elem || v_patch else elem end
  ) into v_new_comandas
  from jsonb_array_elements(v_table.comandas) elem;

  update dining_tables set comandas = v_new_comandas where id = p_table_id;

  perform public.write_audit_log(
    (case when p_applied then 'Reativação' else 'Remoção' end) || ' de ' ||
      (case when p_charge = 'serviceFee' then 'Taxa de Serviço' else 'Couvert' end),
    'Mesas', 'comanda', p_comanda_id, null, null,
    jsonb_build_object('tableNumber', v_table.number, 'personName', v_comanda->>'personName',
                       'reason', nullif(trim(coalesce(p_reason, '')), '')));
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. comanda_transfer — move uma comanda inteira entre mesas
-- ---------------------------------------------------------------------------
create or replace function public.comanda_transfer(
  p_from_table_id text,
  p_comanda_id text,
  p_to_table_id text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_from dining_tables%rowtype;
  v_to dining_tables%rowtype;
  v_comanda jsonb;
  v_from_comandas jsonb;
  v_to_comandas jsonb;
begin
  if not public.has_any_permission(array['mesas.transferir']) then
    raise exception 'Sem permissão para transferir comanda.';
  end if;
  if p_from_table_id = p_to_table_id then
    raise exception 'Mesa de origem e destino são a mesma.';
  end if;

  -- Trava as duas mesas em ordem estável de id (evita deadlock entre
  -- transferências cruzadas simultâneas A→B e B→A).
  perform 1 from dining_tables where id in (p_from_table_id, p_to_table_id) order by id for update;

  select * into v_from from dining_tables where id = p_from_table_id;
  if not found then raise exception 'Mesa de origem não encontrada.'; end if;
  select * into v_to from dining_tables where id = p_to_table_id;
  if not found then raise exception 'Mesa de destino não encontrada.'; end if;

  select elem into v_comanda
  from jsonb_array_elements(v_from.comandas) elem
  where elem->>'id' = p_comanda_id;
  if v_comanda is null then raise exception 'Comanda não encontrada na mesa de origem.'; end if;

  v_to_comandas := coalesce(v_to.comandas, '[]'::jsonb) || jsonb_build_array(v_comanda);
  select coalesce(jsonb_agg(elem), '[]'::jsonb) into v_from_comandas
  from jsonb_array_elements(v_from.comandas) elem
  where elem->>'id' <> p_comanda_id;

  update dining_tables
    set comandas = v_to_comandas, status = public.compute_table_status(v_to_comandas)
  where id = p_to_table_id;
  update dining_tables
    set comandas = v_from_comandas, status = public.compute_table_status(v_from_comandas)
  where id = p_from_table_id;

  perform public.write_audit_log(
    'Transferência de Comanda', 'Atendimento', 'comanda', p_comanda_id, null, null,
    jsonb_build_object('personName', v_comanda->>'personName',
                       'fromTable', v_from.number, 'toTable', v_to.number));
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Grants
-- ---------------------------------------------------------------------------
grant execute on function public.comanda_add_items(text, text, jsonb, jsonb) to authenticated;
grant execute on function public.comanda_cancel_item(text, text, text, text) to authenticated;
grant execute on function public.comanda_set_charge(text, text, text, boolean, text) to authenticated;
grant execute on function public.comanda_transfer(text, text, text) to authenticated;

revoke execute on function public.comanda_add_items(text, text, jsonb, jsonb) from public, anon;
revoke execute on function public.comanda_cancel_item(text, text, text, text) from public, anon;
revoke execute on function public.comanda_set_charge(text, text, text, boolean, text) from public, anon;
revoke execute on function public.comanda_transfer(text, text, text) from public, anon;
