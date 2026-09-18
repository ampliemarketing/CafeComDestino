# Emissão de NFC-e via Brasil NFe — Fase 1 (homologação, disparo manual)

Integração da emissão de NFC-e (modelo 65) com a emissora externa
**Brasil NFe** (`https://www.brasilnfe.com.br`). Segue o mesmo padrão da
notificação de WhatsApp: **Edge Function + secrets**, nada de token/certificado
no bundle público.

## O que já está no código (esta fase)

| Peça | Arquivo |
|---|---|
| Tabela `fiscal_invoices` (1 documento fiscal por pedido) | `supabase/migrations/0052_fiscal_nfce.sql` |
| Edge Function que monta o payload e chama a Brasil NFe | `supabase/functions/emit-nfce/index.ts` |
| Mapa forma de pagamento → `tPag`, rateio de desconto por item | `src/lib/fiscal.ts` (`PAYMENT_METHOD_SEFAZ`, `sefazPaymentEntries`, `prorateDiscount`) |
| `issueNfce()` chamando a Edge Function (era simulação) | `src/context/AppContext.tsx` |
| Aba "Notas Fiscais" lendo `fiscal_invoices`, download real de XML/DANFCE, botão "Emitir/Reenviar", campos CSC ID / IBGE / ambiente | `src/components/fiscal/FiscalManagement.tsx` |

O disparo é **manual**: botão **"Emitir NFC-e"** em *Vendas* (por pedido) e em
*Módulo Fiscal ▸ Notas Fiscais* (lista "Pedidos sem NFC-e" e botão "Reenviar"
nas rejeitadas). O fechamento de venda **não** emite nota automaticamente — o
pedido nasce com `fiscalIssued: false`.

> ⚠️ Mudança de comportamento: antes toda venda de PDV/comanda era marcada como
> "NFC-e emitida" com uma chave **aleatória de simulação**. Isso foi removido.
> Agora "emitida" só aparece depois de uma autorização real da SEFAZ.

## Pré-requisitos que o cliente / contador precisa providenciar

1. **Conta na Brasil NFe** → gerar **`Token`** (emissão) e **`UserToken`**
   (módulo Empresa / certificado).
2. **Certificado digital A1** da empresa (arquivo `.pfx` + senha). ICP-Brasil,
   CNPJ real.
3. **Credenciamento como emissor de NFC-e** na SEFAZ do estado (SP: Posto
   Fiscal Eletrônico).
4. **CSC + ID do CSC** (Código de Segurança do Contribuinte) — gerado no portal
   da SEFAZ. **Um par para homologação, outro para produção.** É o que assina o
   QR Code da NFC-e; sem ele a nota não autoriza.
5. **Dados fiscais reais dos produtos** (NCM, CFOP, CSOSN/CST, alíquotas de
   PIS/COFINS) — definidos pelo contador e cadastrados em
   *Módulo Fiscal ▸ Grupos Tributários*.
6. Dados do emitente corretos em *Módulo Fiscal ▸ Dados da Empresa Emitente*:
   CNPJ, IE, razão social, **código IBGE do município** (7 dígitos), **ID do
   CSC**, **Ambiente = Homologação**, **Série da NFC-e**.

## Configuração no servidor (uma vez)

```bash
supabase secrets set \
  BRASILNFE_TOKEN='...' \
  BRASILNFE_USER_TOKEN='...' \
  BRASILNFE_BASE_URL='https://api.brasilnfe.com.br/services/' \
  BRASILNFE_CSC='...' \
  BRASILNFE_CSC_ID='000001'

supabase functions deploy emit-nfce
```

Aplicar a migration:

```bash
supabase db push        # ou rodar 0052_fiscal_nfce.sql no SQL Editor
```

Cadastro da empresa + upload do certificado A1 na Brasil NFe (via SDK/painel
deles, ou pelo script de smoke abaixo). Enquanto `BRASILNFE_TOKEN` não estiver
setado, a Edge Function grava `fiscal_invoices.status = 'erro'` com o motivo e
devolve `{ ok:false, notConfigured:true }` — nada quebra.

## Fase 0 — teste isolado (recomendado antes de ligar no app)

`scripts/brasilnfe-smoke.mjs` monta um payload NFC-e mínimo em **homologação** e
chama `EnviarNotaFiscal`, salvando o XML e a DANFCE retornados. Serve para
validar credenciais, certificado, CSC e o **formato exato dos campos** do
payload (a doc REST pública é resumida — pode ser preciso ajustar nomes de
campos em `supabase/functions/emit-nfce/index.ts::buildNfcePayload`).

```bash
BRASILNFE_TOKEN=... BRASILNFE_USER_TOKEN=... BRASILNFE_CSC=... BRASILNFE_CSC_ID=... \
node scripts/brasilnfe-smoke.mjs
```

## Pendências conhecidas (próximas fases)

- **Campo "CPF/CNPJ na nota"** no checkout do PDV/comanda — o modelo de dados já
  aceita (`Order.customer.taxId`), falta o input. Sem ele a NFC-e sai sem
  identificação do consumidor (permitido).
- Emissão **automática** no fechamento da venda (toggle).
- **Cancelamento** de NFC-e (evento `cancelarNotaFiscal`, justificativa ≥ 15
  caracteres, dentro do prazo) — atrás de permissão.
- Numeração: hoje quem numera é a Brasil NFe (guardamos `numero`/`serie` da
  resposta). Confirmar no smoke test se é preciso enviar `Numero`.
- QR Code + protocolo na impressão do cupom (`src/lib/printReceipt.ts`).
- Contingência offline / fila de reenvio para rejeição transitória da SEFAZ.
- NF-e modelo 55 (delivery para CNPJ, notas de entrada).
