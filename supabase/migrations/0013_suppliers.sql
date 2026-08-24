-- Cadastro de fornecedores (antes era só um placeholder em memória, sem
-- persistência real). Segue o mesmo padrão de categories/ingredient_categories.

create table if not exists suppliers (
  id text primary key,
  name text not null,
  trade_name text not null default '',
  cnpj_cpf text not null default '',
  phone text not null default '',
  email text not null default '',
  supplied_categories jsonb not null default '[]'::jsonb,
  contact_person text not null default '',
  notes text,
  active boolean not null default true
);

alter table suppliers enable row level security;
create policy "authenticated_all_suppliers" on suppliers for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter publication supabase_realtime add table suppliers;
