-- ============================================================================
-- #05 do checklist de go-live — ajuste de estoque atômico.
--
-- ANTES: recordStockEntry / recordProductStockEntry / recordLoss /
-- recordCourtesy liam stockQuantity no cliente, somavam no JS e gravavam o
-- total (`stock_quantity: p.stockQuantity - qtd`). Duas movimentações
-- simultâneas no mesmo item → uma sobrescreve a outra (lost update), e o valor
-- "da tela" pode já estar velho.
--
-- DEPOIS: RPC que faz `stock_quantity = greatest(0, stock_quantity ± qtd)`
-- dentro do banco — o Postgres trava a linha durante o UPDATE, então chamadas
-- concorrentes entram em fila e cada uma soma sobre o valor real. Mesmo
-- padrão que deduct_stock_for_items (venda) já usa.
--
-- p_op decide direção e permissão exigida:
--   'entrada'  -> +qtd, exige estoque.entrada (e atualiza avg_cost_unit do insumo)
--   'perda'    -> -qtd, exige estoque.perda
--   'cortesia' -> -qtd, exige estoque.cortesia OU mesas.cortesia
--
-- Seguro de aplicar com caixa aberto.
-- ============================================================================

create or replace function public.adjust_stock(
  p_op text,
  p_item_type text,
  p_id text,
  p_qty numeric,
  p_cost_unit numeric default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_dir int;
begin
  if p_op not in ('entrada', 'perda', 'cortesia') then
    raise exception 'Operação de estoque inválida (%).', p_op;
  end if;
  if p_item_type not in ('product', 'ingredient') then
    raise exception 'Tipo de item inválido (%).', p_item_type;
  end if;
  if p_qty is null or p_qty <= 0 or p_qty > 1000000 then
    raise exception 'Quantidade de estoque inválida (%).', p_qty;
  end if;

  if p_op = 'entrada' then
    if not public.has_any_permission(array['estoque.entrada']) then
      raise exception 'Sem permissão para dar entrada de estoque.';
    end if;
    v_dir := 1;
  elsif p_op = 'perda' then
    if not public.has_any_permission(array['estoque.perda']) then
      raise exception 'Sem permissão para registrar perda de estoque.';
    end if;
    v_dir := -1;
  else
    if not public.has_any_permission(array['estoque.cortesia', 'mesas.cortesia']) then
      raise exception 'Sem permissão para registrar cortesia.';
    end if;
    v_dir := -1;
  end if;

  if p_item_type = 'product' then
    update products
      set stock_quantity = greatest(0, stock_quantity + v_dir * p_qty)
    where id = p_id;
    if not found then
      raise exception 'Produto % não encontrado — ajuste de estoque rejeitado.', p_id;
    end if;
  else
    update ingredients
      set stock_quantity = greatest(0, stock_quantity + v_dir * p_qty),
          avg_cost_unit = case
            when p_op = 'entrada' and coalesce(p_cost_unit, 0) > 0 then p_cost_unit
            else avg_cost_unit
          end
    where id = p_id;
    if not found then
      raise exception 'Insumo % não encontrado — ajuste de estoque rejeitado.', p_id;
    end if;
  end if;
end;
$$;

grant execute on function public.adjust_stock(text, text, text, numeric, numeric) to authenticated;
revoke execute on function public.adjust_stock(text, text, text, numeric, numeric) from public, anon;
