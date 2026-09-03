-- ============================================================================
-- Remove o cadastro de entregadores.
--
-- A Gestão de Entregas não seleciona mais motoboy: "Despachar" apenas marca o
-- pedido como `saiu_entrega`. A tabela delivery_drivers (migration 0038) nunca
-- chegou a ter tela de cadastro e some agora, junto com suas policies.
--
-- A coluna orders.delivery_driver_name é MANTIDA (nullable, a partir de agora
-- sempre nula em pedidos novos). Removê-la exigiria reescrever
-- create_order_and_credit_cash (função financeira) sem ganho prático — nenhuma
-- tela lê mais esse campo, e o trigger de WhatsApp / a página de
-- acompanhamento já tratam valor nulo.
-- ============================================================================

do $$ begin
  alter publication supabase_realtime drop table public.delivery_drivers;
exception when undefined_object then null;
end $$;

drop table if exists public.delivery_drivers cascade;
