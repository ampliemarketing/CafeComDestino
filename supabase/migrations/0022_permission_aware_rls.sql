-- Corrige o achado CRÍTICO da auditoria de segurança: as tabelas
-- orders, cash_movements, cash_shifts, products, dining_tables (e as
-- de catálogo/config abaixo) só tinham uma policy "authenticated_all_*"
-- (FOR ALL USING auth.role() = 'authenticated') — ou seja, QUALQUER
-- funcionário logado, de qualquer cargo, sem nenhuma permissão marcada,
-- podia escrever direto nessas tabelas via supabase-js, ignorando
-- completamente o sistema de permissões granular (profiles.permissions
-- / hasPermission() do frontend) e contornando a validação server-side
-- das funções RPC (create_order_and_credit_cash, close_comanda_and_pay,
-- add_cash_movement).
--
-- Cada policy nova abaixo foi mapeada 1:1 contra os pontos reais de
-- escrita direta encontrados em src/context/AppContext.tsx (não é uma
-- suposição) — a permissão exigida é a mesma que o componente que chama
-- aquela escrita já checa no frontend com hasPermission()/can().
--
-- orders e cash_movements nunca são inseridos/deletados direto pelo
-- cliente (só via RPC, que roda como dono da função e não passa pelas
-- policies de RLS) — por isso ficam sem policy de INSERT/DELETE
-- (default deny). cash_movements não tem nenhuma escrita direta no
-- frontend, então fica só com SELECT.

create or replace function public.has_any_permission(keys text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.active
      and (p.role = 'admin' or p.permissions && keys)
  );
$$;

grant execute on function public.has_any_permission(text[]) to authenticated;

-- ---------- orders ----------
drop policy if exists authenticated_all_orders on public.orders;

create policy authenticated_select_orders on public.orders
  for select using (auth.role() = 'authenticated');

create policy permission_update_orders on public.orders
  for update
  using (public.has_any_permission(array[
    'kitchen.avancar_status', 'entregas.despachar', 'vendas.emitir_nfce',
    'vendas.acessar', 'online_menu.acessar'
  ]))
  with check (public.has_any_permission(array[
    'kitchen.avancar_status', 'entregas.despachar', 'vendas.emitir_nfce',
    'vendas.acessar', 'online_menu.acessar'
  ]));

-- ---------- cash_movements (só leitura direta; escrita é 100% via RPC) ----------
drop policy if exists authenticated_all_cash_movements on public.cash_movements;

create policy authenticated_select_cash_movements on public.cash_movements
  for select using (auth.role() = 'authenticated');

-- ---------- cash_shifts ----------
drop policy if exists authenticated_all_cash_shifts on public.cash_shifts;

create policy authenticated_select_cash_shifts on public.cash_shifts
  for select using (auth.role() = 'authenticated');

create policy permission_insert_cash_shifts on public.cash_shifts
  for insert
  with check (public.has_any_permission(array['caixas.abrir']));

-- UPDATE também é usado por addPartialPayment (mesas.pagamento_parcial)
-- pra somar o valor do adiantamento nos totais do turno.
create policy permission_update_cash_shifts on public.cash_shifts
  for update
  using (public.has_any_permission(array['caixas.fechar', 'mesas.pagamento_parcial']))
  with check (public.has_any_permission(array['caixas.fechar', 'mesas.pagamento_parcial']));

-- ---------- products (SELECT público já existe via public_read_products) ----------
drop policy if exists authenticated_all_products on public.products;

create policy permission_insert_products on public.products
  for insert
  with check (public.has_any_permission(array['produtos.criar']));

-- UPDATE cobre tanto edição de cadastro (produtos.editar) quanto ajustes
-- de estoque_quantity feitos fora da tela de produtos (entrada, perda,
-- cortesia — tanto do Estoque quanto da Mesa).
create policy permission_update_products on public.products
  for update
  using (public.has_any_permission(array[
    'produtos.editar', 'produtos.criar', 'estoque.entrada', 'estoque.perda',
    'estoque.cortesia', 'mesas.cortesia'
  ]))
  with check (public.has_any_permission(array[
    'produtos.editar', 'produtos.criar', 'estoque.entrada', 'estoque.perda',
    'estoque.cortesia', 'mesas.cortesia'
  ]));

create policy permission_delete_products on public.products
  for delete using (public.has_any_permission(array['produtos.excluir']));

-- ---------- dining_tables ----------
drop policy if exists authenticated_all_dining_tables on public.dining_tables;

create policy authenticated_select_dining_tables on public.dining_tables
  for select using (auth.role() = 'authenticated');

create policy permission_insert_dining_tables on public.dining_tables
  for insert
  with check (public.has_any_permission(array['mesas.criar']));

-- UPDATE cobre todas as ações de comanda (abrir, lançar item, cancelar
-- item, transferir, cortesia, adiantamento parcial, estorno de
-- adiantamento, desconto, fechar) — todas mexem no JSON `comandas`
-- desta linha.
create policy permission_update_dining_tables on public.dining_tables
  for update
  using (public.has_any_permission(array[
    'mesas.abrir_comanda', 'mesas.lancar_item', 'mesas.cancelar_item',
    'mesas.transferir', 'mesas.cortesia', 'mesas.pagamento_parcial',
    'mesas.estornar_pagamento_parcial', 'mesas.desconto', 'mesas.fechar_comanda'
  ]))
  with check (public.has_any_permission(array[
    'mesas.abrir_comanda', 'mesas.lancar_item', 'mesas.cancelar_item',
    'mesas.transferir', 'mesas.cortesia', 'mesas.pagamento_parcial',
    'mesas.estornar_pagamento_parcial', 'mesas.desconto', 'mesas.fechar_comanda'
  ]));

create policy permission_delete_dining_tables on public.dining_tables
  for delete using (public.has_any_permission(array['mesas.excluir']));

-- ---------- categories (SELECT público já existe via public_read_categories) ----------
drop policy if exists authenticated_all_categories on public.categories;

create policy permission_write_categories on public.categories
  for insert
  with check (public.has_any_permission(array['grupos.gerenciar', 'produtos.criar', 'produtos.editar']));

create policy permission_update_categories on public.categories
  for update
  using (public.has_any_permission(array['grupos.gerenciar', 'produtos.criar', 'produtos.editar']))
  with check (public.has_any_permission(array['grupos.gerenciar', 'produtos.criar', 'produtos.editar']));

create policy permission_delete_categories on public.categories
  for delete using (public.has_any_permission(array['grupos.gerenciar']));

-- ---------- ingredients ----------
drop policy if exists authenticated_all_ingredients on public.ingredients;

create policy authenticated_select_ingredients on public.ingredients
  for select using (auth.role() = 'authenticated');

create policy permission_insert_ingredients on public.ingredients
  for insert
  with check (public.has_any_permission(array['estoque.criar_insumo']));

create policy permission_update_ingredients on public.ingredients
  for update
  using (public.has_any_permission(array['estoque.editar_insumo', 'estoque.entrada', 'estoque.perda']))
  with check (public.has_any_permission(array['estoque.editar_insumo', 'estoque.entrada', 'estoque.perda']));

create policy permission_delete_ingredients on public.ingredients
  for delete using (public.has_any_permission(array['estoque.excluir_insumo']));

-- ---------- ingredient_categories ----------
drop policy if exists authenticated_all_ingredient_categories on public.ingredient_categories;

create policy authenticated_select_ingredient_categories on public.ingredient_categories
  for select using (auth.role() = 'authenticated');

create policy permission_write_ingredient_categories on public.ingredient_categories
  for insert
  with check (public.has_any_permission(array['grupos.gerenciar']));

create policy permission_update_ingredient_categories on public.ingredient_categories
  for update
  using (public.has_any_permission(array['grupos.gerenciar']))
  with check (public.has_any_permission(array['grupos.gerenciar']));

create policy permission_delete_ingredient_categories on public.ingredient_categories
  for delete using (public.has_any_permission(array['grupos.gerenciar']));

-- ---------- table_sectors ----------
drop policy if exists authenticated_all_table_sectors on public.table_sectors;

create policy authenticated_select_table_sectors on public.table_sectors
  for select using (auth.role() = 'authenticated');

create policy permission_write_table_sectors on public.table_sectors
  for insert
  with check (public.has_any_permission(array['grupos.gerenciar']));

create policy permission_update_table_sectors on public.table_sectors
  for update
  using (public.has_any_permission(array['grupos.gerenciar']))
  with check (public.has_any_permission(array['grupos.gerenciar']));

create policy permission_delete_table_sectors on public.table_sectors
  for delete using (public.has_any_permission(array['grupos.gerenciar']));

-- ---------- suppliers ----------
drop policy if exists authenticated_all_suppliers on public.suppliers;

create policy authenticated_select_suppliers on public.suppliers
  for select using (auth.role() = 'authenticated');

create policy permission_insert_suppliers on public.suppliers
  for insert
  with check (public.has_any_permission(array['fornecedores.criar']));

create policy permission_update_suppliers on public.suppliers
  for update
  using (public.has_any_permission(array['fornecedores.editar', 'fornecedores.ativar_inativar']))
  with check (public.has_any_permission(array['fornecedores.editar', 'fornecedores.ativar_inativar']));

create policy permission_delete_suppliers on public.suppliers
  for delete using (public.has_any_permission(array['fornecedores.excluir']));

-- ---------- sale_units (sem exclusão no frontend hoje) ----------
drop policy if exists authenticated_all_sale_units on public.sale_units;

create policy authenticated_select_sale_units on public.sale_units
  for select using (auth.role() = 'authenticated');

create policy permission_write_sale_units on public.sale_units
  for insert
  with check (public.has_any_permission(array['produtos.criar', 'produtos.editar']));

create policy permission_update_sale_units on public.sale_units
  for update
  using (public.has_any_permission(array['produtos.criar', 'produtos.editar']))
  with check (public.has_any_permission(array['produtos.criar', 'produtos.editar']));

-- ---------- technical_sheets (sem nenhum uso no frontend hoje; só leitura) ----------
drop policy if exists authenticated_all_technical_sheets on public.technical_sheets;

create policy authenticated_select_technical_sheets on public.technical_sheets
  for select using (auth.role() = 'authenticated');
