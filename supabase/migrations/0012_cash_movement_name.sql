-- Movimentações de caixa (sangria/reforço) ganham um nome/título curto,
-- além do motivo/observação que já existia, para facilitar identificar cada
-- lançamento na lista de movimentações do turno.

alter table cash_movements add column if not exists name text not null default '';

create or replace function public.add_cash_movement(
  p_movement jsonb
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  insert into cash_movements (id, shift_id, type, amount, name, reason, user_name, "timestamp")
  values (
    p_movement->>'id', p_movement->>'shiftId', p_movement->>'type',
    (p_movement->>'amount')::numeric, p_movement->>'name', p_movement->>'reason', p_movement->>'userName', p_movement->>'timestamp'
  );

  update cash_shifts set
    additions = additions + case when p_movement->>'type' = 'reforco' then (p_movement->>'amount')::numeric else 0 end,
    withdrawals = withdrawals + case when p_movement->>'type' = 'sangria' then (p_movement->>'amount')::numeric else 0 end
  where id = p_movement->>'shiftId';
end;
$$;
