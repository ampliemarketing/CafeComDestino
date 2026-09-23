// Edge Function `pagbank-create-pix` — cria um pedido de pagamento PIX no
// PagBank a partir do rascunho de pedido do Cardápio Online (/pedir).
//
// O pedido real (`orders`) NÃO existe ainda quando esta função roda — ela só
// grava um registro pendente em `pagbank_orders`. O pedido só é criado (e o
// estoque só é baixado) quando o pagamento é de fato confirmado, via webhook
// (ver `_shared/pagbank/finalize.ts`). PIX nunca pago = nunca vira `orders`,
// nunca baixa estoque — sem precisar de rotina de expiração.
//
// Chamada pelo frontend: supabase.functions.invoke('pagbank-create-pix', {
//   body: { referenceId, orderDraft }
// })
// Sem autenticação — cardápio público, cliente é sempre anônimo. Deploy com
// --no-verify-jwt.
//
// Secrets: ver cabeçalho de supabase/functions/_shared/pagbank/client.ts.
//
// Formato de POST /orders confirmado num teste real em sandbox (2026-09-22)
// — ver comentário de parsePagBankOrderResponse em src/lib/pagbank.ts.

import { loadPagBankConfig, pagbankFetch, createAdminClient, corsHeaders, json, getClientIp, checkRateLimit } from '../_shared/pagbank/client.ts';
import { sanitizeForLog, parsePagBankOrderResponse, validatePagBankCustomer } from '../../../src/lib/pagbank.ts';

const PIX_EXPIRATION_MINUTES = 30;
// Achado de auditoria (Alto #1): rate limit básico por IP contra abuso —
// gerar Pix em massa não é tão valioso pra fraude quanto testar cartão, mas
// ainda vale limitar (evita spam de cobranças/pedidos pendentes).
const RATE_LIMIT_MAX_HITS = 20;
const RATE_LIMIT_WINDOW_SECONDS = 300; // 5 min

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const body = await req.json().catch(() => null);
  const referenceId = typeof body?.referenceId === 'string' ? body.referenceId.slice(0, 80) : '';
  const draft = body?.orderDraft;
  if (!referenceId || !draft || typeof draft !== 'object' || !Array.isArray(draft.items)) {
    return json({ error: 'Requisição inválida.' }, 400);
  }

  const customerError = validatePagBankCustomer(draft.customer);
  if (customerError) return json({ error: customerError }, 400);

  const admin = createAdminClient();

  const clientIp = getClientIp(req);
  const withinLimit = await checkRateLimit(admin, 'pagbank-create-pix', clientIp, RATE_LIMIT_MAX_HITS, RATE_LIMIT_WINDOW_SECONDS);
  if (!withinLimit) {
    return json({ error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' }, 429);
  }

  // ---- 1. idempotência: clique duplo em "gerar Pix" não cria cobrança nova ----
  const { data: existing } = await admin.from('pagbank_orders').select('*').eq('id', referenceId).maybeSingle();
  if (existing && (existing.status === 'waiting' || existing.status === 'paid')) {
    return json({
      ok: true,
      reused: true,
      status: existing.status,
      qrCodeText: existing.qr_code_text,
      qrCodeImageUrl: existing.qr_code_image_url,
      expirationDate: existing.expiration_date,
      referenceId,
    });
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
    paymentMethod: 'pix',
    paymentStatus: 'aguardando_pagamento',
    orderStatus: 'novo',
    tunaTransactionId: undefined,
    fiscalIssued: false, // orders.fiscal_issued é NOT NULL — precisa vir explícito no draft.
  };

  const config = loadPagBankConfig();

  // ---- 3. integração ainda não configurada → registra e sai sem quebrar ----
  if (!config.token) {
    await admin.from('pagbank_orders').upsert({
      id: referenceId, status: 'error', payment_method: 'pix', amount: total, order_draft: orderDraft,
      error_message: 'PagBank não configurado (secret PAGBANK_TOKEN ausente).',
    });
    return json({ ok: false, notConfigured: true, message: 'Pagamento indisponível no momento. Escolha "pagamento na entrega/retirada".' });
  }

  await admin.from('pagbank_orders').upsert({
    id: referenceId, status: 'waiting', payment_method: 'pix', amount: total, order_draft: orderDraft,
  });

  const expirationDate = new Date(Date.now() + PIX_EXPIRATION_MINUTES * 60 * 1000).toISOString();
  const phoneDigits = String(orderDraft.customer?.phone ?? '').replace(/\D/g, '');
  const taxIdDigits = String(orderDraft.customer?.taxId ?? '').replace(/\D/g, '');

  const payload = {
    reference_id: referenceId,
    customer: {
      name: (orderDraft.customer?.name || 'Consumidor').slice(0, 100),
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
      payment_method: { type: 'PIX', pix: { expiration_date: expirationDate } },
    }],
  };

  let httpStatus = 0;
  let responseBody: any = null;
  try {
    const resp = await pagbankFetch(config, '/orders', { method: 'POST', body: JSON.stringify(payload) });
    httpStatus = resp.status;
    responseBody = await resp.json().catch(() => null);
  } catch (e) {
    await admin.from('pagbank_orders').update({ status: 'error', error_message: `Erro de comunicação: ${String(e)}` }).eq('id', referenceId);
    return json({ error: 'Erro de comunicação com o PagBank. Tente novamente.' }, 502);
  }

  if (httpStatus < 200 || httpStatus >= 300) {
    await admin.from('pagbank_orders').update({
      status: 'error',
      provider_response: sanitizeForLog(responseBody),
      error_message: `HTTP ${httpStatus}`,
    }).eq('id', referenceId);
    await admin.from('payment_events').insert({
      pagbank_order_ref: referenceId, event_type: 'create_error', status: 'error', source: 'create',
      detail: { httpStatus },
    });
    return json({ error: 'Não foi possível gerar o Pix agora. Tente novamente em instantes.' }, 502);
  }

  const parsed = parsePagBankOrderResponse(responseBody);

  await admin.from('pagbank_orders').update({
    status: 'waiting',
    pagbank_order_id: parsed.orderId,
    pagbank_charge_id: parsed.chargeId,
    qr_code_text: parsed.qrCodeText,
    qr_code_image_url: parsed.qrCodeImageUrl,
    expiration_date: expirationDate,
    provider_response: sanitizeForLog(responseBody),
  }).eq('id', referenceId);

  await admin.from('payment_events').insert({
    pagbank_order_ref: referenceId, event_type: 'pix_generated', status: 'waiting', source: 'create',
    detail: { httpStatus },
  });

  return json({
    ok: true, status: 'waiting',
    qrCodeText: parsed.qrCodeText, qrCodeImageUrl: parsed.qrCodeImageUrl,
    expirationDate, referenceId,
  });
});
