-- ============================================================================
-- Permissão própria para abrir/fechar o restaurante (botão "Restaurante
-- Aberto/Fechado" da barra do topo — grava company_profile.operating_hours,
-- que o /pedir usa pra aceitar ou recusar pedido).
--
-- ANTES: o botão aparecia para qualquer usuário logado (ex.: garçom fechava o
-- restaurante). A 0055 passou a exigir empresa.editar_perfil para essa coluna,
-- mas ela não tem nada a ver com editar o perfil — agora é
-- online_menu.abrir_fechar_loja, e só ela.
--
-- Deploy conjunto com o frontend (Navbar + catálogo em src/lib/permissions.ts).
-- ============================================================================

set search_path = public;

-- ---------------------------------------------------------------------------
-- 1. Policy de UPDATE inclui a chave nova (o trigger confere coluna a coluna)
-- ---------------------------------------------------------------------------
drop policy if exists permission_update_company_profile on public.company_profile;
create policy permission_update_company_profile on public.company_profile
  for update
  using (public.has_any_permission(array[
    'empresa.editar_perfil', 'empresa.editar_midia', 'empresa.editar_precos_buffet',
    'empresa.editar_regras_caixa', 'fiscal.editar_dados_empresa', 'online_menu.abrir_fechar_loja'
  ]))
  with check (public.has_any_permission(array[
    'empresa.editar_perfil', 'empresa.editar_midia', 'empresa.editar_precos_buffet',
    'empresa.editar_regras_caixa', 'fiscal.editar_dados_empresa', 'online_menu.abrir_fechar_loja'
  ]));

-- ---------------------------------------------------------------------------
-- 2. Trigger da 0055 + grupo "loja" (operating_hours)
-- ---------------------------------------------------------------------------
create or replace function public.guard_company_profile_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  o jsonb := to_jsonb(old);
  n jsonb := to_jsonb(new);
  -- name/address são editados tanto no Perfil quanto no Fiscal (razão social,
  -- código IBGE) — basta uma das duas permissões.
  c_shared text[] := array['name', 'address'];
  c_fiscal text[] := array['cnpj', 'ie', 'fiscal_info'];
  c_media  text[] := array['logo_url', 'cover_url'];
  c_buffet text[] := array['buffet_prices'];
  c_rules  text[] := array['service_fee_percent', 'service_fee_enabled', 'couvert_value',
                           'couvert_enabled', 'blind_conference_threshold', 'discount_limits'];
  c_store  text[] := array['operating_hours'];
  k text;
begin
  if auth.uid() is null then
    return new;
  end if;

  foreach k in array c_shared loop
    if o->k is distinct from n->k
       and not public.has_any_permission(array['empresa.editar_perfil', 'fiscal.editar_dados_empresa']) then
      raise exception 'Sem permissão para alterar o nome/endereço da empresa.';
    end if;
  end loop;
  foreach k in array c_fiscal loop
    if o->k is distinct from n->k and not public.has_any_permission(array['fiscal.editar_dados_empresa']) then
      raise exception 'Sem permissão para alterar os dados fiscais da empresa.';
    end if;
  end loop;
  foreach k in array c_media loop
    if o->k is distinct from n->k and not public.has_any_permission(array['empresa.editar_midia']) then
      raise exception 'Sem permissão para alterar logo/capa do cardápio.';
    end if;
  end loop;
  foreach k in array c_buffet loop
    if o->k is distinct from n->k and not public.has_any_permission(array['empresa.editar_precos_buffet']) then
      raise exception 'Sem permissão para alterar os preços do buffet.';
    end if;
  end loop;
  foreach k in array c_rules loop
    if o->k is distinct from n->k and not public.has_any_permission(array['empresa.editar_regras_caixa']) then
      raise exception 'Sem permissão para alterar as regras de caixa (taxa de serviço, couvert, teto de desconto).';
    end if;
  end loop;
  foreach k in array c_store loop
    if o->k is distinct from n->k and not public.has_any_permission(array['online_menu.abrir_fechar_loja']) then
      raise exception 'Sem permissão para abrir/fechar o restaurante.';
    end if;
  end loop;

  -- Qualquer outra coluna (telefone, entrega, pedido mínimo, cor, etc.).
  if (o - c_shared - c_fiscal - c_media - c_buffet - c_rules - c_store)
     is distinct from (n - c_shared - c_fiscal - c_media - c_buffet - c_rules - c_store)
     and not public.has_any_permission(array['empresa.editar_perfil']) then
    raise exception 'Sem permissão para editar o perfil da empresa.';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Backfill: quem opera a casa continua abrindo/fechando. Garçom e cozinha
--    (que tinham o botão só por falha) ficam de fora; admin é liberado por role.
-- ---------------------------------------------------------------------------
update public.profiles set permissions = (
  select array_agg(distinct p) from unnest(permissions || array['online_menu.abrir_fechar_loja']) p
) where role in ('gerente', 'caixa')
   or permissions && array['empresa.editar_perfil'];
