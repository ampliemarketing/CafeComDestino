// Finalização de uma cobrança PagBank paga — chamada tanto pela resposta
// síncrona do cartão (pagbank-create-card) quanto pelo webhook
// (pagbank-webhook), por isso vive num módulo só: as duas entradas têm que
// levar exatamente ao mesmo resultado (o pedido só vira `orders`/baixa
// estoque uma vez, não importa qual das duas confirmou primeiro).
//
// NÃO toca `create_order_and_credit_cash` nem `close_comanda_and_pay` — só
// chama a RPC já existente, intocada, com o rascunho de pedido guardado em
// `pagbank_orders.order_draft`.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { sanitizeForLog } from '../../../../src/lib/pagbank.ts';

export interface FinalizeResult {
  ok: boolean;
  alreadyFinalized?: boolean;
  orderId?: string;
  orderNumber?: number;
  error?: string;
}

export async function finalizePaidCharge(
  admin: SupabaseClient,
  referenceId: string,
  source: 'webhook' | 'create',
  providerResponse: unknown,
): Promise<FinalizeResult> {
  const { data: row } = await admin.from('pagbank_orders').select('*').eq('id', referenceId).maybeSingle();
  if (!row) return { ok: false, error: 'pagbank_orders não encontrado.' };

  // Idempotência: se já finalizou (pela outra via), não repete — evita baixar
  // estoque/criar pedido duas vezes quando webhook e resposta síncrona do
  // cartão chegam quase juntos.
  if (row.created_order_id) {
    return { ok: true, alreadyFinalized: true, orderId: row.created_order_id };
  }

  const draft = row.order_draft as Record<string, any>;
  const items = Array.isArray(draft.items) ? draft.items : [];

  const { error: rpcError } = await admin.rpc('create_order_and_credit_cash', {
    p_order: { ...draft, paymentStatus: 'pagamento_aprovado' },
    p_cash_amount: null,
    p_payment_method: draft.paymentMethod,
    p_stock_items: items.map((i: any) => ({ productId: i.productId, quantity: i.quantity })),
  });

  if (rpcError) {
    await admin.from('pagbank_orders').update({
      status: 'error',
      error_message: `Falha ao finalizar pedido: ${rpcError.message}`,
    }).eq('id', referenceId);
    await admin.from('payment_events').insert({
      pagbank_order_ref: referenceId, event_type: 'finalize_error', status: 'error', source,
      detail: { error: rpcError.message },
    });
    return { ok: false, error: rpcError.message };
  }

  const { data: orderRow } = await admin.from('orders').select('order_number').eq('id', draft.id).maybeSingle();

  await admin.from('orders').update({ pagbank_charge_id: row.pagbank_charge_id }).eq('id', draft.id);

  await admin.from('pagbank_orders').update({
    status: 'paid',
    created_order_id: draft.id,
    provider_response: sanitizeForLog(providerResponse),
  }).eq('id', referenceId);

  await admin.from('payment_events').insert({
    pagbank_order_ref: referenceId, order_id: draft.id, event_type: 'order_finalized', status: 'paid', source,
    detail: { orderNumber: orderRow?.order_number ?? null },
  });

  return { ok: true, orderId: draft.id, orderNumber: orderRow?.order_number ?? undefined };
}
