// Wrapper fino das chamadas PagBank a partir do Cardápio Online público —
// mesmo espírito de `issueNfce()` em AppContext.tsx, mas como função
// standalone: o checkout de /pedir roda fora da árvore autenticada
// (PublicOnlineMenu.tsx não usa useApp()), então não há toasts/audit log de
// funcionário aqui, só o retorno pro componente decidir o que mostrar.

import { supabase } from './supabaseClient';
import type { OrderItem } from '../types';

export interface PagBankOrderDraft {
  customer: {
    name: string;
    phone: string;
    email?: string;
    taxId?: string;
    wantsWhatsappUpdates: boolean;
    trackingToken: string;
    address?: {
      street: string;
      number: string;
      neighborhood: string;
      complement?: string;
      reference?: string;
    };
  };
  items: OrderItem[];
  serviceType: 'entrega' | 'retirada' | 'consumo_local';
  deliveryFee: number;
  notes: string;
}

export interface CreatePixResult {
  ok: boolean;
  notConfigured?: boolean;
  processing?: boolean;
  message?: string;
  status?: string;
  qrCodeText?: string | null;
  qrCodeImageUrl?: string | null;
  expirationDate?: string | null;
  referenceId?: string;
}

export async function createPagBankPixCharge(referenceId: string, orderDraft: PagBankOrderDraft): Promise<CreatePixResult> {
  const { data, error } = await supabase.functions.invoke('pagbank-create-pix', { body: { referenceId, orderDraft } });
  if (error) return { ok: false, message: error.message || 'Erro ao gerar o Pix.' };
  return data as CreatePixResult;
}

export interface CreateCardResult {
  ok: boolean;
  notConfigured?: boolean;
  declined?: boolean;
  processing?: boolean;
  status?: string;
  message?: string;
  orderId?: string;
  orderNumber?: number;
  referenceId?: string;
}

export async function createPagBankCardCharge(params: {
  referenceId: string;
  orderDraft: PagBankOrderDraft;
  encryptedCard: string;
  holderName: string;
  holderTaxId: string;
  installments?: number;
  cardType?: 'CREDIT_CARD' | 'DEBIT_CARD';
}): Promise<CreateCardResult> {
  const { referenceId, orderDraft, encryptedCard, holderName, holderTaxId, installments, cardType } = params;
  const { data, error } = await supabase.functions.invoke('pagbank-create-card', {
    body: { referenceId, orderDraft, encryptedCard, holderName, holderTaxId, installments, cardType },
  });
  if (error) return { ok: false, message: error.message || 'Erro ao processar o cartão.' };
  return data as CreateCardResult;
}

export interface PagBankStatus {
  status: 'waiting' | 'paid' | 'declined' | 'cancelled' | 'expired' | 'error' | null;
  expirationDate: string | null;
  orderNumber: number | null;
  trackingToken: string | null;
}

export async function getPagBankPaymentStatus(referenceId: string): Promise<PagBankStatus | null> {
  const { data, error } = await supabase.rpc('get_pagbank_payment_status', { p_reference_id: referenceId });
  if (error || !data) return null;
  return data as PagBankStatus;
}

/**
 * Faz polling de `get_pagbank_payment_status` até o Pix ser pago, expirar, ou
 * o número máximo de tentativas ser atingido. Devolve o último status lido.
 * `signal` cancela o polling (ex.: componente desmontou / usuário voltou).
 */
export async function pollPagBankPixStatus(
  referenceId: string,
  opts: { intervalMs?: number; maxAttempts?: number; signal?: AbortSignal } = {},
): Promise<PagBankStatus | null> {
  const intervalMs = opts.intervalMs ?? 3000;
  const maxAttempts = opts.maxAttempts ?? 200; // ~10 min com intervalo de 3s

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (opts.signal?.aborted) return null;
    const status = await getPagBankPaymentStatus(referenceId);
    if (status && (status.status === 'paid' || status.status === 'declined' || status.status === 'cancelled' || status.status === 'expired')) {
      return status;
    }
    if (status?.expirationDate && new Date(status.expirationDate).getTime() < Date.now()) {
      return { ...status, status: 'expired' };
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return null;
}
