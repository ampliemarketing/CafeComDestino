-- Grupos Tributários: conjunto reutilizável de dados fiscais (NCM, CFOP, CEST,
-- origem, CST/CSOSN, CST e alíquotas de PIS/COFINS, IPI, etc.) que o usuário
-- cria em Fiscal ▸ Grupos Tributários e vincula a produtos. Produto vinculado
-- herda os dados do grupo e não os edita direto no cadastro.
-- Mesmo padrão de suppliers/sale_units (tabela simples + RLS "authenticated").

create table if not exists tax_groups (
  id text primary key,
  name text not null,
  description text,
  active boolean not null default true,
  fiscal jsonb not null default '{}'::jsonb
);

alter table tax_groups enable row level security;
create policy "authenticated_all_tax_groups" on tax_groups for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter publication supabase_realtime add table tax_groups;

-- Vínculo opcional do produto com um grupo. ON DELETE SET NULL: apagar o grupo
-- desvincula os produtos (eles voltam a usar o `products.fiscal` espelhado).
alter table products add column if not exists tax_group_id text references tax_groups(id) on delete set null;
