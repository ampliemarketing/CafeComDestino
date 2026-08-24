-- A policy "self_update_profile" deixa cada usuário atualizar a própria
-- linha em profiles sem restringir quais colunas — isso permite que
-- qualquer usuário autenticado se auto-promova chamando
-- `update profiles set role = 'admin' where id = auth.uid()` direto pela
-- API (ex.: console do navegador), ignorando completamente a UI que só
-- mostra o seletor de cargo para admins.
--
-- Este trigger bloqueia mudanças em role/active/code a menos que quem está
-- fazendo a alteração já seja admin. Roda antes de qualquer UPDATE na
-- tabela, então vale tanto para a policy "self_update_profile" quanto para
-- "admin_update_any_profile" — é a garantia real, as policies são só o
-- primeiro filtro.
--
-- auth.uid() is null identifica conexões feitas com a service_role key
-- (ex.: Edge Functions administrativas), que já contornam RLS por design
-- no Supabase e continuam liberadas.
create or replace function public.prevent_self_privilege_escalation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (new.role is distinct from old.role
      or new.active is distinct from old.active
      or new.code is distinct from old.code)
     and auth.uid() is not null
     and not exists (
       select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
     )
  then
    raise exception 'Apenas administradores podem alterar cargo, status ativo ou PIN de um usuário.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_self_privilege_escalation on profiles;
create trigger trg_prevent_self_privilege_escalation
  before update on profiles
  for each row execute procedure public.prevent_self_privilege_escalation();
