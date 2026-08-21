-- ============================================================================
-- Cria a tabela de grupos/categorias de insumos (ingredient_categories),
-- espelhando o mesmo conceito já usado para categorias de produto
-- (tabela "categories"). Antes, a categoria do insumo era uma lista fixa
-- ('carnes', 'laticinios', ...) travada por CHECK constraint — agora vira uma
-- tabela editável (criar/editar/excluir), como na nova tela "Grupos".
--
-- Os insumos já cadastrados continuam funcionando: os valores fixos antigos
-- viram linhas iniciais em ingredient_categories com o mesmo id, então o
-- vínculo existente (ingredients.category) não quebra.
--
-- Rode este arquivo no SQL Editor do seu projeto Supabase.
-- ============================================================================

create table if not exists ingredient_categories (
  id text primary key,
  name text not null
);

insert into ingredient_categories (id, name) values
  ('carnes', 'Carnes'),
  ('laticinios', 'Laticínios'),
  ('hortifruti', 'Hortifruti'),
  ('bebidas', 'Bebidas'),
  ('embalagens', 'Embalagens'),
  ('outros', 'Outros')
on conflict (id) do nothing;

alter table ingredients drop constraint if exists ingredients_category_check;
alter table ingredients add constraint ingredients_category_fkey
  foreign key (category) references ingredient_categories(id) on delete set null;

alter table ingredient_categories enable row level security;
create policy "authenticated_all_ingredient_categories" on ingredient_categories
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter publication supabase_realtime add table ingredient_categories;

-- Corrige o CHECK de payment_method: a forma de pagamento "boleto" foi
-- adicionada no app, mas o banco ainda só aceitava os métodos antigos —
-- finalizar uma venda com boleto falhava por violar essa constraint.
alter table orders drop constraint if exists orders_payment_method_check;
alter table orders add constraint orders_payment_method_check
  check (payment_method in ('pix', 'cartao_credito', 'cartao_debito', 'dinheiro', 'boleto', 'multiplo'));
