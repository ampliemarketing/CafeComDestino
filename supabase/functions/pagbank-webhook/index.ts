// Edge Function `pagbank-webhook` — recebe as notificações de mudança de
// status do PagBank. URL pública (nenhum JWT do Supabase é enviado pelo
// PagBank) — deploy com --no-verify-jwt.
//
// SEGURANÇA — nunca confia no corpo da notificação pra liberar pedido:
//   1. autenticidade: mecanismo OFICIAL do PagBank (doc "Confirmar
//      autenticidade da notificação" —
//      https://developer.pagbank.com.br/reference/confirmar-autenticidade-da-notificacao).
//      O PagBank manda o header `x-authenticity-token` = SHA-256 hex de
//      "{PAGBANK_TOKEN}-{corpo bruto}". NÃO é uma chamada de API nem um
//      segredo à parte — usa o mesmo Bearer token já usado nas chamadas à
//      API. Por isso o corpo é lido como texto bruto primeiro (`req.text()`)
//      e só convertido pra JSON depois de validar a assinatura — reformatar
//      o JSON antes muda o hash.
//   2. dedupe: grava em payment_webhook_events (unique por evento) ANTES de
//      processar — notificação repetida (reenvio do PagBank) responde 200 e
//      sai sem reprocessar.
//   3. confirmação: sempre faz um GET /orders/{id} no PagBank pra saber o
//      status real, nunca confia no status que veio no corpo do POST.
//   4. auditoria: toda passagem por aqui gera uma linha em payment_events.
//
// Responde 2xx rápido — o trabalho (1 GET no PagBank + no máximo 1 RPC) é
// leve, mesmo padrão síncrono de emit-nfce/notify-whatsapp (sem fila).
//
// Rate limiting: best-effort (não existe infra de rate limiting no projeto —
// ver docs/pagbank.md). A verificação de assinatura + dedupe já reduz bastante
// o efeito de tentativas de abuso (payload sem assinatura válida nem chega a
// tocar o banco).
//
// Secrets: ver cabeçalho de supabase/functions/_shared/pagbank/client.ts.

import { loadPagBankConfig, pagbankFetch, createAdminClient, json } from '../_shared/pagbank/client.ts';
import { sanitizeForLog, parsePagBankOrderResponse, verifyPagBankWebhookSignature } from '../../../src/lib/pagbank.ts';
import { finalizePaidCharge } from '../_shared/pagbank/finalize.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const config = loadPagBankConfig();
  const rawBody = await req.text();
  const authenticityHeader = req.headers.get('x-authenticity-token');
  if (!(await verifyPagBankWebhookSignature(config.token, rawBody, authenticityHeader))) {
    return json({ error: 'Não autorizado.' }, 401);
  }

  const payload = (() => { try { return JSON.parse(rawBody); } catch { return null; } })();
  // PagBank normalmente notifica pelo id do pedido (`id`/`orderId`) — aceita
  // as duas variações de nome que a doc/SDKs costumam usar.
  const pagbankOrderId: string | undefined = payload?.id ?? payload?.orderId ?? payload?.order?.id;
  if (!pagbankOrderId) return json({ error: 'Payload inválido.' }, 400);

  const admin = createAdminClient();

  // ---- 1. dedupe ANTES de qualquer processamento ----
  // Chave do evento: id da notificação quando o PagBank manda um, senão um
  // valor sintético orderId+status (mesmo evento reenviado gera a mesma
  // chave e cai no conflito de unique(provider,event_key) abaixo). A
  // idempotência "de verdade" contra reprocessar a MESMA transição de status
  // duas vezes é em finalizePaidCharge, que checa created_order_id — este
  // dedupe aqui só evita trabalho repetido (chamada extra ao PagBank).
  const eventKey = String(
    payload?.id ?? payload?.notificationId ?? `${pagbankOrderId}:${payload?.charges?.[0]?.status ?? payload?.status ?? ''}`,
  );

  // upsert + ignoreDuplicates = INSERT ... ON CONFLICT DO NOTHING: evento
  // repetido não gera erro, só devolve sem linha — sinal de "já visto".
  const { data: inserted } = await admin
    .from('payment_webhook_events')
    .upsert({ provider: 'pagbank', event_key: eventKey, payload: sanitizeForLog(payload) }, {
      onConflict: 'provider,event_key',
      ignoreDuplicates: true,
    })
    .select('id')
    .maybeSingle();

  if (!inserted) {
    // conflito de unique(provider, event_key) → evento já processado.
    return json({ ok: true, duplicate: true });
  }

  // ---- 2. confirma o status real direto na API — nunca confia no payload ----
  let httpStatus = 0;
  let orderBody: any = null;
  try {
    const resp = await pagbankFetch(config, `/orders/${pagbankOrderId}`, { method: 'GET' });
    httpStatus = resp.status;
    orderBody = await resp.json().catch(() => null);
  } catch (e) {
    return json({ error: `Erro ao confirmar status junto ao PagBank: ${String(e)}` }, 502);
  }

  if (httpStatus < 200 || httpStatus >= 300 || !orderBody) {
    return json({ error: `Falha ao confirmar status (HTTP ${httpStatus}).` }, 502);
  }

  const parsed = parsePagBankOrderResponse(orderBody);
  const referenceId: string | undefined = orderBody?.reference_id ?? orderBody?.charges?.[0]?.reference_id;

  if (!referenceId) {
    await admin.from('payment_events').insert({
      event_type: 'webhook_unmatched', status: parsed.status, source: 'webhook',
      detail: { pagbankOrderId },
    });
    return json({ ok: true, unmatched: true });
  }

  await admin.from('payment_events').insert({
    pagbank_order_ref: referenceId, event_type: 'status_confirmed', status: parsed.status, source: 'webhook',
    detail: { httpStatus, pagbankOrderId },
  });

  if (parsed.status === 'PAID') {
    const result = await finalizePaidCharge(admin, referenceId, 'webhook', orderBody);
    return json({ ok: result.ok, orderId: result.orderId });
  }

  if (parsed.status === 'DECLINED' || parsed.status === 'CANCELED') {
    await admin.from('pagbank_orders')
      .update({ status: parsed.status === 'DECLINED' ? 'declined' : 'cancelled', provider_response: sanitizeForLog(orderBody) })
      .eq('id', referenceId)
      .is('created_order_id', null); // nunca desfaz um pedido já finalizado
    return json({ ok: true, status: parsed.status });
  }

  // WAITING / IN_ANALYSIS / UNKNOWN: só registra, sem mudar o pedido.
  return json({ ok: true, status: parsed.status });
});
