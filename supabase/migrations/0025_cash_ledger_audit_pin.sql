-- Livro-caixa (cash_ledger) + auditoria persistida (audit_log) + validação
-- de PIN no servidor. Achados da auditoria do módulo de caixa:
--
-- 1. Não existe livro-caixa. As vendas só incrementam contadores agregados
--    (cash_shifts.sales_*) via UPDATE acumulador dentro das RPCs. Não há
--    linha por transação — impossível reconstituir o turno ou investigar
--    diferença de caixa. cash_ledger passa a ser a fonte de verdade
--    append-only; cash_shifts.sales_* vira cache (mantido por trigger na
--    migration 0027).
--
-- 2. A trilha de auditoria (logAudit em src/context/AppContext.tsx) só vive
--    em memória do navegador — some no reload. audit_log persiste no
--    Postgres, imutável (revoke + trigger).
--
-- 3. O PIN de todos os usuários (profiles.code) é lido pelo cliente e a
--    conferência é feita em JS (CashShiftDetail.confirmClose,
--    CourtesyModal). validate_user_pin / validate_manager_pin passam a
--    validar no servidor, retornando só boolean. A coluna code é revogada
--    do cliente na migration 0028.
--
-- Esta migration é só ESTRUTURA NOVA — nenhuma mudança de comportamento das
-- RPCs existentes. O cutover (reescrita das RPCs + trigger de cache +
-- lockdown de RLS) vem nas migrations 0027/0028.

-- ---------------------------------------------------------------------------
-- 0. Helper genérico de imutabilidade (usado por cash_ledger e audit_log)
-- ---------------------------------------------------------------------------
create or replace function public.reject_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Tabela append-only: % não é permitido em %.', tg_op, tg_table_name;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. cash_ledger — livro-caixa append-only
-- ---------------------------------------------------------------------------
create table public.cash_ledger (
  id                uuid primary key default gen_random_uuid(),
  seq               bigint generated always as identity,
  shift_id          text not null references public.cash_shifts(id) on delete restrict,
  entry_type        text not null check (entry_type in (
                      'abertura', 'venda', 'adiantamento', 'estorno_venda',
                      'estorno_adiantamento', 'sangria', 'suprimento', 'troco',
                      'despesa', 'taxa_servico', 'couvert', 'ajuste')),
  direction         text not null check (direction in ('entrada', 'saida')),
  payment_method    text check (payment_method in (
                      'dinheiro', 'cartao_credito', 'cartao_debito', 'pix',
                      'vale_refeicao', 'boleto', 'outro')),
  amount            numeric(12,2) not null check (amount > 0),
  order_id          text references public.orders(id) on delete set null,
  comanda_id        text,
  table_id          text,
  related_ledger_id uuid references public.cash_ledger(id) on delete restrict,
  reason            text,
  created_by        uuid references auth.users(id) on delete set null,
  created_by_name   text not null default '',
  created_at        timestamptz not null default now(),
  metadata          jsonb not null default '{}'::jsonb,
  constraint cash_ledger_reason_len check (reason is null or char_length(reason) <= 500)
);

create index cash_ledger_shift_idx      on public.cash_ledger (shift_id, seq);
create index cash_ledger_order_idx      on public.cash_ledger (order_id) where order_id is not null;
create index cash_ledger_type_idx       on public.cash_ledger (entry_type);
create index cash_ledger_related_idx    on public.cash_ledger (related_ledger_id) where related_ledger_id is not null;
create index cash_ledger_created_at_idx on public.cash_ledger (created_at);

alter table public.cash_ledger enable row level security;

create policy cash_ledger_select on public.cash_ledger
  for select using (auth.role() = 'authenticated');
-- Sem policy de insert/update/delete: escrita só via RPC security definer
-- (a dona da função ignora RLS). O revoke + triggers abaixo travam até
-- service_role / console.

revoke insert, update, delete on public.cash_ledger from authenticated, anon, public;

create trigger cash_ledger_no_update before update on public.cash_ledger
  for each row execute function public.reject_mutation();
create trigger cash_ledger_no_delete before delete on public.cash_ledger
  for each row execute function public.reject_mutation();

-- ---------------------------------------------------------------------------
-- 2. audit_log — trilha de auditoria persistida e imutável
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id            uuid primary key default gen_random_uuid(),
  seq           bigint generated always as identity,
  actor_id      uuid references auth.users(id) on delete set null,
  actor_name    text not null default '',
  actor_role    text not null default '',
  action        text not null,
  module        text not null default '',
  entity_type   text,
  entity_id     text,
  amount_before numeric(12,2),
  amount_after  numeric(12,2),
  details       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  constraint audit_log_action_len check (char_length(action) <= 200),
  constraint audit_log_module_len check (char_length(module) <= 100)
);

create index audit_log_seq_idx    on public.audit_log (seq desc);
create index audit_log_actor_idx  on public.audit_log (actor_id);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);
create index audit_log_action_idx on public.audit_log (action);

alter table public.audit_log enable row level security;

create policy audit_log_select on public.audit_log
  for select using (public.has_any_permission(array['auditoria.acessar']));

revoke insert, update, delete on public.audit_log from authenticated, anon, public;

create trigger audit_log_no_update before update on public.audit_log
  for each row execute function public.reject_mutation();
create trigger audit_log_no_delete before delete on public.audit_log
  for each row execute function public.reject_mutation();

create or replace function public.write_audit_log(
  p_action text,
  p_module text,
  p_entity_type text default null,
  p_entity_id text default null,
  p_amount_before numeric default null,
  p_amount_after numeric default null,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_name text;
  v_role text;
begin
  select name, role into v_name, v_role from public.profiles where id = auth.uid();
  insert into public.audit_log (
    actor_id, actor_name, actor_role, action, module,
    entity_type, entity_id, amount_before, amount_after, details
  )
  values (
    auth.uid(), coalesce(v_name, 'Sistema'), coalesce(v_role, ''),
    left(p_action, 200), left(coalesce(p_module, ''), 100),
    p_entity_type, p_entity_id, p_amount_before, p_amount_after,
    coalesce(p_details, '{}'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Funções de verificação do turno (leem o ledger)
-- ---------------------------------------------------------------------------
create or replace function public.cash_shift_totals(p_shift_id text)
returns table (payment_method text, entradas numeric, saidas numeric, liquido numeric)
language sql
stable
security definer set search_path = public
as $$
  select
    coalesce(l.payment_method, '-') as payment_method,
    coalesce(sum(l.amount) filter (where l.direction = 'entrada'), 0) as entradas,
    coalesce(sum(l.amount) filter (where l.direction = 'saida'), 0) as saidas,
    coalesce(sum(case when l.direction = 'entrada' then l.amount else -l.amount end), 0) as liquido
  from public.cash_ledger l
  where l.shift_id = p_shift_id
  group by coalesce(l.payment_method, '-');
$$;

-- Dinheiro esperado na gaveta = fundo de troco + (entradas - saídas) em espécie.
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
        where shift_id = p_shift_id and payment_method = 'dinheiro'
      ), 0);
$$;

-- ---------------------------------------------------------------------------
-- 4. Rate-limit de PIN (espelho de login_attempts da migration 0021).
--    RLS ligado sem policy — só as funções validate_*_pin (security definer)
--    escrevem/leem.
-- ---------------------------------------------------------------------------
create table if not exists public.pin_attempts (
  actor_id     uuid primary key,
  failed_count int not null default 0,
  locked_until timestamptz,
  updated_at   timestamptz not null default now()
);

alter table public.pin_attempts enable row level security;

-- Registra falha de PIN do usuário atual e trava por 5 min após 5 erros.
create or replace function public.register_pin_failure()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.pin_attempts (actor_id, failed_count, updated_at)
  values (auth.uid(), 1, now())
  on conflict (actor_id) do update set
    failed_count = public.pin_attempts.failed_count + 1,
    locked_until = case when public.pin_attempts.failed_count + 1 >= 5
                        then now() + interval '5 minutes' else null end,
    updated_at = now();
end;
$$;

create or replace function public.pin_is_locked()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.pin_attempts
    where actor_id = auth.uid() and locked_until is not null and locked_until > now()
  );
$$;

-- Valida o PIN do PRÓPRIO usuário logado (ex.: confirmação de fechamento
-- de caixa). Não recebe id — sempre auth.uid().
create or replace function public.validate_user_pin(p_pin text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_ok boolean;
begin
  if public.pin_is_locked() then
    raise exception 'Muitas tentativas de PIN. Tente novamente em alguns minutos.';
  end if;
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and active
      and code is not null and code <> '' and code = p_pin
      and char_length(coalesce(p_pin, '')) between 4 and 8
  ) into v_ok;
  if not v_ok then
    perform public.register_pin_failure();
  else
    delete from public.pin_attempts where actor_id = auth.uid();
  end if;
  return v_ok;
end;
$$;

-- Valida o PIN de QUALQUER gerente/admin ativo (ex.: autorização de
-- desconto acima do teto, cortesia, estorno de venda paga).
create or replace function public.validate_manager_pin(p_pin text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_ok boolean;
begin
  if public.pin_is_locked() then
    raise exception 'Muitas tentativas de PIN. Tente novamente em alguns minutos.';
  end if;
  select exists (
    select 1 from public.profiles
    where active and role in ('admin', 'gerente')
      and code is not null and code <> '' and code = p_pin
      and char_length(coalesce(p_pin, '')) between 4 and 8
  ) into v_ok;
  if not v_ok then
    perform public.register_pin_failure();
  else
    delete from public.pin_attempts where actor_id = auth.uid();
  end if;
  return v_ok;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Um único turno aberto por vez. Fecha órfãos antes de criar o índice
--    (mantém o mais recente aberto, fecha os demais).
-- ---------------------------------------------------------------------------
update public.cash_shifts set status = 'fechado', closed_at = to_char(now(), 'DD/MM/YYYY, HH24:MI:SS'),
  closed_by = coalesce(closed_by, 'Sistema (migração 0025)')
where status = 'aberto'
  and id <> (select id from public.cash_shifts where status = 'aberto' order by created_at desc limit 1);

create unique index cash_shifts_single_open_idx on public.cash_shifts ((true)) where status = 'aberto';

-- ---------------------------------------------------------------------------
-- 6. Grants — só authenticated (nunca anon). Escrita real é via RPC.
-- ---------------------------------------------------------------------------
revoke execute on function public.write_audit_log(text, text, text, text, numeric, numeric, jsonb) from public, anon;
revoke execute on function public.cash_shift_totals(text) from public, anon;
revoke execute on function public.cash_shift_expected_cash(text) from public, anon;
revoke execute on function public.validate_user_pin(text) from public, anon;
revoke execute on function public.validate_manager_pin(text) from public, anon;

grant execute on function public.write_audit_log(text, text, text, text, numeric, numeric, jsonb) to authenticated;
grant execute on function public.cash_shift_totals(text) to authenticated;
grant execute on function public.cash_shift_expected_cash(text) to authenticated;
grant execute on function public.validate_user_pin(text) to authenticated;
grant execute on function public.validate_manager_pin(text) to authenticated;

alter publication supabase_realtime add table public.cash_ledger, public.audit_log;
