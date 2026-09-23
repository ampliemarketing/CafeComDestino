// Finalização de uma cobrança PagBank paga — chamada tanto pela resposta
// síncrona do cartão (pagbank-create-card) quanto pelo webhook
// (pagbank-webhook), por isso vive num módulo só: as duas entradas têm que
// levar exatamente ao mesmo resultado (o pedido só vira `orders`/baixa
// estoque uma vez, não importa qual das duas confirmou primeiro).
//
// A finalização em si roda inteira dentro da RPC `finalize_pagbank_paid_charge`
// (migration 0054) — UMA função plpgsql, com `select ... for update` travando
// a linha de `pagbank_orders` durante toda a transação. Isso fecha a race
// condition que existia aqui antes (auditoria de segurança, achado Alto #2):
// resposta síncrona do cartão e webhook chegando quase juntos podiam os dois
// passar pela checagem de "já finalizado?" como não, e o segundo sobrescrevia
// um pedido recém-criado com status='error' por bater em violação de chave
// primária. Com o lock dentro da função SQL, a segunda chamada fica esperando
// a primeira commitar e já vê created_order_id preenchido.
//
// NÃO toca `create_order_and_credit_cash` diretamente — quem chama é a RPC
// SQL, intocada, com o rascunho de pedido guardado em `pagbank_orders.order_draft`.

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
  const { data, error } = await admin.rpc('finalize_pagbank_paid_charge', {
    p_reference_id: referenceId,
    p_source: source,
    p_provider_response: sanitizeForLog(providerResponse),
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const result = data as { ok: boolean; error?: string; alreadyFinalized?: boolean; orderId?: string; orderNumber?: number };
  if (!result?.ok) {
    return { ok: false, error: result?.error ?? 'Falha desconhecida ao finalizar o pedido.' };
  }

  return {
    ok: true,
    alreadyFinalized: result.alreadyFinalized,
    orderId: result.orderId,
    orderNumber: result.orderNumber,
  };
}
