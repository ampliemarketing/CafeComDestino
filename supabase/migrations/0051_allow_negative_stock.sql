-- ============================================================================
-- Permite que o estoque fique NEGATIVO em vez de travar em zero.
--
-- Antes, deduct_stock_for_items / reverse_stock_for_items / adjust_stock
-- usavam `greatest(0, stock_quantity ± qtd)`, então vender (ou registrar
-- perda/cortesia) além do que existia em estoque simplesmente zerava a
-- quantidade — escondendo o quanto realmente faltou. Isso também quebrava o
-- estorno: se o estoque já estava negativo e um item era cancelado/estornado,
-- o "+ qtd" ficava sujeito ao mesmo piso de zero, quando na verdade deveria
-- só reduzir o negativo (ex.: -5 + 1 = -4, não max(0, -4) = 0).
--
-- Agora a conta é sempre `stock_quantity ± qtd`, sem piso. Estoque negativo
-- aparece normalmente nas telas de Estoque e no sino de notificações
-- (qualquer item com stock_quantity <= min_stock já entra no alerta, e
-- negativo sempre é <= min_stock).
-- ============================================================================

create or replace function public.deduct_stock_for_items(
  p_items jsonb
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  item record;
  ts record;
  ing record;
begin
  for item in
    select (elem->>'productId') as product_id, (elem->>'quantity')::numeric as quantity
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as elem
  loop
    update products set stock_quantity = stock_quantity - item.quantity
    where id = item.product_id and track_stock = true;

    select * into ts from technical_sheets where product_id = item.product_id;
    if found then
      for ing in
        select (u->>'ingredientId') as ingredient_id, (u->>'quantityUsed')::numeric as qty_used
        from jsonb_array_elements(ts.ingredients) as u
      loop
        update ingredients set stock_quantity = stock_quantity - ing.qty_used * item.quantity
        where id = ing.ingredient_id;
      end loop;
    end if;
  end loop;
end;
$$;

create or replace function public.reverse_stock_for_items(
  p_items jsonb
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  item record;
  ts record;
  ing record;
begin
  for item in
    select (elem->>'productId') as product_id, (elem->>'quantity')::numeric as quantity
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as elem
  loop
    update products set stock_quantity = stock_quantity + item.quantity
    where id = item.product_id and track_stock = true;

    select * into ts from technical_sheets where product_id = item.product_id;
    if found then
      for ing in
        select (u->>'ingredientId') as ingredient_id, (u->>'quantityUsed')::numeric as qty_used
        from jsonb_array_elements(ts.ingredients) as u
      loop
        update ingredients set stock_quantity = stock_quantity + ing.qty_used * item.quantity
        where id = ing.ingredient_id;
      end loop;
    end if;
  end loop;
end;
$$;

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
      set stock_quantity = stock_quantity + v_dir * p_qty
    where id = p_id;
    if not found then
      raise exception 'Produto % não encontrado — ajuste de estoque rejeitado.', p_id;
    end if;
  else
    update ingredients
      set stock_quantity = stock_quantity + v_dir * p_qty,
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

grant execute on function public.deduct_stock_for_items(jsonb) to authenticated;
revoke execute on function public.deduct_stock_for_items(jsonb) from public, anon;

grant execute on function public.reverse_stock_for_items(jsonb) to authenticated;
revoke execute on function public.reverse_stock_for_items(jsonb) from public, anon;

grant execute on function public.adjust_stock(text, text, text, numeric, numeric) to authenticated;
revoke execute on function public.adjust_stock(text, text, text, numeric, numeric) from public, anon;
