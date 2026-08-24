-- Achado ao testar o cardápio público de ponta a ponta: sobrou uma
-- assinatura ANTIGA de create_order_and_credit_cash (de antes da migration
-- 0008 introduzir pagamento dividido) que nenhuma migration nunca
-- derrubou — `create or replace function` só substitui quando os
-- parâmetros batem exatamente; quando um parâmetro novo foi adicionado ao
-- longo do tempo, cada mudança de assinatura criou uma sobrecarga nova ao
-- lado da antiga, e a antiga nunca foi limpa. Isso deixou o Postgres sem
-- conseguir decidir qual versão chamar ("Could not choose the best
-- candidate function"), quebrando toda venda/pedido no app.
--
-- Mantém, para cada função, só a sobrecarga com MAIS parâmetros (a mais
-- recente/evoluída) e derruba as demais. Compara por número de parâmetros
-- (pronargs), não por formatação de texto — uma tentativa anterior deste
-- mesmo script usando comparação de string falhou por causa de espaçamento
-- no formato de saída do Postgres; como cada migration roda em transação,
-- a tentativa com erro foi revertida inteira e nada ficou quebrado.
do $$
declare
  r record;
  v_max_args int;
  v_kept int;
begin
  select max(pronargs) into v_max_args
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'create_order_and_credit_cash';

  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_order_and_credit_cash' and p.pronargs < v_max_args
  loop
    execute format('drop function %s;', r.sig);
  end loop;

  select count(*) into v_kept
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'create_order_and_credit_cash';

  if v_kept <> 1 then
    raise exception 'Esperava sobrar exatamente 1 versão de create_order_and_credit_cash, sobraram %', v_kept;
  end if;
end $$;

do $$
declare
  r record;
  v_max_args int;
  v_kept int;
begin
  select max(pronargs) into v_max_args
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'close_comanda_and_pay';

  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'close_comanda_and_pay' and p.pronargs < v_max_args
  loop
    execute format('drop function %s;', r.sig);
  end loop;

  select count(*) into v_kept
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'close_comanda_and_pay';

  if v_kept <> 1 then
    raise exception 'Esperava sobrar exatamente 1 versão de close_comanda_and_pay, sobraram %', v_kept;
  end if;
end $$;

-- Reafirma os grants na sobrecarga que sobrou (deduct_stock_for_items e
-- add_cash_movement nunca tiveram a assinatura alterada em nenhuma
-- migration, então não têm esse risco — não precisam de limpeza aqui).
grant execute on function public.create_order_and_credit_cash(jsonb, numeric, text, jsonb, jsonb, numeric) to authenticated, anon;
grant execute on function public.close_comanda_and_pay(text, text, jsonb, numeric, text, jsonb) to authenticated;
revoke execute on function public.create_order_and_credit_cash(jsonb, numeric, text, jsonb, jsonb, numeric) from public;
revoke execute on function public.close_comanda_and_pay(text, text, jsonb, numeric, text, jsonb) from public, anon;
