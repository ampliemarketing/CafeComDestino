-- ============================================================================
-- Múltiplas comandas por mesa (uma por pessoa). Substitui a lista única de
-- itens/subtotal por um array `comandas`, cada uma com seu próprio consumo,
-- que pode ser fechada e paga independente das outras da mesma mesa.
--
-- ATENÇÃO: feche todas as mesas abertas antes de rodar este script — a
-- estrutura de `dining_tables` muda e o conteúdo antigo (items/subtotal) não
-- é migrado automaticamente para dentro de uma comanda.
--
-- Rode este arquivo no SQL Editor do seu projeto Supabase.
-- ============================================================================

alter table dining_tables add column if not exists comandas jsonb not null default '[]'::jsonb;
alter table dining_tables drop column if exists items;
alter table dining_tables drop column if exists subtotal;
alter table dining_tables drop column if exists client_name;
alter table dining_tables drop column if exists guest_count;
alter table dining_tables drop column if exists opened_at;
alter table dining_tables drop column if exists waiter_id;
alter table dining_tables drop column if exists waiter_name;
alter table dining_tables drop column if exists advance_payments;

create or replace function public.compute_table_status(p_comandas jsonb)
returns text
language plpgsql
as $$
declare
  v_count int;
  v_waiting_count int;
  v_has_items boolean;
  v_has_preparing boolean;
begin
  v_count := jsonb_array_length(coalesce(p_comandas, '[]'::jsonb));
  if v_count = 0 then
    return 'livre';
  end if;

  select count(*) into v_waiting_count
  from jsonb_array_elements(p_comandas) as c
  where c->>'status' = 'aguardando_fechamento';

  if v_waiting_count = v_count then
    return 'aguardando_fechamento';
  end if;

  select exists (
    select 1
    from jsonb_array_elements(p_comandas) as c,
         jsonb_array_elements(coalesce(c->'items', '[]'::jsonb)) as it
    where it->>'status' <> 'cancelado'
  ) into v_has_items;

  if not v_has_items then
    return 'ocupada';
  end if;

  select exists (
    select 1
    from jsonb_array_elements(p_comandas) as c,
         jsonb_array_elements(coalesce(c->'items', '[]'::jsonb)) as it
    where it->>'status' = 'em_preparo'
  ) into v_has_preparing;

  return case when v_has_preparing then 'em_preparo' else 'pedido_pronto' end;
end;
$$;

create or replace function public.close_comanda_and_pay(
  p_table_id text,
  p_comanda_id text,
  p_order jsonb,
  p_cash_amount numeric,
  p_payment_method text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_remaining jsonb;
begin
  perform public.create_order_and_credit_cash(p_order, p_cash_amount, p_payment_method);

  select coalesce(jsonb_agg(elem), '[]'::jsonb) into v_remaining
  from jsonb_array_elements((select comandas from dining_tables where id = p_table_id)) as elem
  where elem->>'id' <> p_comanda_id;

  update dining_tables set
    comandas = v_remaining,
    status = public.compute_table_status(v_remaining)
  where id = p_table_id;
end;
$$;

drop function if exists public.close_table_and_pay(text, jsonb, numeric, text);
