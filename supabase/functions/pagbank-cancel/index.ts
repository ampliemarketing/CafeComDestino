// Edge Function `pagbank-cancel` — cancelamento/estorno (total ou parcial) de
// uma cobrança PagBank já paga. Chamada autenticada, só por funcionário com
// permissão `vendas.estornar_pagbank` (ou admin) — mesmo padrão de
// verificação de emit-nfce.
//
// Prazos de reembolso por método (cartão até 350 dias, Pix até 90 dias) são
// responsabilidade do próprio PagBank — esta função só repassa o pedido;
// se o prazo já passou, o PagBank recusa e o erro é devolvido de forma
// amigável.
//
// Chamada pelo frontend: supabase.functions.invoke('pagbank-cancel', {
//   body: { orderId, amount? }   // amount omitido = estorno total
// })
// Verify-jwt ON (padrão) — precisa do JWT do funcionário logado.
//
// Secrets: ver cabeçalho de supabase/functions/_shared/pagbank/client.ts.

import { loadPagBankConfig, pagbankFetch, createAdminClient, createCallerClient, corsHeaders, json } from '../_shared/pagbank/client.ts';
import { sanitizeForLog } from '../../../src/lib/pagbank.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Não autenticado.' }, 401);

  const caller = createCallerClient(authHeader);
  const { data: { user }, error: userErr } = await caller.auth.getUser();
  if (userErr || !user) return json({ error: 'Não autenticado.' }, 401);

  const { data: profile } = await caller.from('profiles').select('role, permissions').eq('id', user.id).single();
  const perms: string[] = Array.isArray(profile?.permissions) ? profile!.permissions : [];
  const allowed = profile?.role === 'admin' || perms.includes('vendas.estornar_pagbank');
  if (!allowed) return json({ error: 'Sem permissão para estornar pagamento PagBank.' }, 403);

  const body = await req.json().catch(() => null);
  const orderId = typeof body?.orderId === 'string' ? body.orderId : '';
  const partialAmount = body?.amount != null ? Number(body.amount) : null;
  if (!orderId) return json({ error: 'orderId é obrigatório.' }, 400);

  const admin = createAdminClient();

  const { data: order, error: orderErr } = await admin.from('orders').select('id, total, payment_status, pagbank_charge_id').eq('id', orderId).maybeSingle();
  if (orderErr || !order) return json({ error: 'Pedido não encontrado.' }, 404);
  if (!order.pagbank_charge_id) return json({ error: 'Este pedido não tem cobrança PagBank associada.' }, 400);
  if (order.payment_status === 'pagamento_estornado' || order.payment_status === 'pagamento_cancelado') {
    return json({ ok: true, alreadyCancelled: true });
  }

  const { data: pagbankOrderRow } = await admin.from('pagbank_orders').select('id').eq('pagbank_charge_id', order.pagbank_charge_id).maybeSingle();

  const config = loadPagBankConfig();
  if (!config.token) return json({ error: 'PagBank não configurado no servidor.' }, 500);

  const amountValue = partialAmount != null && partialAmount > 0
    ? Math.round(partialAmount * 100)
    : Math.round(Number(order.total) * 100);

  let httpStatus = 0;
  let responseBody: any = null;
  try {
    const resp = await pagbankFetch(config, `/charges/${order.pagbank_charge_id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ amount: { value: amountValue } }),
    });
    httpStatus = resp.status;
    responseBody = await resp.json().catch(() => null);
  } catch (e) {
    return json({ error: `Erro de comunicação com o PagBank: ${String(e)}` }, 502);
  }

  const source = 'cancel' as const;

  if (httpStatus < 200 || httpStatus >= 300) {
    await admin.from('payment_events').insert({
      pagbank_order_ref: pagbankOrderRow?.id ?? null, order_id: orderId, event_type: 'refund_error', status: 'error', source,
      detail: { httpStatus, response: sanitizeForLog(responseBody) },
    });
    return json({ error: 'Não foi possível estornar este pagamento. Verifique o prazo do método (Pix até 90 dias, cartão até 350 dias) ou tente novamente.' }, 502);
  }

  const isPartial = partialAmount != null && partialAmount > 0 && partialAmount < Number(order.total);
  const newStatus = isPartial ? order.payment_status : 'pagamento_estornado';

  if (!isPartial) {
    await admin.from('orders').update({ payment_status: newStatus }).eq('id', orderId);
  }
  if (pagbankOrderRow) {
    await admin.from('pagbank_orders').update({ status: 'cancelled', provider_response: sanitizeForLog(responseBody) }).eq('id', pagbankOrderRow.id);
  }

  await admin.from('payment_events').insert({
    pagbank_order_ref: pagbankOrderRow?.id ?? null, order_id: orderId, event_type: isPartial ? 'partial_refund' : 'full_refund', status: 'cancelled', source,
    detail: { httpStatus, amountValue, actorId: user.id },
  });

  return json({ ok: true, partial: isPartial, amount: amountValue / 100 });
});
