-- ============================================================================
-- Simplifica o status da mesa: pedidos feitos dentro do restaurante (mesas)
-- não têm mais status de preparo/pronto — isso passa a ser exclusivo do
-- fluxo de delivery/online (orders.order_status). A mesa agora só assume
-- 'livre' ou 'ocupada'.
--
-- Rode este arquivo no SQL Editor do seu projeto Supabase.
-- ============================================================================

update dining_tables set status = 'ocupada' where status not in ('livre', 'ocupada');

alter table dining_tables drop constraint if exists dining_tables_status_check;
alter table dining_tables add constraint dining_tables_status_check check (status in ('livre', 'ocupada'));

create or replace function public.compute_table_status(p_comandas jsonb)
returns text
language plpgsql
as $$
begin
  if jsonb_array_length(coalesce(p_comandas, '[]'::jsonb)) = 0 then
    return 'livre';
  end if;
  return 'ocupada';
end;
$$;
