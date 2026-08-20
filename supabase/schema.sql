-- ============================================================================
-- CAFÉ COM DESTINO — Schema de produção (Supabase / PostgreSQL)
--
-- ATENÇÃO: este script SUBSTITUI o schema anterior (baseado no README).
-- Ele começa com DROP TABLE nas tabelas antigas (categories, products,
-- ingredients, product_recipes, waitstaff, dining_tables, orders,
-- order_items, sales, sale_items, cash_sessions). Isso é destrutivo.
-- Rode isto apenas se essas tabelas ainda estiverem vazias (nenhum código
-- do app grava nelas hoje). Se já existir dado real, faça backup antes.
--
-- Rode este arquivo inteiro no SQL Editor do seu projeto Supabase.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Limpeza do schema antigo
-- ----------------------------------------------------------------------------
drop table if exists sale_items cascade;
drop table if exists sales cascade;
drop table if exists order_items cascade;
drop table if exists orders cascade;
drop table if exists dining_tables cascade;
drop table if exists waitstaff cascade;
drop table if exists product_recipes cascade;
drop table if exists cash_sessions cascade;
drop table if exists products cascade;
drop table if exists ingredients cascade;
drop table if exists categories cascade;

-- ----------------------------------------------------------------------------
-- 1. Perfis de usuário (ligados ao Supabase Auth)
-- ----------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null default '',
  role text not null default 'garcom'
    check (role in ('admin', 'gerente', 'caixa', 'garcom', 'cozinha', 'estoque', 'financeiro')),
  code text,
  phone text,
  active boolean not null default true
);

-- Cria automaticamente um profile ao nascer um novo usuário de autenticação.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 2. Categorias, Produtos, Insumos e Ficha Técnica
-- ----------------------------------------------------------------------------
create table categories (
  id text primary key,
  name text not null,
  icon text,
  description text,
  "order" int not null default 0,
  active boolean not null default true,
  shows_in_stock boolean not null default true
);

create table ingredients (
  id text primary key,
  name text not null,
  category text not null default 'outros'
    check (category in ('carnes', 'laticinios', 'hortifruti', 'bebidas', 'embalagens', 'outros')),
  stock_quantity numeric(10,3) not null default 0,
  min_stock numeric(10,3) not null default 0,
  unit text not null default 'UN' check (unit in ('KG', 'G', 'L', 'ML', 'UN', 'CX')),
  avg_cost_unit numeric(10,2) not null default 0,
  expiry_date date
);

-- Unidades de venda cadastráveis pelo usuário (ex: Unidade/UN, Quilograma/KG).
create table sale_units (
  id text primary key,
  name text not null,
  abbreviation text not null
);

create table products (
  id text primary key,
  code text not null default '',
  barcode text,
  name text not null,
  category_id text references categories(id) on delete set null,
  description text not null default '',
  price numeric(10,2) not null default 0,
  cost_price numeric(10,2) not null default 0,
  promo_price numeric(10,2),
  unit text not null default 'UN',
  image_url text not null default '',
  available boolean not null default true,
  requires_preparation boolean not null default true,
  track_stock boolean not null default false,
  stock_quantity numeric(10,3) not null default 0,
  min_stock numeric(10,3) not null default 0,
  additions jsonb not null default '[]'::jsonb,
  fiscal jsonb not null default '{}'::jsonb
);

create table technical_sheets (
  product_id text primary key references products(id) on delete cascade,
  ingredients jsonb not null default '[]'::jsonb,
  servings_yield numeric(10,2) not null default 1,
  total_cost numeric(10,2) not null default 0,
  margin_percent numeric(6,2) not null default 0
);

-- ----------------------------------------------------------------------------
-- 3. Mesas, Pedidos e Caixa
-- ----------------------------------------------------------------------------
create table dining_tables (
  id text primary key,
  number int not null unique,
  sector text not null default 'Salão Principal'
    check (sector in ('Salão Principal', 'Varanda', 'Área VIP', 'Delivery / Balcão')),
  capacity int not null default 2,
  status text not null default 'livre'
    check (status in ('livre', 'ocupada', 'aguardando_pedido', 'em_preparo', 'pedido_pronto', 'aguardando_fechamento')),
  guest_count int,
  client_name text,
  opened_at text,
  waiter_id uuid references profiles(id) on delete set null,
  waiter_name text,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(10,2) not null default 0,
  advance_payments jsonb not null default '[]'::jsonb
);

create table orders (
  id text primary key,
  order_number int not null,
  channel text not null check (channel in ('pdv', 'garcom', 'online', 'balcao', 'whatsapp', 'telefone')),
  table_number int,
  customer jsonb not null default '{}'::jsonb,
  items jsonb not null default '[]'::jsonb,
  service_type text not null check (service_type in ('entrega', 'retirada', 'consumo_local')),
  subtotal numeric(10,2) not null default 0,
  delivery_fee numeric(10,2) not null default 0,
  discount numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  payment_method text not null check (payment_method in ('pix', 'cartao_credito', 'cartao_debito', 'dinheiro', 'multiplo')),
  payment_status text not null check (payment_status in ('aguardando_pagamento', 'pagamento_aprovado', 'pagamento_recusado', 'pagamento_cancelado', 'pagamento_estornado')),
  order_status text not null check (order_status in ('novo', 'aceito', 'em_preparo', 'pronto', 'saiu_entrega', 'concluido', 'cancelado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  prepared_at text,
  delivered_at text,
  tuna_transaction_id text,
  delivery_driver_name text,
  waiter_name text,
  notes text,
  fiscal_issued boolean not null default false,
  nfce_key text
);

create table cash_shifts (
  id text primary key,
  created_at timestamptz not null default now(),
  opened_by text not null default '',
  opened_at text not null default '',
  closed_by text,
  closed_at text,
  initial_float numeric(10,2) not null default 0,
  status text not null default 'fechado' check (status in ('aberto', 'fechado')),
  sales_cash numeric(10,2) not null default 0,
  sales_card numeric(10,2) not null default 0,
  sales_pix numeric(10,2) not null default 0,
  additions numeric(10,2) not null default 0,
  withdrawals numeric(10,2) not null default 0,
  expected_total numeric(10,2) not null default 0,
  actual_total numeric(10,2),
  difference numeric(10,2),
  notes text
);

create table cash_movements (
  id text primary key,
  shift_id text not null references cash_shifts(id) on delete cascade,
  type text not null check (type in ('reforco', 'sangria', 'venda_dinheiro')),
  amount numeric(10,2) not null,
  reason text not null default '',
  user_name text not null default '',
  timestamp text not null default ''
);

-- ----------------------------------------------------------------------------
-- 4. Row Level Security — qualquer usuário autenticado (funcionário logado)
--    pode ler e escrever nos dados operacionais. Sem granularidade por
--    cargo nesta etapa; endurecer depois se necessário.
-- ----------------------------------------------------------------------------
alter table profiles enable row level security;
alter table categories enable row level security;
alter table sale_units enable row level security;
alter table ingredients enable row level security;
alter table products enable row level security;
alter table technical_sheets enable row level security;
alter table dining_tables enable row level security;
alter table orders enable row level security;
alter table cash_shifts enable row level security;
alter table cash_movements enable row level security;

create policy "authenticated_read_profiles" on profiles for select using (auth.role() = 'authenticated');
create policy "self_update_profile" on profiles for update using (auth.uid() = id);

create policy "authenticated_all_categories" on categories for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_all_sale_units" on sale_units for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_all_ingredients" on ingredients for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_all_products" on products for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_all_technical_sheets" on technical_sheets for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_all_dining_tables" on dining_tables for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_all_orders" on orders for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_all_cash_shifts" on cash_shifts for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_all_cash_movements" on cash_movements for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ----------------------------------------------------------------------------
-- 5. Realtime — cozinha/garçom/caixa recebem mudanças ao vivo
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table dining_tables, orders, products, categories, ingredients, cash_shifts, cash_movements;

-- ----------------------------------------------------------------------------
-- 6. Funções RPC transacionais para os fluxos financeiros críticos
--    (garantem que pedido + caixa + baixa de estoque sejam tudo-ou-nada)
-- ----------------------------------------------------------------------------

-- Dá baixa de estoque de produtos (quando track_stock) e dos insumos da
-- ficha técnica correspondente, para uma lista de itens {productId, quantity}.
create or replace function public.deduct_stock_for_items(
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
    update products set stock_quantity = greatest(0, stock_quantity - item.quantity)
    where id = item.product_id and track_stock = true;

    select * into ts from technical_sheets where product_id = item.product_id;
    if found then
      for ing in
        select (u->>'ingredientId') as ingredient_id, (u->>'quantityUsed')::numeric as qty_used
        from jsonb_array_elements(ts.ingredients) as u
      loop
        update ingredients set stock_quantity = greatest(0, stock_quantity - ing.qty_used * item.quantity)
        where id = ing.ingredient_id;
      end loop;
    end if;
  end loop;
end;
$$;

-- Cria um pedido (PDV ou online), dá baixa de estoque e credita o caixa
-- aberto, tudo em uma única transação.
create or replace function public.create_order_and_credit_cash(
  p_order jsonb,
  p_cash_amount numeric,
  p_payment_method text,
  p_stock_items jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_shift_id text;
begin
  perform public.deduct_stock_for_items(p_stock_items);

  insert into orders (
    id, order_number, channel, table_number, customer, items, service_type,
    subtotal, delivery_fee, discount, total, payment_method, payment_status,
    order_status, prepared_at, delivered_at, tuna_transaction_id,
    delivery_driver_name, waiter_name, notes, fiscal_issued, nfce_key
  )
  select
    p_order->>'id', (p_order->>'orderNumber')::int, p_order->>'channel',
    nullif(p_order->>'tableNumber','')::int, p_order->'customer', p_order->'items',
    p_order->>'serviceType', (p_order->>'subtotal')::numeric, (p_order->>'deliveryFee')::numeric,
    (p_order->>'discount')::numeric, (p_order->>'total')::numeric, p_order->>'paymentMethod',
    p_order->>'paymentStatus', p_order->>'orderStatus', p_order->>'preparedAt', p_order->>'deliveredAt',
    p_order->>'tunaTransactionId', p_order->>'deliveryDriverName', p_order->>'waiterName',
    p_order->>'notes', (p_order->>'fiscalIssued')::boolean, p_order->>'nfceKey';

  select id into v_shift_id from cash_shifts where status = 'aberto' limit 1;

  if v_shift_id is not null and p_cash_amount is not null then
    update cash_shifts set
      sales_cash = sales_cash + case when p_payment_method = 'dinheiro' then p_cash_amount else 0 end,
      sales_card = sales_card + case when p_payment_method in ('cartao_credito','cartao_debito') then p_cash_amount else 0 end,
      sales_pix  = sales_pix  + case when p_payment_method = 'pix' then p_cash_amount else 0 end
    where id = v_shift_id;
  end if;
end;
$$;

-- Fecha uma mesa (zera itens/subtotal) e cria o pedido correspondente + credita o caixa.
create or replace function public.close_table_and_pay(
  p_table_id text,
  p_order jsonb,
  p_cash_amount numeric,
  p_payment_method text
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.create_order_and_credit_cash(p_order, p_cash_amount, p_payment_method);

  update dining_tables set
    status = 'livre',
    guest_count = 0,
    client_name = null,
    opened_at = null,
    items = '[]'::jsonb,
    subtotal = 0
  where id = p_table_id;
end;
$$;

-- Registra sangria/reforço e atualiza o total do turno de caixa numa transação.
create or replace function public.add_cash_movement(
  p_movement jsonb
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  insert into cash_movements (id, shift_id, type, amount, reason, user_name, "timestamp")
  values (
    p_movement->>'id', p_movement->>'shiftId', p_movement->>'type',
    (p_movement->>'amount')::numeric, p_movement->>'reason', p_movement->>'userName', p_movement->>'timestamp'
  );

  update cash_shifts set
    additions = additions + case when p_movement->>'type' = 'reforco' then (p_movement->>'amount')::numeric else 0 end,
    withdrawals = withdrawals + case when p_movement->>'type' = 'sangria' then (p_movement->>'amount')::numeric else 0 end
  where id = p_movement->>'shiftId';
end;
$$;
