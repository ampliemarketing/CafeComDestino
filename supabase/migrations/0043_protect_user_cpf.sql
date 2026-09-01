-- ============================================================================
-- Fecha a exposição do CPF de funcionário (profiles.cpf).
--
-- ANTES: a policy authenticated_read_profiles (schema.sql) libera SELECT de
-- profiles pra qualquer autenticado, e a migration 0040 colocou `cpf` na lista
-- de colunas do realtime — ou seja, o CPF de todos os funcionários era
-- consultável por qualquer funcionário logado E era empurrado via realtime pra
-- todo cliente conectado. O PIN (`code`) já tinha recebido esse tratamento na
-- 0028/0040; `cpf` ficou de fora.
--
-- DEPOIS: mesmo tratamento do PIN — SELECT da coluna revogado do cliente e cpf
-- removido do realtime. O CPF continua sendo GRAVÁVEL na tela de Usuários
-- (cadastro/edição), só deixa de ser exibido de volta — igual ao PIN, que já é
-- "write-only" na UI. Leituras administrativas do CPF são feitas direto no
-- banco (service_role / SQL Editor).
--
-- Seguro de aplicar com o caixa aberto.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. cpf sai da publicação de realtime (a 0040 tinha incluído)
--    Não dá pra "editar" a lista de colunas — remove e readiciona sem cpf.
--    (Column lists em publication exigem Postgres 15+, o que o Supabase roda.)
-- ---------------------------------------------------------------------------
alter publication supabase_realtime drop table public.profiles;
alter publication supabase_realtime add table public.profiles
  (id, name, email, role, phone, active, permissions);

-- ---------------------------------------------------------------------------
-- 2. cpf deixa de ser legível pelo cliente (igual profiles.code na 0028).
--    service_role ignora privilégio de coluna, então a Edge Function
--    admin-create-user e leituras administrativas continuam funcionando.
-- ---------------------------------------------------------------------------
revoke select (cpf) on public.profiles from authenticated;
