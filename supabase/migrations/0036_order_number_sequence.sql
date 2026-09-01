-- ============================================================================
-- #01 do checklist de go-live — número do pedido gerado no servidor.
--
-- ANTES: o frontend calculava `orderNumber = orders.length + 1001` e mandava
-- esse valor no p_order. Como o app só carrega os últimos 1000 pedidos, depois
-- de 1000 vendas o contador regride, e dois terminais vendendo no mesmo
-- instante geram o MESMO número.
--
-- DEPOIS: uma sequence do Postgres, atribuída por trigger BEFORE INSERT em
-- `orders`. Cobre create_order_and_credit_cash (PDV, online, fechamento de
-- comanda) e qualquer caminho futuro. O valor que o cliente mandar é ignorado
-- — o frontend relê `order_number` logo após a venda para o recibo.
--
-- Seguro de aplicar com o caixa aberto: só adiciona uma sequence e um trigger,
-- não reescreve nenhuma função financeira.
-- ============================================================================

create sequence if not exists public.order_number_seq as bigint;

-- Alinha a sequence com o maior número já gravado. `greatest(1000, ...)` mantém
-- o 1º pedido de um banco vazio em 1001, igual ao esquema antigo.
select setval(
  'public.order_number_seq',
  greatest(1000, coalesce((select max(order_number) from public.orders), 1000)),
  true
);

create or replace function public.orders_assign_number()
returns trigger
language plpgsql
as $$
begin
  -- Sempre servidor: descarta o valor vindo do cliente.
  new.order_number := nextval('public.order_number_seq');
  return new;
end;
$$;

drop trigger if exists orders_assign_number on public.orders;
create trigger orders_assign_number
  before insert on public.orders
  for each row execute function public.orders_assign_number();

-- nextval só é chamado pelo trigger, que roda dentro das RPCs SECURITY DEFINER
-- (dono = quem criou a sequence). Nenhum grant de USAGE para authenticated/anon
-- — o cliente nunca chama a sequence diretamente.
