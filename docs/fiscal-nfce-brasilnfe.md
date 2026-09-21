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
   QR Code da NFC-e; sem ele a nota não autoriza. **Cadastrado uma única vez na
   Brasil NFe** (não é enviado por nota — ver seção abaixo).
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
  BRASILNFE_BASE_URL='https://api.brasilnfe.com.br/services/'

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

## CSC — cadastro único na Brasil NFe (não é enviado por nota)

Confirmado por teste ponta-a-ponta em 2026-09-20: `EnviarNotaFiscal` **não tem
campos `Csc`/`IdTokenCsc`** — enviá-los não tem efeito algum. Quem assina o QR
Code é o CSC cadastrado **uma vez** na própria empresa, no endpoint
`POST /empresa/EditarEmpresa` (headers `Token` + `UserToken`), dentro de:

```json
{
  "Configuracao": {
    "NFCe": {
      "IdCSCProducao": "000001",
      "CSCProducao": "<csc de produção, exatamente como na SEFAZ>",
      "IdCSCHomologacao": "000001",
      "CSCHomologacao": "<csc de homologação, exatamente como na SEFAZ>"
    }
  }
}
```

O **ID sempre com 6 dígitos** (ex. `"000001"`, não `"1"`) — foi exatamente
enviar `"1"` sem zeros à esquerda (ou não configurar isso na empresa) que
causou a rejeição SEFAZ 462 *"Código Identificador do CSC no QR-Code não
cadastrado na SEFAZ"* mesmo com o CSC correto e ativo no portal da SEFAZ.

Configure isso pelo **painel da Brasil NFe** (Empresas ▸ Editar ▸ aba NFC-e) —
mais seguro que chamar `EditarEmpresa` via API, já que esse endpoint espera o
objeto completo da empresa e um payload parcial pode sobrescrever outros
campos já cadastrados.

## Fase 0 — teste isolado (recomendado antes de ligar no app)

`scripts/brasilnfe-smoke.mjs` monta um payload NFC-e mínimo em **homologação** e
chama `EnviarNotaFiscal`, salvando o XML e a DANFCE retornados. Serve para
validar credenciais e certificado — **o CSC precisa já estar configurado na
empresa** (seção acima), senão a SEFAZ rejeita com o erro 462 mesmo com tudo
mais certo.

```bash
BRASILNFE_TOKEN=... BRASILNFE_USER_TOKEN=... node scripts/brasilnfe-smoke.mjs
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
