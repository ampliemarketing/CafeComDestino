-- ============================================================================
-- Adiciona a tabela de unidades de venda (ex: Unidade/UN, Quilograma/KG),
-- cadastráveis pelo usuário direto no formulário de produto.
-- Também remove a restrição antiga que travava products.unit em
-- 'UN'/'KG'/'L'/'PORTION' — agora qualquer unidade cadastrada é aceita.
--
-- Rode este arquivo no SQL Editor do seu projeto Supabase (schema.sql já
-- foi rodado antes; isto só adiciona o que falta, sem apagar nada).
-- ============================================================================

create table if not exists sale_units (
  id text primary key,
  name text not null,
  abbreviation text not null
);

alter table sale_units enable row level security;

drop policy if exists "authenticated_all_sale_units" on sale_units;
create policy "authenticated_all_sale_units" on sale_units for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table products drop constraint if exists products_unit_check;
alter table products alter column unit set default 'UN';
