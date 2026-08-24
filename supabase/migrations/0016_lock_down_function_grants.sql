-- Achado de pentest: nenhuma migration anterior tinha `grant`/`revoke`
-- explícito nas funções do schema public. No Postgres, EXECUTE em funções é
-- concedido a PUBLIC por padrão — o que inclui a role `anon` (a chave
-- pública já embutida no frontend). Como create_order_and_credit_cash e
-- close_comanda_and_pay são `security definer` (rodam ignorando RLS por
-- definição, de propósito, para a transação atômica de estoque+caixa+pedido
-- funcionar), qualquer um com a anon key — sem nem fazer login — poderia em
-- tese chamá-las direto e fabricar pedidos/crédito de caixa.
--
-- 1) Trava o padrão: função nova criada daqui pra frente não nasce aberta a
--    PUBLIC (só afeta o que for criado depois disso, por isso o passo 2).
alter default privileges in schema public revoke execute on functions from public;

-- 2) Revoga de PUBLIC (e portanto de anon/authenticated por herança) em toda
--    função que já existe hoje no schema public.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format('revoke execute on function %s from public;', r.sig);
  end loop;
end $$;

-- 3) Cinto e suspensório: revoga de anon explicitamente, caso alguma versão
--    anterior do projeto tenha concedido direto pra role em vez de via PUBLIC.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format('revoke execute on function %s from anon;', r.sig);
  end loop;
end $$;

-- 4) Devolve acesso só para quem precisa: as 4 funções que o frontend
--    chama via supabase.rpc(...), e só para usuários logados (authenticated).
--    handle_new_user e prevent_self_privilege_escalation ficam de fora de
--    propósito — são funções de trigger, nunca chamadas via RPC direto, e
--    disparo de trigger não depende de grant de EXECUTE do role que fez o
--    INSERT/UPDATE. compute_table_status também fica de fora: só é usada
--    internamente por close_comanda_and_pay (chamada função-a-função roda
--    com o privilégio da função dona, não precisa de grant pro role
--    externo) — não faz sentido nenhum expô-la como endpoint RPC público.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'deduct_stock_for_items',
        'close_comanda_and_pay',
        'create_order_and_credit_cash',
        'add_cash_movement'
      )
  loop
    execute format('grant execute on function %s to authenticated;', r.sig);
  end loop;
end $$;
