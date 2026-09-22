# Pagamento PagBank (Pix + Cartão) — Cardápio Online

Integração de pagamento real no Cardápio Online (`/pedir`), substituindo o
checkout mockado "Tuna Pagamentos". Segue o mesmo padrão de
[`emit-nfce`](./fiscal-nfce-brasilnfe.md) e da notificação de WhatsApp:
**Edge Function + secrets**, nada de token/dado de cartão no bundle público.

Só o canal **Cardápio Online** usa isto. PDV e mesa continuam com pagamento
físico/manual — nenhuma mudança em `PdvView.tsx`, `TableManagement.tsx` ou no
fechamento de caixa.

## O que está no código

| Peça | Arquivo |
|---|---|
| Tabelas `pagbank_orders`, `payment_webhook_events`, `payment_events` + `orders.pagbank_charge_id` | `supabase/migrations/0053_pagbank_payments.sql` |
| Precificação server-side pura (sem baixar estoque) | RPC `price_public_order_items` (mesma migration) |
| Status público pra polling da tela de pagamento | RPC `get_pagbank_payment_status` (mesma migration) |
| Cria cobrança Pix | `supabase/functions/pagbank-create-pix/index.ts` |
| Cria cobrança de cartão (checkout transparente) | `supabase/functions/pagbank-create-card/index.ts` |
| Recebe e confirma notificações do PagBank | `supabase/functions/pagbank-webhook/index.ts` |
| Cancelamento/estorno (autenticado, permissão `vendas.estornar_pagbank`) | `supabase/functions/pagbank-cancel/index.ts` |
| Config/cliente HTTP compartilhado pelas 4 funções acima | `supabase/functions/_shared/pagbank/client.ts`, `finalize.ts` |
| Helpers puros (URL por ambiente, sanitização de log, parsing da resposta) — compartilhados Deno + Vite/Vitest | `src/lib/pagbank.ts` |
| Componente de checkout (Pix/cartão) no `/pedir` | `src/components/online-menu/PagBankCheckout.tsx` |

## Por que o pedido "nasce" só quando o pagamento é confirmado

Diferente do fluxo antigo (que inseria o pedido e baixava estoque na hora, com
pagamento fingido), aqui:

1. `pagbank-create-pix`/`pagbank-create-card` gravam um registro em
   `pagbank_orders` (status `waiting`) com o rascunho do pedido — **sem tocar
   `orders` nem estoque**.
2. Só quando o pagamento é confirmado (webhook, sempre reconfirmado contra a
   API do PagBank — nunca só o payload) é que `create_order_and_credit_cash`
   (a mesma função já usada por PDV/mesa, **intocada**) é chamada, criando o
   pedido de verdade e baixando o estoque.
3. Pix que expira ou cartão recusado nunca vira `orders` — não precisa de
   rotina de expiração/estorno de estoque.

## Pré-requisitos que o cliente precisa providenciar

1. **Conta PagBank habilitada como recebedora.**
2. **Pelo menos uma chave Pix cadastrada** na conta (obrigatório pra gerar QR Code).
3. **Token de autenticação**:
   - Sandbox: Portal do Desenvolvedor PagBank.
   - Produção: painel PagBank ▸ Vendas ▸ Integrações ▸ Gerar Token.
4. **Chave pública** — diferente do resto, **não fica pronta num painel**: é
   gerada por uma chamada de API,
   `POST {base_url}/public-keys` com `Authorization: Bearer <PAGBANK_TOKEN>` e
   corpo `{"type": "card"}`, que devolve `{"public_key": "...", "created_at": ...}`.
   Recomendação do PagBank: renovar em até 2 anos; a chave antiga continua
   válida por 7 dias depois de gerar uma nova (rotação sem downtime).

## Configuração no servidor (Supabase CLI)

```bash
supabase secrets set \
  PAGBANK_ENV=sandbox \
  PAGBANK_TOKEN=<token do ambiente ativo> \
  PAGBANK_WEBHOOK_URL="https://<project-ref>.supabase.co/functions/v1/pagbank-webhook"

supabase functions deploy pagbank-create-pix --no-verify-jwt
supabase functions deploy pagbank-create-card --no-verify-jwt
supabase functions deploy pagbank-webhook --no-verify-jwt
supabase functions deploy pagbank-cancel
```

Não existe `PAGBANK_WEBHOOK_SECRET`: a autenticidade da notificação usa o
mecanismo oficial do PagBank — ver seção "Autenticidade do webhook" abaixo —
que reaproveita o próprio `PAGBANK_TOKEN`, sem segredo adicional.

`pagbank-cancel` é a única das quatro com `verify-jwt` ligado (padrão) — exige
o funcionário logado com permissão `vendas.estornar_pagbank` (ou admin).

No frontend (`.env`, build-time — ver `.env.example`):

```bash
VITE_PAGBANK_ENV=sandbox
VITE_PAGBANK_PUBLIC_KEY=<chave pública do mesmo ambiente>
```

`VITE_PAGBANK_ENV`/`VITE_PAGBANK_PUBLIC_KEY` e `PAGBANK_ENV`/`PAGBANK_TOKEN`
**precisam sempre apontar pro mesmo ambiente** — um token de sandbox não
autentica no host de produção (e vice-versa), o PagBank devolve 401 na
primeira chamada nesse caso, o que aparece nos logs da função como erro de
configuração.

## Rodando em Sandbox

1. Configure os secrets acima com `PAGBANK_ENV=sandbox` e o token/chave
   pública de sandbox.
2. `supabase functions serve` localmente (ou deploy normal pro ambiente de
   testes).
3. Abra `/pedir`, monte um carrinho, avance até Pagamento.
4. **Pix**: escolha Pix, preencha e-mail/CPF, "Gerar QR Code Pix" — em
   sandbox o PagBank normalmente expõe um jeito de simular a confirmação do
   pagamento (ver painel de sandbox do PagBank). Depois de confirmado, a tela
   de espera troca sozinha pra "Pedido Confirmado" (via polling de
   `get_pagbank_payment_status`).
5. **Cartão**: use os **cartões de teste do PagBank** (fornecidos pelo
   PagBank/pelo cliente — números variam por cenário: aprovado, recusado,
   etc.). O SDK criptografa no navegador; o backend só recebe o `encrypted`.

Cenários que vale testar manualmente antes de ir a produção:
- Pix aprovado (via simulação de sandbox ou webhook real).
- Pix expirado (deixar passar o `expirationDate` sem pagar).
- Cartão aprovado.
- Cartão recusado (cartão de teste de recusa).
- Clique duplo em "Gerar QR Code"/"Pagar" — não deve criar cobrança duplicada
  nem duplicar o pedido (idempotência por `referenceId`).
- Cancelamento/estorno pelo Módulo Fiscal/Vendas.

## Indo pra produção

1. Gerar o token de produção no painel PagBank (Vendas ▸ Integrações ▸ Gerar
   Token) e pegar a chave pública de produção.
2. Trocar `PAGBANK_ENV=production` e `PAGBANK_TOKEN=<token de produção>` nos
   secrets da Edge Function.
3. Trocar `VITE_PAGBANK_ENV=production` e `VITE_PAGBANK_PUBLIC_KEY=<chave de
   produção>` no build do frontend.
4. Reconfigurar `PAGBANK_WEBHOOK_URL` na conta PagBank (produção) se a URL
   pública mudar.
5. Fazer uma compra real de valor baixo de ponta a ponta antes de anunciar.

## Autenticidade do webhook

Mecanismo oficial do PagBank (doc ["Confirmar autenticidade da
notificação"](https://developer.pagbank.com.br/reference/confirmar-autenticidade-da-notificacao)):
a notificação chega com um header `x-authenticity-token`, que é o SHA-256 hex
de `"{PAGBANK_TOKEN}-{corpo bruto da requisição}"`. **Não é uma chamada de
API nem um segredo separado** — usa o mesmo Bearer token já usado nas
chamadas à API.

`pagbank-webhook/index.ts` lê o corpo como texto bruto (`req.text()`) e
calcula o hash **antes** de converter pra JSON — reformatar o JSON primeiro
mudaria o hash e a validação falharia até em notificações legítimas. Se o
hash não bater, a notificação é rejeitada com 401 antes de tocar em qualquer
tabela. A implementação de referência (`sha256Hex`/
`verifyPagBankWebhookSignature`) está em `src/lib/pagbank.ts`, com teste
(`src/lib/pagbank.test.ts`) contra um vetor de hash gerado independentemente
com `node:crypto`.

## Segurança — coisas que NUNCA devem acontecer

- Número de cartão, validade ou CVV em texto puro chegando ao backend —
  só o campo `encrypted` (gerado pelo SDK no navegador) trafega.
- `card`/`encrypted`/`security_code`/`cvv` aparecendo em log — todo
  `provider_response` gravado passa por `sanitizeForLog` (`src/lib/pagbank.ts`)
  antes de ser persistido ou logado.
- Liberar um pedido só porque o **payload** do webhook disse "pago" — o
  webhook sempre faz um `GET /orders/{id}` na API do PagBank antes de
  finalizar (ver `pagbank-webhook/index.ts`), além de validar o header
  `x-authenticity-token`.
- `PAGBANK_TOKEN` no `.env.example` da raiz ou no
  bundle do frontend — são secrets de Edge Function, nunca `VITE_*`.

## Limitações conhecidas desta fase

- PDV e mesa não usam PagBank (decisão de escopo — ver contexto no commit
  desta migration).
- Webhook processa tudo de forma síncrona, sem fila (mesmo padrão do resto do
  repo — não há infraestrutura de fila hoje).
- Rate limiting do endpoint de webhook é best-effort (token na URL + dedupe),
  não uma solução de WAF.
