-- Torna as áreas/setores do salão (antes fixas: Salão Principal, Varanda,
-- Área VIP, Delivery/Balcão) cadastráveis pelo usuário em Grupos, assim como
-- já acontece com categorias de produto e grupos de insumo.

create table if not exists table_sectors (
  id text primary key,
  name text not null unique
);

-- A lista de setores passa a ser livre (gerenciada pela tabela acima), então
-- o texto gravado em dining_tables.sector deixa de estar preso a um enum fixo.
alter table dining_tables drop constraint if exists dining_tables_sector_check;

alter table table_sectors enable row level security;
create policy "authenticated_all_table_sectors" on table_sectors for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter publication supabase_realtime add table table_sectors;
