-- Fecha a escrita direta do cliente nas tabelas financeiras e esconde o PIN
-- (profiles.code) do navegador. Aplicar JUNTO com a 0027 e o deploy do
-- frontend correspondente — o frontend antigo faz UPDATE direto em
-- cash_shifts (openCashShift/closeCashShift/addPartialPayment) e SELECT * em
-- profiles, e os dois passam a ser negados aqui.
--
-- Achados da auditoria:
-- - permission_update_cash_shifts (0022) deixava qualquer autenticado com
--   'caixas.fechar' OU 'mesas.pagamento_parcial' editar/reabrir qualquer
--   turno. Agora cash_shifts só tem SELECT; escrita 100% via RPC.
-- - profiles.code (PIN) era lido por qualquer autenticado e a conferência
--   era feita em JS. Revoga a coluna; validação passa a ser via
--   validate_user_pin / validate_manager_pin (migration 0025).

-- ---------------------------------------------------------------------------
-- 1. cash_shifts — só leitura direta
-- ---------------------------------------------------------------------------
drop policy if exists permission_insert_cash_shifts on public.cash_shifts;
drop policy if exists permission_update_cash_shifts on public.cash_shifts;

revoke insert, update, delete on public.cash_shifts from authenticated, anon;

-- ---------------------------------------------------------------------------
-- 2. cash_movements — reforço (já era select-only desde 0022)
-- ---------------------------------------------------------------------------
revoke insert, update, delete on public.cash_movements from authenticated, anon;

-- ---------------------------------------------------------------------------
-- 3. profiles.code — deixa de ser legível pelo cliente
--    (anon nunca teve SELECT em profiles; service_role ignora privilégio de
--     coluna, então a Edge Function admin-create-user continua funcionando)
-- ---------------------------------------------------------------------------
revoke select (code) on public.profiles from authenticated;

-- ---------------------------------------------------------------------------
-- 4. dining_tables — inclui a nova permissão de remover taxa de serviço no
--    conjunto que autoriza UPDATE do JSON `comandas`.
-- ---------------------------------------------------------------------------
drop policy if exists permission_update_dining_tables on public.dining_tables;

create policy permission_update_dining_tables on public.dining_tables
  for update
  using (public.has_any_permission(array[
    'mesas.abrir_comanda', 'mesas.lancar_item', 'mesas.cancelar_item',
    'mesas.transferir', 'mesas.cortesia', 'mesas.pagamento_parcial',
    'mesas.estornar_pagamento_parcial', 'mesas.desconto', 'mesas.fechar_comanda',
    'mesas.remover_taxa_servico'
  ]))
  with check (public.has_any_permission(array[
    'mesas.abrir_comanda', 'mesas.lancar_item', 'mesas.cancelar_item',
    'mesas.transferir', 'mesas.cortesia', 'mesas.pagamento_parcial',
    'mesas.estornar_pagamento_parcial', 'mesas.desconto', 'mesas.fechar_comanda',
    'mesas.remover_taxa_servico'
  ]));

-- ---------------------------------------------------------------------------
-- 5. Backfill de profiles.permissions com as chaves novas (o backfill da
--    0015 rodou uma vez só). admin é liberado por role em has_any_permission,
--    então só os cargos abaixo precisam receber as chaves.
-- ---------------------------------------------------------------------------
update public.profiles set permissions = (
  select array_agg(distinct p) from unnest(permissions || array['livro_caixa.acessar']) p
) where role in ('gerente', 'caixa', 'financeiro');

update public.profiles set permissions = (
  select array_agg(distinct p) from unnest(permissions || array['livro_caixa.exportar']) p
) where role in ('gerente', 'financeiro');

update public.profiles set permissions = (
  select array_agg(distinct p) from unnest(permissions || array[
    'auditoria.acessar', 'caixas.estornar_venda', 'caixas.reabrir',
    'pdv.desconto_acima_limite', 'mesas.desconto_acima_limite', 'mesas.remover_taxa_servico'
  ]) p
) where role = 'gerente';
