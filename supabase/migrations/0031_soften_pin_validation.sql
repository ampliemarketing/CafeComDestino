-- Ajuste no fluxo de PIN:
-- 1. O bloqueio por tentativas (pin_attempts) NÃO deve mais lançar exceção —
--    isso mascarava o erro real ("PIN não configurado") e travava o teste.
--    Passa a só retornar false quando bloqueado; a UI mostra a mensagem.
-- 2. Limite mais folgado (10 erros / 2 min).
-- 3. Nova função current_user_has_pin() pra a tela de fechamento avisar com
--    precisão "você não tem PIN, peça a um administrador".

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
    locked_until = case when public.pin_attempts.failed_count + 1 >= 10
                        then now() + interval '2 minutes' else null end,
    updated_at = now();
end;
$$;

create or replace function public.current_user_has_pin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and active
      and code is not null and char_length(code) between 4 and 8
  );
$$;

create or replace function public.validate_user_pin(p_pin text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_ok boolean;
begin
  if public.pin_is_locked() then
    return false;
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

create or replace function public.validate_manager_pin(p_pin text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_ok boolean;
begin
  if public.pin_is_locked() then
    return false;
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

revoke execute on function public.current_user_has_pin() from public, anon;
grant execute on function public.current_user_has_pin() to authenticated;

-- Limpa bloqueios acumulados durante os testes.
delete from public.pin_attempts;
