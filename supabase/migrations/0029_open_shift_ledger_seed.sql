-- Semente do livro-caixa para o único turno que estiver aberto no momento
-- do deploy (turnos anteriores ao livro-caixa não são reconstruídos — só o
-- aberto ganha a linha de abertura para o saldo corrente da tela começar
-- correto). 'abertura' não alimenta nenhum acumulador de cash_shifts (o
-- trigger da 0027 a ignora de propósito), então isto é seguro rodar depois
-- do cutover.

insert into public.cash_ledger (shift_id, entry_type, direction, payment_method, amount, reason, created_by_name)
select s.id, 'abertura', 'entrada', 'dinheiro', s.initial_float, 'Fundo de troco (semente 0029)', 'Sistema'
from public.cash_shifts s
where s.status = 'aberto'
  and s.initial_float > 0
  and not exists (select 1 from public.cash_ledger l where l.shift_id = s.id);
