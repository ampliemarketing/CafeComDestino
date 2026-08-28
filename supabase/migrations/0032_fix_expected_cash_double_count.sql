-- BUG: cash_shift_expected_cash somava o fundo de troco DUAS vezes —
-- uma via cash_shifts.initial_float e outra via a linha 'abertura' do
-- cash_ledger (que também é dinheiro/entrada no valor do fundo). Resultado:
-- ao fechar um caixa aberto com fundo de R$ 200 e sem venda em dinheiro,
-- o esperado vinha R$ 400 e o fechamento acusava divergência de -200.
--
-- Correção: o esperado em espécie é initial_float + (entradas - saídas) em
-- dinheiro no ledger, EXCLUINDO a linha 'abertura' (que já é o próprio fundo).

create or replace function public.cash_shift_expected_cash(p_shift_id text)
returns numeric
language sql
stable
security definer set search_path = public
as $$
  select coalesce((select initial_float from public.cash_shifts where id = p_shift_id), 0)
    + coalesce((
        select sum(case when direction = 'entrada' then amount else -amount end)
        from public.cash_ledger
        where shift_id = p_shift_id
          and payment_method = 'dinheiro'
          and entry_type <> 'abertura'
      ), 0);
$$;
