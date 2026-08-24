-- Abre o cardápio online pra clientes reais, sem exigir login de
-- funcionário — o pedido é feito como convidado (nome/telefone/endereço),
-- nunca pela mesma tabela de contas de funcionário (profiles). Ver
-- discussão: misturar cliente com funcionário reabriria o mesmo risco de
-- autocadastro que foi fechado nas migrations 0014/0015.
--
-- Pré-requisito que isso destrava: create_order_and_credit_cash já foi
-- endurecida na migration 0017 pra recalcular preço/adicional contra
-- products no servidor e ignorar o total que o cliente manda — sem isso,
-- abrir a função pra anon teria sido a mesma falha de fraude de preço, só
-- que exposta a qualquer pessoa na internet em vez de só a funcionários.

-- ----------------------------------------------------------------------------
-- 1. Perfil da empresa passa a morar no banco (linha única), não mais só no
--    localStorage do navegador de quem está logado — um visitante anônimo
--    não tem esse localStorage, então o cardápio público precisa buscar
--    isso de algum lugar acessível sem sessão.
-- ----------------------------------------------------------------------------
create table company_profile (
  id boolean primary key default true check (id),
  name text not null default '',
  trade_name text not null default '',
  cnpj text not null default '',
  ie text not null default '',
  logo_url text not null default '',
  cover_url text not null default '',
  primary_color text not null default '#7C4A27',
  phone text not null default '',
  whatsapp text not null default '',
  email text not null default '',
  instagram text not null default '',
  website text not null default '',
  address jsonb not null default '{}'::jsonb,
  operating_hours text not null default '',
  avg_prep_time_minutes int not null default 15,
  min_order_value numeric(10,2) not null default 0,
  delivery_fee numeric(10,2) not null default 0,
  buffet_prices jsonb not null default '{}'::jsonb,
  served_neighborhoods text[] not null default '{}',
  pix_key text not null default '',
  bank_info jsonb not null default '{}'::jsonb,
  fiscal_info jsonb not null default '{}'::jsonb
);

insert into company_profile (
  id, name, trade_name, cnpj, ie, logo_url, cover_url, primary_color,
  phone, whatsapp, email, instagram, website, address, operating_hours,
  avg_prep_time_minutes, min_order_value, delivery_fee, buffet_prices,
  served_neighborhoods, pix_key, bank_info, fiscal_info
) values (
  true, 'CAFÉ COM DESTINO', 'CAFÉ COM DESTINO', '12.345.678/0001-90', '123.456.789.110',
  'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=1200&q=80',
  '#7C4A27', '(11) 3456-7890', '(11) 98765-4321', 'contato@cafecomdestino.com.br',
  '@cafecomdestino_oficial', 'www.cafecomdestino.com.br',
  '{"street":"Av. Paulista","number":"1200","complement":"Térreo - Loja 4","neighborhood":"Bela Vista","city":"São Paulo","state":"SP","zipCode":"01310-100"}'::jsonb,
  'Segunda a Sábado - 07:00 às 20:00', 15, 15.00, 6.90,
  '{"lunchPricePerKg":80.00,"breakfastPricePerKg":54.99,"plateTareGrams":200}'::jsonb,
  array['Bela Vista','Jardins','Paraíso','Pinheiros','Itaim Bibi'],
  '12.345.678/0001-90 (CNPJ)',
  '{"bank":"Banco Itaú (341)","agency":"1234","account":"56789-0","holder":"CAFÉ COM DESTINO Ltda","doc":"12.345.678/0001-90"}'::jsonb,
  '{"crt":"1 - Simples Nacional","environment":"homologation","certStatus":"valid","certExpirationDate":"2027-12-31","nfceSeries":1,"nfceNextNumber":1042}'::jsonb
)
on conflict (id) do nothing;

alter table company_profile enable row level security;

-- Dado público do restaurante (nome, endereço, preço) — qualquer um pode ler.
create policy "public_read_company_profile" on company_profile for select using (true);
-- Só funcionário logado pode editar (Configurações → Perfil).
create policy "authenticated_update_company_profile" on company_profile for update
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ----------------------------------------------------------------------------
-- 2. Cardápio (produtos/categorias) passa a ser legível por anon também —
--    escrita continua só para authenticated (policies existentes intactas).
-- ----------------------------------------------------------------------------
create policy "public_read_products" on products for select using (true);
create policy "public_read_categories" on categories for select using (true);

-- ----------------------------------------------------------------------------
-- 3. Cliente anônimo pode criar pedido — só via a função já endurecida na
--    migration 0017 (recalcula preço/total no servidor). Não libera select
--    em orders pra anon: o rastreio público de pedido fica pra uma etapa
--    futura, com uma RPC própria que não exponha pedido de um cliente pro
--    outro.
-- ----------------------------------------------------------------------------
grant execute on function public.create_order_and_credit_cash(jsonb, numeric, text, jsonb, jsonb, numeric) to anon;
