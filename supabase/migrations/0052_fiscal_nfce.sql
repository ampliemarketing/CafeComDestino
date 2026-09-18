-- ============================================================================
-- Emissão de NFC-e (modelo 65) via emissora externa Brasil NFe — Fase 1
-- (homologação, disparo MANUAL por botão).
--
-- OBJETIVO: guardar o documento fiscal de cada pedido (chave de acesso Sefaz,
-- protocolo, XML autorizado, DANFCE em PDF, status e motivo de rejeição) numa
-- tabela própria. Hoje o pedido só tinha `orders.fiscal_issued` (boolean) e
-- `orders.nfce_key` (que era preenchido com um valor ALEATÓRIO de simulação).
--
-- ARQUITETURA (mesmo padrão do WhatsApp/Z-API na migration 0046):
--
--   Botão "Emitir NFC-e" (Vendas / Módulo Fiscal)
--        │  supabase.functions.invoke('emit-nfce', { orderId })
--        ▼
--   Edge Function `emit-nfce`  (Deno, verify-jwt ligado)
--        │  • valida permissão do funcionário pelo JWT
--        │  • lê order + itens + company_profile + products/tax_groups (service role)
--        │  • resolve os dados fiscais de cada item (grupo tributário manda)
--        │  • monta o payload EnviarNotaFiscal (ModeloDocumento 65)
--        │  • POST https://api.brasilnfe.com.br/services/Fiscal/EnviarNotaFiscal
--        ▼
--   fiscal_invoices  (1 linha por pedido — UNIQUE(order_id))
--        │  status: processando | autorizada | rejeitada | cancelada | erro
--        ▼
--   se autorizada → UPDATE orders SET fiscal_issued = true, nfce_key = <chave>
--
-- Por que NÃO emitir do frontend: o bundle é público (anon key), então o Token
-- da Brasil NFe, o UserToken e a senha do certificado A1 NÃO podem sair no JS.
-- Tudo isso vive só como secret da Edge Function.
--
-- SEGURO DE APLICAR com caixa aberto / pedidos em andamento: só adiciona uma
-- tabela nova, sem tocar em nenhuma função financeira nem no fluxo de venda.
-- Enquanto os secrets da Brasil NFe não estiverem configurados, a Edge Function
-- apenas grava uma linha `status = 'erro'` com o motivo e devolve ok:false — não
-- quebra nada.
--
-- ----------------------------------------------------------------------------
-- CONFIGURAÇÃO (rodar UMA vez, fora da migration):
--
--   Secrets da Edge Function (Supabase CLI):
--     supabase secrets set \
--       BRASILNFE_TOKEN=...            # token de emissão (header Token) \
--       BRASILNFE_USER_TOKEN=...       # token do módulo Empresa (header UserToken) \
--       BRASILNFE_BASE_URL=https://api.brasilnfe.com.br/services/ \
--       BRASILNFE_CSC=...             # Código de Segurança do Contribuinte (SEFAZ) \
--       BRASILNFE_CSC_ID=...          # ID do CSC (ex.: 000001) \
--       BRASILNFE_CERT_BASE64=...     # .pfx do certificado A1 em base64 \
--       BRASILNFE_CERT_PASSWORD=...   # senha do .pfx
--     supabase functions deploy emit-nfce
--
--   O ambiente (homologação x produção) NÃO vem de secret: é lido de
--   company_profile.fiscal_info.environment  ('homologation' | 'production'),
--   editável na aba "Dados da Empresa Emitente".
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Documento fiscal por pedido. RLS: funcionário logado só LÊ. Ninguém
--    escreve pelo PostgREST — só a Edge Function (service role, ignora RLS).
-- ----------------------------------------------------------------------------
create table if not exists fiscal_invoices (
  id                text primary key,
  order_id          text not null references orders(id) on delete cascade,
  modelo            int  not null default 65,          -- 65 = NFC-e, 55 = NF-e
  serie             int,
  numero            bigint,
  ambiente          int  not null default 2,           -- 2 = homologação, 1 = produção
  status            text not null default 'processando'
    check (status in ('processando', 'autorizada', 'rejeitada', 'cancelada', 'erro')),
  chave             text,                               -- chave de acesso (44 dígitos)
  protocolo         text,                               -- nº do protocolo de autorização
  xml               text,                               -- XML assinado/autorizado
  danfe_base64      text,                               -- DANFCE (PDF) em base64
  rejeicao_codigo   text,                               -- cStat da Sefaz quando != 100
  rejeicao_motivo   text,                               -- xMotivo / mensagem de erro
  cancelamento_motivo text,
  provider_response jsonb,                              -- resposta crua da Brasil NFe
  emitted_by        text,                               -- auth.uid() de quem disparou
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (order_id)                                     -- 1 documento por pedido (Fase 1)
);

create index if not exists fiscal_invoices_order_idx   on fiscal_invoices (order_id);
create index if not exists fiscal_invoices_created_idx on fiscal_invoices (created_at desc);
create index if not exists fiscal_invoices_status_idx  on fiscal_invoices (status);

alter table fiscal_invoices enable row level security;

drop policy if exists "authenticated_read_fiscal_invoices" on fiscal_invoices;
create policy "authenticated_read_fiscal_invoices"
  on fiscal_invoices for select
  using (auth.role() = 'authenticated');

-- Realtime: a aba "Notas Fiscais Emitidas" acompanha a autorização ao vivo.
do $$
begin
  alter publication supabase_realtime add table fiscal_invoices;
exception when duplicate_object then null;
end $$;

-- ----------------------------------------------------------------------------
-- 2. `updated_at` automático.
-- ----------------------------------------------------------------------------
create or replace function public.tg_fiscal_invoices_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_fiscal_invoices_touch on public.fiscal_invoices;
create trigger trg_fiscal_invoices_touch
  before update on public.fiscal_invoices
  for each row execute function public.tg_fiscal_invoices_touch();
