-- ============================================================================
-- Criptografa o PIN de fechamento de caixa / autorização (profiles.code).
--
-- ANTES: profiles.code guardava o PIN em TEXTO PURO. A migration 0028 revogou
-- o SELECT da coluna do cliente e a conferência virou server-side
-- (validate_user_pin / validate_manager_pin — migrations 0025/0031), mas quem
-- tem acesso ao banco (dump, backup, SQL Editor, service_role) continuava lendo
-- todos os PINs em claro. O PIN autoriza desconto acima do teto, cortesia,
-- estorno de venda paga e fechamento de caixa — é credencial real.
--
-- DEPOIS: code passa a guardar um hash bcrypt (pgcrypto: crypt + gen_salt('bf')).
-- Um trigger BEFORE INSERT/UPDATE hasheia automaticamente qualquer PIN novo
-- (string de 4 a 8 dígitos) — cobre a Edge Function admin-create-user, o UPDATE
-- direto de profiles feito pela tela de Usuários e qualquer caminho futuro, sem
-- depender do frontend. As funções de validação passam a comparar com
-- crypt(p_pin, code).
--
-- Seguro de aplicar com o caixa aberto: não toca em nenhuma função financeira,
-- só nas de validação de PIN (que já retornavam boolean).
-- ============================================================================

set search_path = public, extensions;

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. Trigger que hasheia o PIN em qualquer escrita
-- ---------------------------------------------------------------------------
-- Um PIN "em claro" é uma string de 4 a 8 dígitos; um hash bcrypt tem 60
-- caracteres e começa com '$2'. O regex abaixo só casa o primeiro caso, então
-- o trigger é idempotente (reaplicar um UPDATE não re-hasheia) e a migração de
-- dados do passo 2 pode rodar sem se preocupar com ordem.
create or replace function public.hash_profile_pin()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.code is not null and new.code ~ '^[0-9]{4,8}$' then
    new.code := crypt(new.code, gen_salt('bf'));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_hash_profile_pin on public.profiles;
create trigger trg_hash_profile_pin
  before insert or update of code on public.profiles
  for each row execute function public.hash_profile_pin();

-- ---------------------------------------------------------------------------
-- 2. Hasheia os PINs já gravados em texto puro
-- ---------------------------------------------------------------------------
update public.profiles
  set code = crypt(code, gen_salt('bf'))
  where code is not null and code ~ '^[0-9]{4,8}$';

-- ---------------------------------------------------------------------------
-- 3. Conferência passa a comparar hash (crypt) em vez de igualdade de texto
-- ---------------------------------------------------------------------------
-- Valida o PIN do PRÓPRIO usuário logado (ex.: confirmar fechamento de caixa).
create or replace function public.validate_user_pin(p_pin text)
returns boolean
language plpgsql
security definer set search_path = public, extensions
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
      and code is not null and code <> ''
      and char_length(coalesce(p_pin, '')) between 4 and 8
      and code = crypt(p_pin, code)
  ) into v_ok;
  if not v_ok then
    perform public.register_pin_failure();
  else
    delete from public.pin_attempts where actor_id = auth.uid();
  end if;
  return v_ok;
end;
$$;

-- Valida o PIN de QUALQUER gerente/admin ativo (ex.: autorizar desconto acima
-- do teto, cortesia, estorno de venda paga).
create or replace function public.validate_manager_pin(p_pin text)
returns boolean
language plpgsql
security definer set search_path = public, extensions
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
      and code is not null and code <> ''
      and char_length(coalesce(p_pin, '')) between 4 and 8
      and code = crypt(p_pin, code)
  ) into v_ok;
  if not v_ok then
    perform public.register_pin_failure();
  else
    delete from public.pin_attempts where actor_id = auth.uid();
  end if;
  return v_ok;
end;
$$;

-- Só informa se o usuário TEM PIN configurado — não expõe o valor. O hash tem
-- 60 chars, então o antigo `char_length(code) between 4 and 8` deixa de valer.
create or replace function public.current_user_has_pin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and active
      and code is not null and code <> ''
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. Grants (create or replace preserva, mas reafirmamos como o resto do repo)
-- ---------------------------------------------------------------------------
revoke execute on function public.validate_user_pin(text)    from public, anon;
revoke execute on function public.validate_manager_pin(text) from public, anon;
revoke execute on function public.current_user_has_pin()     from public, anon;

grant execute on function public.validate_user_pin(text)    to authenticated;
grant execute on function public.validate_manager_pin(text) to authenticated;
grant execute on function public.current_user_has_pin()     to authenticated;
