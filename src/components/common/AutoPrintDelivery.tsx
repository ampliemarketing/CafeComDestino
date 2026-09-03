import React, { useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import type { Order } from '../../types';
import { buildReceiptHtml, orderToReceiptData, printReceiptHtml } from '../../lib/printReceipt';
import {
  isAutoPrintDeliveryEnabled,
  loadPrintedOrderIds,
  markOrderPrinted,
  claimOrderPrint,
} from '../../lib/autoPrint';

// Só imprime pedidos criados a partir de ~10 min antes desta aba abrir — evita
// cuspir o histórico inteiro num refresh/reconexão, mas dá folga pra relógio
// dessincronizado e pra pedido que entrou enquanto a tela carregava.
const GRACE_MS = 10 * 60_000;

const log = (...args: unknown[]) => console.info('[auto-print delivery]', ...args);

/** Pedido novo vindo de canal externo (cardápio online, WhatsApp, telefone). */
const isAutoPrintable = (o: Order): boolean =>
  o.orderStatus === 'novo' &&
  (o.channel === 'online' || o.channel === 'whatsapp' || o.channel === 'telefone');

/**
 * Componente invisível: observa a coleção de pedidos (realtime) e, quando a
 * impressão automática está ligada neste computador, imprime o cupom de cada
 * novo pedido de delivery/online uma única vez.
 */
export const AutoPrintDelivery: React.FC = () => {
  const { orders, companyProfile, addToast } = useApp();

  const cutoffRef = useRef<number>(Date.now() - GRACE_MS);
  const seenRef = useRef<Set<string>>(new Set());
  const companyRef = useRef(companyProfile);
  companyRef.current = companyProfile;
  const toastRef = useRef(addToast);
  toastRef.current = addToast;

  useEffect(() => {
    if (!isAutoPrintDeliveryEnabled()) return;
    const printed = loadPrintedOrderIds();
    const now = Date.now();

    for (const o of orders) {
      if (seenRef.current.has(o.id)) continue;
      seenRef.current.add(o.id);

      if (!isAutoPrintable(o)) continue;
      if (printed.has(o.id)) {
        log('já impresso, pulando', o.orderNumber);
        continue;
      }

      // Sem timestamp confiável -> imprime mesmo assim (é melhor do que perder).
      const ts = o.createdAtISO ? Date.parse(o.createdAtISO) : now;
      if (Number.isFinite(ts) && ts < cutoffRef.current) {
        log('pedido antigo, pulando', o.orderNumber, o.createdAtISO);
        continue;
      }

      if (!claimOrderPrint(o.id)) {
        log('outra aba assumiu a impressão', o.orderNumber);
        markOrderPrinted(o.id);
        continue;
      }

      log('imprimindo pedido', o.orderNumber);
      printReceiptHtml(
        buildReceiptHtml(orderToReceiptData(o, 'delivery'), companyRef.current),
        (msg) => toastRef.current('error', 'Falha na impressão automática', msg),
      );
      markOrderPrinted(o.id);
      toastRef.current('success', 'Cupom impresso', `Pedido #${o.orderNumber} enviado para a impressora.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  return null;
};
