-- ============================================================================
-- Adiciona a flag "Precisa de preparo?" nos produtos. Produtos marcados como
-- "não precisa" (ex: bebidas prontas) entram direto como "pronto" ao serem
-- lançados numa comanda, em vez de "em preparo".
--
-- Rode este arquivo no SQL Editor do seu projeto Supabase (schema.sql já
-- foi rodado antes; isto só adiciona a coluna que falta).
-- ============================================================================

alter table products add column if not exists requires_preparation boolean not null default true;
