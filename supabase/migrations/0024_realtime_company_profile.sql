-- O cardápio público (src/components/online-menu/PublicOnlineMenu.tsx) passa a
-- ouvir mudanças em tempo real: status aberto/fechado, taxa de entrega,
-- pedido mínimo, preço e disponibilidade de produto refletem para o cliente
-- sem recarregar a página.
--
-- products e categories já estão na publication supabase_realtime (schema.sql).
-- company_profile não estava — o toggle "Restaurante Aberto/Fechado" do painel
-- interno grava em company_profile.operating_hours, então sem isso a página
-- pública só via a troca no próximo reload.
--
-- Só o UPDATE da linha única (id = true) importa aqui; a replica identity
-- padrão (chave primária) já cobre o payload `new`, não precisa de `full`.

alter publication supabase_realtime add table company_profile;
