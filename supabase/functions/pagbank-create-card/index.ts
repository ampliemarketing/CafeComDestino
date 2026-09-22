// Edge Function `pagbank-create-card` — cobrança de cartão de crédito/débito
// via checkout transparente. O cartão já chega criptografado do navegador
// (SDK oficial do PagBank, `encryptCard`) — esta função NUNCA recebe número,
// validade ou CVV em texto puro, só o campo `encrypted`. Ele é repassado
// direto pro PagBank e nunca é persistido além desta chamada (não entra em
// nenhuma coluna de `pagbank_orders`, nem em log — ver sanitizeForLog).
//
// Mesma lógica de rascunho pendente de pagbank-create-pix: o pedido só vira
// `orders`/baixa estoque quando o pagamento é confirmado. Cartão costuma
// responder o status já na chamada síncrona (capture=true) — quando aprovado,
// finaliza na hora; o webhook, quando chegar depois, só confirma de novo
// (idempotente, ver _shared/pagbank/finalize.ts).
//
// Chamada pelo frontend: supabase.functions.invoke('pagbank-create-card', {
//   body: { referenceId, orderDraft, encryptedCard, holderName, holderTaxId, installments }
// })
// Sem autenticação — cardápio público. Deploy com --no-verify-jwt.
//
// Secrets: ver cabeçalho de supabase/functions/_shared/pagbank/client.ts.
//
// TODO(fase-0): confirmar em sandbox o formato exato de payment_method.card e
// a tabela completa de payment_response.code antes de produção.

import { loadPagBankConfig, pagbankFetch, createAdminClient, corsHeaders, json } from '../_shared/pagbank/client.ts';
import { sanitizeForLog, parsePagBankOrderResponse, translateDeclineMessage } from '../../../src/lib/pagbank.ts';
import { finalizePaidCharge } from '../_shared/pagbank/finalize.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const body = await req.json().catch(() => null);
  const referenceId = typeof body?.referenceId === 'string' ? body.referenceId.slice(0, 80) : '';
  const draft = body?.orderDraft;
  const encryptedCard = typeof body?.encryptedCard === 'string' ? body.encryptedCard : '';
  const holderName = typeof body?.holderName === 'string' ? body.holderName.slice(0, 100) : '';
  const holderTaxId = String(body?.holderTaxId ?? '').replace(/\D/g, '');
  const installments = Number.isInteger(body?.installments) && body.installments > 0 ? body.installments : 1;
  const cardType = body?.cardType === 'DEBIT_CARD' ? 'DEBIT_CARD' : 'CREDIT_CARD';

  if (!referenceId || !draft || typeof draft !== 'object' || !Array.isArray(draft.items)) {
    return json({ error: 'Requisição inválida.' }, 400);
  }
  if (!encryptedCard || !holderName || !holderTaxId) {
    return json({ error: 'Dados do cartão incompletos.' }, 400);
  }

  const admin = createAdminClient();

  // ---- 1. idempotência: enquanto uma tentativa está em andamento, não deixa
  // criar outra cobrança pro mesmo referenceId (evita duplo clique em "pagar"
  // cobrando o cliente duas vezes) ----
  const { data: existing } = await admin.from('pagbank_orders').select('*').eq('id', referenceId).maybeSingle();
  if (existing) {
    if (existing.status === 'paid') {
      return json({ ok: true, status: 'paid', orderId: existing.created_order_id, referenceId });
    }
    if (existing.status === 'waiting') {
      return json({ ok: false, processing: true, message: 'Já existe uma cobrança em andamento para este pedido.' }, 409);
    }
    // declined/cancelled/error: segue e tenta de novo com uma cobrança nova.
  }

  // ---- 2. precifica no servidor — nunca confia no total que o cliente mandou ----
  const { data: priced, error: priceErr } = await admin.rpc('price_public_order_items', {
    p_items: draft.items,
    p_delivery_fee: Number(draft.deliveryFee) || 0,
  });
  if (priceErr || !priced) {
    return json({ error: priceErr?.message || 'Não foi possível calcular o total do pedido.' }, 400);
  }
  const total = Number(priced.total);
  if (!(total > 0)) return json({ error: 'Total do pedido inválido.' }, 400);

  const orderId = 'ord-' + crypto.randomUUID();
  const orderDraft = {
    ...draft,
    id: orderId,
    channel: 'online',
    items: priced.items,
    subtotal: priced.subtotal,
    deliveryFee: priced.deliveryFee,
    discount: 0,
    total,
    paymentMethod: cardType === 'DEBIT_CARD' ? 'cartao_debito' : 'cartao_credito',
    paymentStatus: 'aguardando_pagamento',
    orderStatus: 'novo',
    tunaTransactionId: undefined,
    fiscalIssued: false, // orders.fiscal_issued é NOT NULL — precisa vir explícito no draft.
  };

  const config = loadPagBankConfig();

  if (!config.token) {
    await admin.from('pagbank_orders').upsert({
      id: referenceId, status: 'error', payment_method: orderDraft.paymentMethod, amount: total, order_draft: orderDraft,
      error_message: 'PagBank não configurado (secret PAGBANK_TOKEN ausente).',
    });
    return json({ ok: false, notConfigured: true, message: 'Pagamento por cartão indisponível no momento.' });
  }

  await admin.from('pagbank_orders').upsert({
    id: referenceId, status: 'waiting', payment_method: orderDraft.paymentMethod, amount: total, order_draft: orderDraft,
  });

  const phoneDigits = String(orderDraft.customer?.phone ?? '').replace(/\D/g, '');
  const taxIdDigits = String(orderDraft.customer?.taxId ?? '').replace(/\D/g, '') || holderTaxId;

  const payload = {
    reference_id: referenceId,
    customer: {
      name: (orderDraft.customer?.name || holderName).slice(0, 100),
      ...(orderDraft.customer?.email ? { email: orderDraft.customer.email } : {}),
      ...(taxIdDigits ? { tax_id: taxIdDigits } : {}),
      ...(phoneDigits.length >= 10 ? { phones: [{ country: '55', area: phoneDigits.slice(0, 2), number: phoneDigits.slice(2), type: 'MOBILE' }] } : {}),
    },
    items: priced.items.map((it: any) => ({
      reference_id: it.productId,
      name: String(it.productName || 'Item').slice(0, 100),
      quantity: it.quantity,
      unit_amount: Math.round(Number(it.unitPrice) * 100),
    })),
    notification_urls: config.webhookUrl ? [config.webhookUrl] : [],
    charges: [{
      reference_id: referenceId,
      description: 'Pedido Café com Destino',
      amount: { value: Math.round(total * 100), currency: 'BRL' },
      payment_method: {
        type: cardType,
        installments,
        capture: true,
        card: { encrypted: encryptedCard },
        holder: { name: holderName, tax_id: holderTaxId },
      },
    }],
  };

  let httpStatus = 0;
  let responseBody: any = null;
  try {
    // O log da requisição em si nunca inclui `payload` bruto (teria o
    // `encrypted`) — só a resposta do PagBank é gravada, e sempre sanitizada.
    const resp = await pagbankFetch(config, '/orders', { method: 'POST', body: JSON.stringify(payload) });
    httpStatus = resp.status;
    responseBody = await resp.json().catch(() => null);
  } catch (e) {
    await admin.from('pagbank_orders').update({ status: 'error', error_message: `Erro de comunicação: ${String(e)}` }).eq('id', referenceId);
    return json({ error: 'Erro de comunicação com o PagBank. Tente novamente.' }, 502);
  }

  const parsed = parsePagBankOrderResponse(responseBody);

  await admin.from('pagbank_orders').update({
    pagbank_order_id: parsed.orderId,
    pagbank_charge_id: parsed.chargeId,
    provider_response: sanitizeForLog(responseBody),
  }).eq('id', referenceId);

  if (httpStatus < 200 || httpStatus >= 300 || parsed.status === 'DECLINED') {
    const friendly = translateDeclineMessage(parsed.declineCode, parsed.declineMessage);
    await admin.from('pagbank_orders').update({ status: 'declined', error_message: friendly }).eq('id', referenceId);
    await admin.from('payment_events').insert({
      pagbank_order_ref: referenceId, event_type: 'card_declined', status: 'declined', source: 'create',
      detail: { httpStatus, declineCode: parsed.declineCode },
    });
    return json({ ok: false, declined: true, message: friendly });
  }

  if (parsed.status === 'PAID') {
    const result = await finalizePaidCharge(admin, referenceId, 'create', responseBody);
    if (!result.ok) {
      return json({ error: 'Pagamento aprovado, mas houve uma falha ao concluir o pedido. Fale com o restaurante informando o horário desta compra.' }, 500);
    }
    return json({ ok: true, status: 'paid', orderId: result.orderId, orderNumber: result.orderNumber, referenceId });
  }

  // IN_ANALYSIS / WAITING: fica pendente — o webhook confirma depois.
  await admin.from('pagbank_orders').update({ status: 'waiting' }).eq('id', referenceId);
  return json({ ok: true, status: 'waiting', message: 'Pagamento em análise. Avisaremos assim que for confirmado.', referenceId });
});
