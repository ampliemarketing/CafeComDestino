-- ============================================================================
-- #07 do checklist de go-live — mudança de permissão / desativação de usuário
-- passa a valer em tempo real.
--
-- ANTES: profiles não estava na publication de realtime. Se um admin
-- desativava um funcionário ou tirava uma permissão, ele seguia operando com
-- o acesso antigo até recarregar a aba ou relogar.
--
-- DEPOIS: profiles entra no realtime com LISTA DE COLUNAS explícita — de
-- propósito SEM a coluna `code` (PIN), que a migration 0028 revogou do
-- cliente. Assim o payload de realtime nunca reexpõe o PIN.
--
-- (Column lists em publication exigem Postgres 15+, que é o que o Supabase
-- roda. REPLICA IDENTITY fica no default = PK `id`, suficiente aqui.)
-- ============================================================================

alter publication supabase_realtime add table public.profiles
  (id, name, email, role, phone, active, cpf, permissions);
