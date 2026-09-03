# Notificações de status de pedido no WhatsApp (Z-API)

Envia um WhatsApp para o cliente em três momentos de um pedido de
delivery/retirada feito em `/pedir`:

| Evento | `order_status` | Origem |
|---|---|---|
| **Pedido recebido** (com o link de acompanhamento) | `novo` | criação em `/pedir` |
| **Em preparo** | `em_preparo` | KDS → "Iniciar Preparo" |
| **Saiu para entrega** | `saiu_entrega` | Gestão de Entregas → "Despachar" |

"Confirmado" (`aceito`), "Pronto" (`pronto`) e "Cancelado" (`cancelado`) **não**
disparam mensagem — mudar isso é só editar a lista `v_status in (...)` no
trigger `tg_notify_order_status_whatsapp`.

## Como funciona

```
App interno (KDS / Gestão de Entregas)
  └─ updateOrderStatus() → UPDATE orders SET order_status = …
       └─ TRIGGER trg_notify_order_status_whatsapp (migration 0046)
            ├─ grava linha em whatsapp_notifications  (fila + idempotência)
            └─ net.http_post → Edge Function `notify-whatsapp`
                 ├─ monta a mensagem PT-BR (nome fantasia, nº do pedido, entregador)
                 ├─ normaliza o telefone → 55 + DDD + número
                 ├─ chama a Z-API  POST /instances/{id}/token/{token}/send-text
                 └─ atualiza whatsapp_notifications (sent / failed + resposta)
```

- **Nada dispara do frontend.** O bundle é público (anon key); o token da Z-API
  só existe como secret da Edge Function.
- **Idempotência:** `whatsapp_notifications` tem `UNIQUE (order_id, status)`.
  Update repetido do mesmo status ou retry de trigger não reenvia.
- **Opt-in (LGPD):** o checkout do `/pedir` tem o checkbox "Quero acompanhar meu
  pedido pelo WhatsApp" (marcado por padrão). Só quem deixa marcado recebe —
  o trigger checa `customer.wantsWhatsappUpdates`.
- **Canais:** só `online`, `whatsapp`, `telefone`. Pedido de mesa/PDV não entra.
- **`saiu_entrega`** só notifica quando `service_type = 'entrega'`.

## Setup (uma vez)

### 1. Aplicar a migration

```
npx supabase db push
```

Aplica `0046_whatsapp_order_notifications.sql` (cria `whatsapp_notifications`, o
trigger e habilita a extensão `pg_net`).

### 2. Secrets da Edge Function

Pegue na Z-API: **ID da instância**, **token da instância** e o
**Account Security Token** (usado no header `Client-Token`). Gere também uma
string aleatória longa para `NOTIFY_WHATSAPP_SECRET` (ex.: `openssl rand -hex 32`).

```
npx supabase secrets set \
  ZAPI_INSTANCE=xxxxxxxxxxxx \
  ZAPI_TOKEN=xxxxxxxxxxxxxxxxxxxx \
  ZAPI_CLIENT_TOKEN=Fxxxxxxxxxxxxxxxxxxx \
  NOTIFY_WHATSAPP_SECRET=<string_aleatoria_longa>
# opcional: ZAPI_BASE_URL=https://api.z-api.io
```

### 3. Deploy da Edge Function

```
npx supabase functions deploy notify-whatsapp --no-verify-jwt
```

`--no-verify-jwt` é obrigatório: o `pg_net` não manda JWT do Supabase, a
autenticação é o header `x-webhook-secret`.

### 4. Apontar o banco para a função

No **SQL Editor** do projeto (substitua `<PROJECT_REF>` e use a MESMA string do
passo 2). A migration 0046 cria a tabela `integration_settings` para isso —
NÃO use `alter database ... set app.*` (o role `postgres` do Supabase não tem
permissão para parâmetros customizados, dá `ERROR: 42501`):

```sql
insert into integration_settings (key, value) values
  ('notify_whatsapp_url',
   'https://<PROJECT_REF>.supabase.co/functions/v1/notify-whatsapp'),
  ('notify_whatsapp_secret', '<string_aleatoria_longa>')
on conflict (key) do update set value = excluded.value, updated_at = now();
```

> Enquanto `notify_whatsapp_url` não existir, o trigger só registra as linhas
> como `queued` e **não quebra nenhum pedido** — dá para aplicar a migration
> antes de configurar o resto.

## Testar

1. Faça um pedido em `/pedir` com o checkbox do WhatsApp marcado e um número
   real. Deve chegar "Recebemos seu pedido #N".
2. No painel da cozinha, "Aceitar Pedido" (sem mensagem) → "Iniciar Preparo"
   → chega o WhatsApp "em preparo".
3. Em Gestão de Entregas, "Despachar" → mensagem "saiu para entrega".
4. Conferir os envios:

```sql
select order_number, status, notification_status, error, provider_message_id, created_at
from whatsapp_notifications
order by created_at desc
limit 20;
```

## Diagnóstico

| Sintoma | Onde olhar |
|---|---|
| Linha fica em `queued` e nunca vira `sent`/`failed` | `app.settings.notify_whatsapp_url` não configurado, ou a função não foi deployada / caiu. Ver logs em `supabase functions logs notify-whatsapp`. |
| `failed` com `Z-API HTTP 4xx` | `provider_response` na linha tem o motivo (instância desconectada, número inválido, token errado). |
| `failed` com `pg_net: ...` | Erro ao enfileirar o request no banco — checar se a extensão `pg_net` está ativa. |
| `skipped` / `telefone inválido` | Telefone do cliente fora do padrão 10–13 dígitos. |
| Nenhuma linha criada no `whatsapp_notifications` | Pedido não é de canal `online/whatsapp/telefone`, ou o cliente não marcou o opt-in, ou o status não está na lista que notifica. |
| Mensagem chega em duplicidade | Não deveria — `UNIQUE (order_id, status)`. Se acontecer, verificar se algum caminho está gerando `order_id` diferente para o mesmo pedido. |

## Reenvio manual de uma etapa

```sql
-- apaga o registro daquela etapa; o próximo UPDATE de status recria e reenvia
delete from whatsapp_notifications where order_id = 'ord-...' and status = 'pronto';
```

## Página pública de acompanhamento (`/acompanhar`)

Migration **0047**. O cliente abre `https://cafecomdestino.ampliechef.com.br/acompanhar?t=<token>`
e vê o status ao vivo (polling a cada 20s), sem login.

- **Token**: UUID gerado no navegador, guardado em `orders.customer->>'trackingToken'`
  (mesmo mecanismo do opt-in — não altera `create_order_and_credit_cash`).
- **Leitura**: RPC `get_order_tracking(token)` (`security definer`, liberada p/ `anon`),
  devolve só campos seguros — status, itens, horários, primeiro nome do
  entregador, total. **Nunca** telefone, endereço completo, forma/estado de
  pagamento ou observações.
- **Link**: aparece na tela de confirmação do `/pedir` (botão "Acompanhar meu
  pedido") e em toda mensagem de WhatsApp (a Edge Function acrescenta a linha
  "📍 Acompanhe seu pedido: …").

### Setup extra da 0047

```
npx supabase db push        # aplica a 0047
npx supabase functions deploy notify-whatsapp --no-verify-jwt   # buildMessage mudou
```

No **SQL Editor**, cadastre a base URL pública (usada para montar o link):

```sql
insert into integration_settings (key, value)
values ('public_base_url', 'https://cafecomdestino.ampliechef.com.br')
on conflict (key) do update set value = excluded.value, updated_at = now();
```

Sem `public_base_url` cadastrada, a mensagem de WhatsApp sai sem o link (o
resto continua funcionando).

### Testar

```sql
-- token de um pedido real
select customer->>'trackingToken' from orders
where customer->>'trackingToken' is not null order by created_at desc limit 1;
```

Abra `/acompanhar?t=<esse token>` no navegador e avance o pedido no KDS — a
página atualiza sozinha.

## Pontos em aberto / futuro

- **Pedidos online criados pelo painel interno** (`OnlineMenuCatalog` →
  `createOnlineOrder`) não têm o campo de consentimento e portanto não
  notificam. Se quiser cobrir, adicionar `wantsWhatsappUpdates` nesse fluxo.
- **Status de entrega da mensagem** (entregue/lida) exigiria uma segunda Edge
  Function recebendo o webhook `message-status` da Z-API.
- **Tela de acompanhamento** para o restaurante: `whatsapp_notifications` já está
  na publicação de realtime e é legível por usuário autenticado.
