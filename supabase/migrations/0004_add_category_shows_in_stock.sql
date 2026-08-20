-- ============================================================================
-- Adiciona a flag "Ir para o Estoque?" nas categorias. Produtos de categorias
-- desmarcadas (ex: "Pratos Prontos", cujo controle é feito pela ficha
-- técnica dos insumos) deixam de aparecer na tabela de Produtos da tela de
-- Gestão de Estoque — continuam normalmente na tela de Produtos.
--
-- Rode este arquivo no SQL Editor do seu projeto Supabase (schema.sql já
-- foi rodado antes; isto só adiciona a coluna que falta).
-- ============================================================================

alter table categories add column if not exists shows_in_stock boolean not null default true;
