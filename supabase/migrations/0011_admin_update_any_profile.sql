-- A policy "self_update_profile" só deixa cada usuário editar o próprio
-- registro (auth.uid() = id). Isso bloqueia silenciosamente qualquer admin
-- tentando editar cargo/ativo/PIN de outro usuário em Usuários & Permissões
-- (o update não dá erro visível, só não afeta nenhuma linha). Adiciona uma
-- policy extra (permissiva, combinada com "OR" à já existente) liberando
-- update para quem já é admin.
create policy "admin_update_any_profile" on profiles for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
