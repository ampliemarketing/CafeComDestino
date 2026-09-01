-- ============================================================================
-- #04 do checklist de go-live — perdas, cortesias, impressoras e entregadores
-- passam a viver no Supabase (antes: perdas/cortesias em localStorage do
-- navegador, impressoras/entregadores só em memória). Sem persistência no
-- servidor não havia sincronização entre terminais nem auditoria, e o dado
-- sumia ao limpar o navegador.
--
-- Perdas e cortesias são REGISTROS IMUTÁVEIS: só SELECT + INSERT, sem UPDATE
-- nem DELETE pelo cliente. Impressoras e entregadores ainda não têm tela de
-- CRUD no app — ficam com escrita restrita a admin até existir a tela.
--
-- Todas as tabelas entram na publication supabase_realtime, então aparecem
-- ao vivo em todos os terminais.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. loss_records — perdas / descartes de estoque
-- ---------------------------------------------------------------------------
create table if not exists public.loss_records (
  id text primary key,
  item_type text not null check (item_type in ('product', 'ingredient')),
  item_id text,
  ingredient_name text not null default '',
  quantity numeric(12,3) not null default 0,
  unit text not null default 'UN',
  cost_value numeric(12,2) not null default 0,
  reason text not null default 'outro',
  registered_by text not null default '',
  registered_at text not null default '',
  notes text,
  employee_name text,
  sector text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. courtesy_records — cortesias autorizadas
-- ---------------------------------------------------------------------------
create table if not exists public.courtesy_records (
  id text primary key,
  product_id text not null default '',
  product_name text not null default '',
  quantity numeric(12,3) not null default 0,
  unit_price numeric(12,2) not null default 0,
  cost_price numeric(12,2) not null default 0,
  total_retail_value numeric(12,2) not null default 0,
  total_cost_value numeric(12,2) not null default 0,
  reason text not null default 'outro',
  source text not null default 'mesa' check (source in ('mesa', 'comanda', 'pedido', 'caixa_pdv')),
  target_reference text,
  customer_name text,
  authorized_by text not null default '',
  registered_by text not null default '',
  registered_at text not null default '',
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. printers — impressoras térmicas
-- ---------------------------------------------------------------------------
create table if not exists public.printers (
  id text primary key,
  name text not null default '',
  location text not null default 'cozinha' check (location in ('cozinha', 'bar', 'caixa', 'expedicao')),
  type text not null default 'network' check (type in ('network', 'usb', 'bluetooth')),
  ip_address text,
  paper_width text not null default '80mm' check (paper_width in ('58mm', '80mm')),
  auto_print boolean not null default false,
  status text not null default 'offline' check (status in ('online', 'offline'))
);

-- ---------------------------------------------------------------------------
-- 4. delivery_drivers — entregadores
-- ---------------------------------------------------------------------------
create table if not exists public.delivery_drivers (
  id text primary key,
  name text not null default '',
  phone text not null default '',
  vehicle text not null default '',
  plate text not null default '',
  active boolean not null default true,
  current_deliveries int not null default 0
);

-- ---------------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------------
alter table public.loss_records enable row level security;
alter table public.courtesy_records enable row level security;
alter table public.printers enable row level security;
alter table public.delivery_drivers enable row level security;

-- Perdas: leitura para autenticado, inserção para quem registra perda.
create policy loss_records_select on public.loss_records
  for select using (auth.role() = 'authenticated');
create policy loss_records_insert on public.loss_records
  for insert with check (public.has_any_permission(array['estoque.perda']));

-- Cortesias: leitura para autenticado, inserção para quem lança cortesia
-- (pela tela de estoque ou pela mesa).
create policy courtesy_records_select on public.courtesy_records
  for select using (auth.role() = 'authenticated');
create policy courtesy_records_insert on public.courtesy_records
  for insert with check (public.has_any_permission(array['estoque.cortesia', 'mesas.cortesia']));

-- Impressoras / entregadores: leitura para autenticado; escrita só admin
-- (has_any_permission com array vazio libera apenas role = 'admin') enquanto
-- não existe tela de cadastro com permissão dedicada.
create policy printers_select on public.printers
  for select using (auth.role() = 'authenticated');
create policy printers_write on public.printers
  for all using (public.has_any_permission(array['impressoras.acessar']))
  with check (public.has_any_permission(array['impressoras.acessar']));

create policy delivery_drivers_select on public.delivery_drivers
  for select using (auth.role() = 'authenticated');
create policy delivery_drivers_write on public.delivery_drivers
  for all using (public.has_any_permission(array[]::text[]))
  with check (public.has_any_permission(array[]::text[]));

-- ---------------------------------------------------------------------------
-- 6. Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table
  public.loss_records, public.courtesy_records, public.printers, public.delivery_drivers;
