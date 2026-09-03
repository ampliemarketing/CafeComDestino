// Geração e disparo de impressão do cupom térmico (80 mm). A folha vai pro
// driver de impressora do Windows já instalado (ex.: GoldenSky GS-*), então não
// há ESC/POS aqui — é uma página HTML comum, só formatada estreita, impressa
// dentro de um iframe isolado pra não levar a tela do sistema junto.

import type { CompanyProfileData, Order } from '../types';

export interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
  notes?: string;
  additions?: Array<{ name: string; price: number }>;
}

export interface ReceiptData {
  orderNumber?: number;
  tableNumber?: number;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  waiterName?: string;
  items: ReceiptItem[];
  subtotal: number;
  discount?: number;
  deliveryFee?: number;
  serviceFee?: number;
  servicePct?: number;
  couvert?: number;
  /** Valor já quitado em adiantamento(s) — abatido do total, mostrado como dedução. */
  advancePaid?: number;
  total: number;
  paymentMethod?: string;
  splitPayments?: Array<{ method: string; amount: number }>;
  remainingBalance?: number;
  nfceKey?: string;
  type: 'caixa' | 'cozinha' | 'pre_conta' | 'adiantamento_parcial' | 'delivery';
}

export const RECEIPT_TYPE_LABEL: Record<ReceiptData['type'], string> = {
  cozinha: '*** PEDIDO COZINHA ***',
  caixa: '*** COMPROVANTE DE VENDA ***',
  pre_conta: '*** PRÉ-CONTA / CONFERÊNCIA ***',
  adiantamento_parcial: '*** COMPROVANTE DE ADIANTAMENTO ***',
  delivery: '*** PEDIDO DELIVERY ***',
};

const PAYMENT_LABEL: Record<string, string> = {
  pix: 'PIX',
  dinheiro: 'DINHEIRO',
  cartao_credito: 'CARTÃO CRÉDITO',
  cartao_debito: 'CARTÃO DÉBITO',
  boleto: 'BOLETO',
  vale_refeicao: 'VALE-REFEIÇÃO',
  multiplo: 'MÚLTIPLO',
};

export const paymentLabel = (m?: string) => (m ? PAYMENT_LABEL[m] || m.toUpperCase() : '');

const brl = (v: number) => `R$ ${v.toFixed(2)}`;

const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/** Converte um pedido do sistema no formato de cupom. */
export function orderToReceiptData(o: Order, type: ReceiptData['type']): ReceiptData {
  const addr = o.customer?.address;
  const deliveryAddress = addr
    ? [
        `${addr.street || ''}${addr.number ? ', ' + addr.number : ''}`,
        addr.complement ? addr.complement : '',
        addr.neighborhood ? addr.neighborhood : '',
        addr.reference ? `Ref.: ${addr.reference}` : '',
      ]
        .filter(Boolean)
        .join(' - ')
    : undefined;

  return {
    orderNumber: o.orderNumber,
    tableNumber: o.tableNumber,
    customerName: o.customer?.name,
    customerPhone: o.customer?.phone,
    deliveryAddress,
    waiterName: o.waiterName,
    items: (o.items || []).map((i) => ({
      name: i.productName,
      quantity: i.quantity,
      price: i.unitPrice,
      notes: i.notes,
      additions: i.additions,
    })),
    subtotal: o.subtotal,
    discount: o.discount || undefined,
    deliveryFee: o.deliveryFee || undefined,
    serviceFee: o.serviceFee || undefined,
    couvert: o.couvert || undefined,
    advancePaid: o.advancePaid || undefined,
    total: o.total,
    paymentMethod: o.paymentMethod,
    splitPayments: o.splitPayments,
    nfceKey: o.nfceKey,
    type,
  };
}

/** Monta o HTML do cupom para bobina de 80 mm (área útil ~72 mm). */
export function buildReceiptHtml(d: ReceiptData, company: CompanyProfileData): string {
  const rows: string[] = [];

  rows.push(`
    <div class="center b">
      <div class="lg upper">${esc(company.tradeName || company.name)}</div>
      <div class="sm">CNPJ: ${esc(company.cnpj || '—')}</div>
      <div class="sm">${esc(company.address?.street || '')}${company.address?.number ? ', ' + esc(company.address.number) : ''}</div>
      <div class="sm">Tel: ${esc(company.phone || '—')}</div>
    </div>
    <div class="sep"></div>
    <div class="center b upper box">${esc(RECEIPT_TYPE_LABEL[d.type])}</div>
  `);

  const meta: string[] = [];
  if (d.orderNumber) meta.push(`PEDIDO #: <b>${esc(d.orderNumber)}</b>`);
  if (d.tableNumber) meta.push(`MESA #: <b>${esc(d.tableNumber)}</b>`);
  if (d.customerName) meta.push(`CLIENTE: ${esc(d.customerName)}`);
  if (d.customerPhone) meta.push(`TEL: ${esc(d.customerPhone)}`);
  if (d.deliveryAddress) meta.push(`ENDERECO: ${esc(d.deliveryAddress)}`);
  if (d.waiterName) meta.push(`ATENDENTE: ${esc(d.waiterName)}`);
  meta.push(`DATA: ${new Date().toLocaleString('pt-BR')}`);
  rows.push(`<div class="meta">${meta.map((m) => `<div>${m}</div>`).join('')}</div><div class="sep"></div>`);

  const items = d.items
    .map((it) => {
      const line = `<div class="row"><span>${esc(it.quantity)}x ${esc(it.name)}</span><span>${brl(it.price * it.quantity)}</span></div>`;
      const adds = (it.additions || [])
        .map((a) => `<div class="sub">+ ${esc(a.name)} (${brl(a.price)})</div>`)
        .join('');
      const notes = it.notes ? `<div class="sub">Obs: ${esc(it.notes)}</div>` : '';
      return line + adds + notes;
    })
    .join('');
  rows.push(`
    <div class="row b sm"><span>QTD ITEM</span><span>TOTAL</span></div>
    ${items}
    <div class="sep"></div>
  `);

  const totals: string[] = [`<div class="row"><span>SUBTOTAL:</span><span>${brl(d.subtotal)}</span></div>`];
  if (d.deliveryFee) totals.push(`<div class="row"><span>TAXA ENTREGA:</span><span>${brl(d.deliveryFee)}</span></div>`);
  if (d.serviceFee)
    totals.push(
      `<div class="row"><span>TAXA DE SERVIÇO${d.servicePct ? ` (${esc(d.servicePct)}%)` : ''}:</span><span>${brl(d.serviceFee)}</span></div>`,
    );
  if (d.couvert) totals.push(`<div class="row"><span>COUVERT:</span><span>${brl(d.couvert)}</span></div>`);
  if (d.discount) totals.push(`<div class="row b"><span>DESCONTO:</span><span>- ${brl(d.discount)}</span></div>`);
  if (d.advancePaid) totals.push(`<div class="row b"><span>ADIANTAMENTO PAGO:</span><span>- ${brl(d.advancePaid)}</span></div>`);
  totals.push(
    `<div class="row b lg total"><span>${d.advancePaid ? 'RESTANTE A PAGAR:' : 'TOTAL:'}</span><span>${brl(d.total)}</span></div>`,
  );
  rows.push(`<div class="totals">${totals.join('')}</div><div class="sep"></div>`);

  if (d.splitPayments && d.splitPayments.length > 0) {
    rows.push(`
      <div class="center b sm upper">Pagamento Misto</div>
      ${d.splitPayments.map((sp) => `<div class="row sm upper"><span>${esc(paymentLabel(sp.method))}:</span><span>${brl(sp.amount)}</span></div>`).join('')}
      <div class="sep"></div>
    `);
  } else if (d.paymentMethod) {
    rows.push(`<div class="center b sm upper">PAGAMENTO: ${esc(paymentLabel(d.paymentMethod))}</div><div class="sep"></div>`);
  }

  if (d.nfceKey) {
    rows.push(`
      <div class="center sm">
        <div class="b">NFC-e EMITIDA COM SUCESSO</div>
        <div class="break">Chave: ${esc(d.nfceKey)}</div>
      </div>
      <div class="sep"></div>
    `);
  }

  rows.push(`<div class="center sm upper mut">${esc(company.name)} - Sistema de Gestao</div>`);

  return `<!doctype html><html><head><meta charset="utf-8"><title>Cupom</title><style>
    @page { size: 72mm auto; margin: 3mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body { width: 66mm; font-family: "Consolas", "Courier New", monospace; font-size: 11px; line-height: 1.35; color: #000; }
    .center { text-align: center; }
    .b { font-weight: 700; }
    .upper { text-transform: uppercase; }
    .sm { font-size: 10px; }
    .lg { font-size: 13px; }
    .mut { color: #333; }
    .break { word-break: break-all; }
    .sep { border-top: 1px dashed #000; margin: 4px 0; }
    .box { border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 3px 0; margin: 4px 0; }
    .row { display: flex; justify-content: space-between; gap: 8px; }
    .row > span:last-child { white-space: nowrap; }
    .sub { font-size: 10px; padding-left: 10px; }
    .meta > div { margin: 1px 0; }
    .totals .total { border-top: 1px solid #000; padding-top: 2px; margin-top: 2px; }
  </style></head><body>${rows.join('')}</body></html>`;
}

/**
 * Renderiza o HTML num iframe fora de tela e dispara a impressão. Com o
 * navegador em modo kiosk (`--kiosk-printing`) sai direto na impressora padrão;
 * sem ele, abre a caixa de diálogo de impressão.
 *
 * O iframe usa `srcdoc` definido ANTES de entrar no DOM: assim o único evento
 * `load` que chega já é o do documento com conteúdo (sem o `about:blank`
 * intermediário disparar a impressão de uma página em branco). O iframe tem
 * tamanho real, só posicionado fora da tela — iframe 0x0 pode sair em branco na
 * impressão silenciosa do Chrome.
 */
export function printReceiptHtml(html: string, onError?: (msg: string) => void): void {
  try {
    // Remove qualquer iframe de impressão anterior que tenha ficado preso —
    // evita que um cupom antigo (ex.: o de teste) saia no lugar do atual.
    document.querySelectorAll('iframe[data-print-receipt]').forEach((el) => el.remove());

    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-print-receipt', '');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText =
      'position:fixed;left:-10000px;top:0;width:80mm;height:1400px;border:0;opacity:0;';

    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      setTimeout(() => iframe.remove(), 500);
    };

    iframe.onload = () => {
      const win = iframe.contentWindow;
      if (!win) {
        iframe.remove();
        onError?.('Não foi possível abrir a impressão do navegador.');
        return;
      }
      win.onafterprint = cleanup;
      // Pequeno atraso: alguns Chrome precisam de um tick após o load pra
      // imprimir o conteúdo já pintado.
      setTimeout(() => {
        try {
          win.focus();
          win.print();
        } catch {
          onError?.('O navegador bloqueou a impressão do cupom.');
        }
        // Rede de segurança caso o navegador não dispare `onafterprint`.
        setTimeout(cleanup, 15_000);
      }, 60);
    };

    iframe.srcdoc = html;
    document.body.appendChild(iframe);
  } catch {
    onError?.('Não foi possível gerar o cupom.');
  }
}
