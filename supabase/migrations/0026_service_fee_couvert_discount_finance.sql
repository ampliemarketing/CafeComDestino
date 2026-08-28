-- Colunas e configuração para: taxa de serviço + couvert, teto de desconto
-- por cargo, conferência cega configurável, e persistência dos lançamentos
-- financeiros (a tela Gestão Financeira usava useState([]) fictício com
-- multiplicadores hardcoded).
--
-- Tudo aditivo — nenhuma RPC muda de comportamento aqui. CHECKs entram
-- NOT VALID (aplicam a escritas novas, não revalidam linhas existentes),
-- no mesmo padrão da migration 0023.

-- ---------------------------------------------------------------------------
-- 1. company_profile — configuração de taxa de serviço, couvert, limite de
--    diferença de fechamento e teto de desconto por cargo.
-- ---------------------------------------------------------------------------
alter table public.company_profile
  add column if not exists service_fee_percent numeric(5,2) not null default 0,
  add column if not exists service_fee_enabled boolean not null default false,
  add column if not exists couvert_value numeric(10,2) not null default 0,
  add column if not exists couvert_enabled boolean not null default false,
  add column if not exists blind_conference_threshold numeric(10,2) not null default 10,
  add column if not exists discount_limits jsonb not null
    default '{"caixa": 5, "gerente": 20, "financeiro": 10, "admin": 100}'::jsonb;

alter table public.company_profile
  add constraint company_profile_service_fee_range
    check (service_fee_percent between 0 and 100) not valid,
  add constraint company_profile_couvert_nonneg
    check (couvert_value >= 0) not valid;

-- ---------------------------------------------------------------------------
-- 2. cash_shifts — novos acumuladores (cache mantido pelo trigger da 0027)
-- ---------------------------------------------------------------------------
alter table public.cash_shifts
  add column if not exists sales_service_fee numeric(10,2) not null default 0,
  add column if not exists sales_couvert numeric(10,2) not null default 0,
  add column if not exists cash_change_given numeric(10,2) not null default 0,
  add column if not exists cash_expenses numeric(10,2) not null default 0;

-- ---------------------------------------------------------------------------
-- 3. orders — taxa de serviço/couvert separados do subtotal de produtos,
--    e rastreio de desconto acima do teto.
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists service_fee numeric(10,2) not null default 0,
  add column if not exists couvert numeric(10,2) not null default 0,
  add column if not exists discount_reason text,
  add column if not exists discount_authorized_by text;

alter table public.orders
  add constraint orders_service_fee_nonneg check (service_fee >= 0) not valid,
  add constraint orders_couvert_nonneg     check (couvert >= 0)      not valid,
  add constraint orders_discount_reason_len
    check (discount_reason is null or char_length(discount_reason) <= 500) not valid;

-- ---------------------------------------------------------------------------
-- 4. financial_entries — lançamentos de contas a pagar/receber (DRE real)
-- ---------------------------------------------------------------------------
create table public.financial_entries (
  id              text primary key,
  type            text not null check (type in ('receita', 'despesa')),
  description     text not null default '',
  category        text not null default '',
  amount          numeric(12,2) not null check (amount >= 0),
  due_date        date,
  status          text not null default 'pendente' check (status in ('pago', 'pendente', 'atrasado')),
  payment_method  text,
  shift_id        text references public.cash_shifts(id) on delete set null,
  ledger_id       uuid references public.cash_ledger(id) on delete set null,
  created_by      uuid references auth.users(id) on delete set null,
  created_by_name text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint financial_entries_desc_len check (char_length(description) <= 300)
);

create index financial_entries_type_idx   on public.financial_entries (type);
create index financial_entries_status_idx on public.financial_entries (status);
create index financial_entries_due_idx    on public.financial_entries (due_date);

alter table public.financial_entries enable row level security;

create policy financial_entries_select on public.financial_entries
  for select using (public.has_any_permission(array['financeiro_dre.acessar']));

create policy financial_entries_insert on public.financial_entries
  for insert with check (public.has_any_permission(array['financeiro_dre.lancar']));

create policy financial_entries_update on public.financial_entries
  for update
  using (public.has_any_permission(array['financeiro_dre.lancar']))
  with check (public.has_any_permission(array['financeiro_dre.lancar']));

alter publication supabase_realtime add table public.financial_entries;

-- ---------------------------------------------------------------------------
-- 5. Helpers puros (sem escrita em tabela financeira)
-- ---------------------------------------------------------------------------

-- Teto de desconto (%) permitido para um cargo, lido de company_profile.
create or replace function public.discount_limit_percent(p_role text)
returns numeric
language sql
stable
security definer set search_path = public
as $$
  select coalesce(
    (select (discount_limits ->> p_role)::numeric from public.company_profile where id = true),
    0
  );
$$;

-- Repõe estoque de produtos/insumos (espelho de deduct_stock_for_items,
-- somando em vez de subtrair). Usado no estorno de venda paga.
create or replace function public.reverse_stock_for_items(
  p_items jsonb
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  item record;
  ts record;
  ing record;
begin
  for item in
    select (elem->>'productId') as product_id, (elem->>'quantity')::numeric as quantity
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as elem
  loop
    update products set stock_quantity = greatest(0, stock_quantity + item.quantity)
    where id = item.product_id and track_stock = true;

    select * into ts from technical_sheets where product_id = item.product_id;
    if found then
      for ing in
        select (u->>'ingredientId') as ingredient_id, (u->>'quantityUsed')::numeric as qty_used
        from jsonb_array_elements(ts.ingredients) as u
      loop
        update ingredients set stock_quantity = greatest(0, stock_quantity + ing.qty_used * item.quantity)
        where id = ing.ingredient_id;
      end loop;
    end if;
  end loop;
end;
$$;

revoke execute on function public.discount_limit_percent(text) from public, anon;
revoke execute on function public.reverse_stock_for_items(jsonb) from public, anon;
grant execute on function public.discount_limit_percent(text) to authenticated;
grant execute on function public.reverse_stock_for_items(jsonb) to authenticated;
