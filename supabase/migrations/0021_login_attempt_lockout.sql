-- Bloqueio de conta por tentativas de login erradas (proteção contra
-- força bruta). Só a service role (usada pela Edge Function
-- secure-login) toca nesta tabela — RLS ligado, sem nenhuma policy,
-- então anon/authenticated não conseguem ler nem escrever direto.
create table if not exists public.login_attempts (
  email text primary key,
  failed_count int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.login_attempts enable row level security;
