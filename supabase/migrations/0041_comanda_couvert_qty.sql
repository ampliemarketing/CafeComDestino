-- ============================================================================
-- Permite cobrar MAIS DE UM couvert numa mesma comanda (ex.: uma comanda que
-- representa um grupo de 3 pessoas → 3 couverts).
--
-- O multiplicador `couvertQty` do JSON da comanda já era respeitado pelo
-- cálculo (lib/serviceFee.ts) e pelo fechamento (close_comanda_and_pay,
-- migration 0035) — só faltava um jeito de definir esse valor. Esta RPC faz
-- isso de forma atômica (mesma trava FOR UPDATE das outras operações de
-- comanda da migration 0037).
--
-- Definir a quantidade também reativa o couvert (limpa o couvertApplied=false),
-- já que a intenção é cobrar.
--
-- Seguro de aplicar com caixa aberto.
-- ============================================================================

create or replace function public.comanda_set_couvert_qty(
  p_table_id text,
  p_comanda_id text,
  p_qty integer
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_table dining_tables%rowtype;
  v_comanda jsonb;
  v_new_comandas jsonb;
begin
  if not public.has_any_permission(array['mesas.lancar_item']) then
    raise exception 'Sem permissão para alterar o couvert da comanda.';
  end if;
  if p_qty is null or p_qty < 1 or p_qty > 50 then
    raise exception 'Quantidade de couvert inválida (%). Use de 1 a 50.', p_qty;
  end if;

  perform 1 from dining_tables where id = p_table_id for update;
  select * into v_table from dining_tables where id = p_table_id;
  if not found then raise exception 'Mesa não encontrada.'; end if;

  select elem into v_comanda
  from jsonb_array_elements(v_table.comandas) elem
  where elem->>'id' = p_comanda_id;
  if v_comanda is null then raise exception 'Comanda não encontrada na mesa.'; end if;

  select jsonb_agg(
    case when elem->>'id' = p_comanda_id
      then elem || jsonb_build_object(
        'couvertQty', p_qty,
        'couvertApplied', true,
        'couvertRemovedBy', null,
        'couvertRemovedReason', null)
      else elem end
  ) into v_new_comandas
  from jsonb_array_elements(v_table.comandas) elem;

  update dining_tables set comandas = v_new_comandas where id = p_table_id;

  perform public.write_audit_log(
    'Ajuste de Quantidade de Couvert', 'Mesas', 'comanda', p_comanda_id, null, p_qty,
    jsonb_build_object('tableNumber', v_table.number, 'personName', v_comanda->>'personName', 'couvertQty', p_qty));
end;
$$;

grant execute on function public.comanda_set_couvert_qty(text, text, integer) to authenticated;
revoke execute on function public.comanda_set_couvert_qty(text, text, integer) from public, anon;
