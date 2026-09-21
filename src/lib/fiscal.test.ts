import { describe, it, expect } from 'vitest';
import {
  emptyFiscalData,
  normalizeFiscalData,
  fiscalFieldErrors,
  fiscalMissingFields,
  isFiscalComplete,
  resolveProductFiscal,
  prorateDiscount,
  sefazPaymentEntries,
  scalePaymentsToNoteTotal,
  PAYMENT_METHOD_SEFAZ,
  buildFiscalNoteRows,
  filterFiscalNoteRows,
  retryQueueRows,
} from './fiscal';
import type { FiscalData, FiscalInvoice, Order, TaxGroup } from '../types';

const validFiscal = (): FiscalData => ({
  ...emptyFiscalData(),
  origem: '0',
  ncm: '2202.10.00',
  cfop: '5102',
  cstCsosn: '102',
  cstPis: '49',
  aliqPis: 0,
  cstCofins: '49',
  aliqCofins: 0,
});

describe('fiscalFieldErrors', () => {
  it('não acusa erro quando os obrigatórios estão preenchidos', () => {
    expect(fiscalFieldErrors(validFiscal())).toEqual({
      origem: false, ncm: false, cfop: false, cest: false,
      cstCsosn: false, cstPis: false, aliqPis: false, cstCofins: false, aliqCofins: false,
    });
  });

  it('acusa NCM com menos de 8 dígitos', () => {
    expect(fiscalFieldErrors({ ...validFiscal(), ncm: '2202.10' }).ncm).toBe(true);
  });

  it('acusa CFOP diferente de 4 dígitos', () => {
    expect(fiscalFieldErrors({ ...validFiscal(), cfop: '510' }).cfop).toBe(true);
  });

  it('exige CEST de 7 dígitos apenas quando o produto tem ST', () => {
    expect(fiscalFieldErrors({ ...validFiscal(), temSt: false, cest: '' }).cest).toBe(false);
    expect(fiscalFieldErrors({ ...validFiscal(), temSt: true, cest: '' }).cest).toBe(true);
    expect(fiscalFieldErrors({ ...validFiscal(), temSt: true, cest: '0300200' }).cest).toBe(false);
  });

  it('acusa CST/CSOSN, CST de PIS e de COFINS vazios', () => {
    const e = fiscalFieldErrors({ ...validFiscal(), cstCsosn: '', cstPis: '', cstCofins: '' });
    expect(e.cstCsosn).toBe(true);
    expect(e.cstPis).toBe(true);
    expect(e.cstCofins).toBe(true);
  });

  it('acusa alíquota de PIS/COFINS não numérica', () => {
    const e = fiscalFieldErrors({ ...validFiscal(), aliqPis: NaN, aliqCofins: undefined as unknown as number });
    expect(e.aliqPis).toBe(true);
    expect(e.aliqCofins).toBe(true);
  });
});

describe('fiscalMissingFields / isFiscalComplete', () => {
  it('lista vazia e completo quando tudo preenchido', () => {
    expect(fiscalMissingFields(validFiscal())).toEqual([]);
    expect(isFiscalComplete(validFiscal())).toBe(true);
  });

  it('lista os rótulos dos campos faltantes', () => {
    const missing = fiscalMissingFields({ ...emptyFiscalData(), ncm: '', cfop: '' });
    expect(missing).toContain('NCM');
    expect(missing).toContain('CFOP');
    expect(isFiscalComplete({ ...emptyFiscalData(), ncm: '', cfop: '' })).toBe(false);
  });
});

describe('normalizeFiscalData', () => {
  it('preenche os campos ausentes de uma linha antiga', () => {
    const old = { ncm: '2106.90.90', cfop: '5102', cstCsosn: '102' };
    const norm = normalizeFiscalData(old as Partial<FiscalData>);
    expect(norm.origem).toBe('0');
    expect(norm.cstPis).toBe('49');
    expect(norm.aliqCofins).toBe(0);
    expect(norm.ncm).toBe('2106.90.90');
  });
});

describe('resolveProductFiscal', () => {
  const group: TaxGroup = {
    id: 'g1', name: 'Bebida monofásica', active: true,
    fiscal: { ...validFiscal(), ncm: '2202.99.00', cstPis: '04', cstCofins: '04' },
  };

  it('usa o grupo quando o produto está vinculado', () => {
    const r = resolveProductFiscal({ taxGroupId: 'g1', fiscal: validFiscal() }, [group]);
    expect(r.ncm).toBe('2202.99.00');
    expect(r.cstPis).toBe('04');
  });

  it('usa o fiscal do produto quando não há grupo', () => {
    const r = resolveProductFiscal({ taxGroupId: undefined, fiscal: validFiscal() }, [group]);
    expect(r.ncm).toBe('2202.10.00');
  });

  it('cai no fiscal do produto se o grupo vinculado não existe mais', () => {
    const r = resolveProductFiscal({ taxGroupId: 'sumiu', fiscal: validFiscal() }, [group]);
    expect(r.ncm).toBe('2202.10.00');
  });
});

describe('prorateDiscount', () => {
  it('rateia proporcional ao valor bruto do item', () => {
    const items = [
      { unitPrice: 10, quantity: 1 }, // 10  -> 1/4
      { unitPrice: 10, quantity: 3 }, // 30  -> 3/4
    ];
    expect(prorateDiscount(items, 4)).toEqual([1, 3]);
  });

  it('joga a sobra de arredondamento no último item e fecha o total', () => {
    const items = [
      { unitPrice: 3.33, quantity: 1 },
      { unitPrice: 3.33, quantity: 1 },
      { unitPrice: 3.34, quantity: 1 },
    ];
    const out = prorateDiscount(items, 1);
    expect(Number(out.reduce((s, v) => s + v, 0).toFixed(2))).toBe(1);
  });

  it('retorna zeros quando não há desconto ou não há itens', () => {
    expect(prorateDiscount([{ unitPrice: 10, quantity: 1 }], 0)).toEqual([0]);
    expect(prorateDiscount([], 5)).toEqual([]);
  });
});

describe('sefazPaymentEntries / PAYMENT_METHOD_SEFAZ', () => {
  it('mapeia as formas internas para os códigos tPag da Sefaz', () => {
    expect(PAYMENT_METHOD_SEFAZ.dinheiro).toBe('01');
    expect(PAYMENT_METHOD_SEFAZ.cartao_credito).toBe('03');
    expect(PAYMENT_METHOD_SEFAZ.cartao_debito).toBe('04');
    expect(PAYMENT_METHOD_SEFAZ.pix).toBe('17');
  });

  it('uma linha única com o total quando não há splitPayments', () => {
    const order = { paymentMethod: 'cartao_debito', total: 48, splitPayments: undefined } as unknown as Order;
    expect(sefazPaymentEntries(order)).toEqual([{ forma: '04', rotulo: 'Cartão de débito', valor: 48 }]);
  });

  it('uma linha por forma quando o pagamento é dividido', () => {
    const order = {
      paymentMethod: 'multiplo',
      total: 50,
      splitPayments: [
        { method: 'pix', amount: 20 },
        { method: 'dinheiro', amount: 30 },
      ],
    } as unknown as Order;
    expect(sefazPaymentEntries(order)).toEqual([
      { forma: '17', rotulo: 'PIX', valor: 20 },
      { forma: '01', rotulo: 'Dinheiro', valor: 30 },
    ]);
  });
});

// ===========================================================================
// Regressão real (2026-09-21): pedido com taxa de serviço fez o pagamento
// (order.total) ficar maior que a nota (só produtos) — Brasil NFe rejeitou com
// "Rejeição 866: Ausência de troco quando o valor dos pagamentos informados
// for maior que o total da nota. [vPago:43.80 - vNF:36.90]".
// ===========================================================================
describe('scalePaymentsToNoteTotal', () => {
  it('reescala uma linha única pro valor da nota quando o pedido tinha taxa de serviço/couvert', () => {
    const entries = sefazPaymentEntries({ paymentMethod: 'pix', total: 43.8, splitPayments: undefined } as any);
    expect(scalePaymentsToNoteTotal(entries, 36.9)).toEqual([{ forma: '17', rotulo: 'PIX', valor: 36.9 }]);
  });

  it('mantém a proporção entre formas divididas e fecha exatamente no total da nota', () => {
    const entries = [
      { forma: '17', rotulo: 'PIX', valor: 30 },
      { forma: '01', rotulo: 'Dinheiro', valor: 20 },
    ];
    const out = scalePaymentsToNoteTotal(entries, 40); // pedido de 50 com 10 de taxa/couvert
    expect(Number(out.reduce((s, e) => s + e.valor, 0).toFixed(2))).toBe(40);
    expect(out[0].valor).toBeCloseTo(24, 2); // 30/50 * 40
    expect(out[1].valor).toBeCloseTo(16, 2); // 20/50 * 40
  });

  it('não mexe quando a soma já bate com o total da nota', () => {
    const entries = [{ forma: '01', rotulo: 'Dinheiro', valor: 36.9 }];
    expect(scalePaymentsToNoteTotal(entries, 36.9)).toEqual(entries);
  });

  it('não quebra com lista vazia', () => {
    expect(scalePaymentsToNoteTotal([], 10)).toEqual([]);
  });
});

// ===========================================================================
// Lista de notas (Módulo Fiscal ▸ Notas Fiscais): pedidos sem nenhuma
// tentativa de emissão devem aparecer na mesma lista com status "sem_emissao"
// em vez de sumir da tela ou virar uma lista separada.
// ===========================================================================
describe('buildFiscalNoteRows', () => {
  const order = (over: Partial<Order>): Order => ({
    id: 'o1', orderNumber: 1, total: 50, paymentMethod: 'pix', channel: 'pdv',
    fiscalIssued: false, createdAt: '10:00', createdAtISO: '2026-09-20T10:00:00.000Z',
    customer: { name: 'Cliente 1' },
    ...over,
  } as unknown as Order);

  const invoice = (over: Partial<FiscalInvoice>): FiscalInvoice => ({
    id: 'inv1', orderId: 'o1', modelo: 65, ambiente: 2, status: 'autorizada',
    createdAt: '2026-09-20T10:05:00.000Z',
    ...over,
  } as FiscalInvoice);

  it('pedido sem nenhuma linha em fiscal_invoices vira status "sem_emissao"', () => {
    const rows = buildFiscalNoteRows([order({ id: 'o1' })], []);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('sem_emissao');
    expect(rows[0].invoice).toBeNull();
    expect(rows[0].orderId).toBe('o1');
  });

  it('pedido com invoice usa o status da própria invoice, não duplica como pendente', () => {
    const rows = buildFiscalNoteRows(
      [order({ id: 'o1' })],
      [invoice({ orderId: 'o1', status: 'rejeitada' })],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('rejeitada');
    expect(rows[0].invoice?.id).toBe('inv1');
  });

  it('pedido com fiscalIssued=true e sem invoice não aparece como pendente (não deveria acontecer, mas não deve virar "emitir" à toa)', () => {
    const rows = buildFiscalNoteRows([order({ id: 'o1', fiscalIssued: true })], []);
    expect(rows).toHaveLength(0);
  });

  it('ordena do mais recente para o mais antigo, misturando invoices e pendentes', () => {
    const rows = buildFiscalNoteRows(
      [
        order({ id: 'o-pending-antigo', createdAtISO: '2026-09-18T00:00:00.000Z' }),
        order({ id: 'o-pending-novo', createdAtISO: '2026-09-21T00:00:00.000Z' }),
      ],
      [invoice({ id: 'inv-meio', orderId: 'o-com-invoice', createdAt: '2026-09-19T00:00:00.000Z' })],
    );
    expect(rows.map((r) => r.orderId)).toEqual(['o-pending-novo', 'o-com-invoice', 'o-pending-antigo']);
  });
});

describe('filterFiscalNoteRows', () => {
  const baseOrder: Order = {
    id: 'o1', orderNumber: 42, total: 50, paymentMethod: 'pix', channel: 'pdv',
    fiscalIssued: false, createdAt: '10:00', createdAtISO: '2026-09-20T10:00:00.000Z',
    customer: { name: 'Maria Silva' },
  } as unknown as Order;

  const rows = buildFiscalNoteRows(
    [
      baseOrder,
      { ...baseOrder, id: 'o2', orderNumber: 43, paymentMethod: 'dinheiro', channel: 'garcom', customer: { name: 'João' } } as unknown as Order,
    ],
    [
      {
        id: 'inv1', orderId: 'o2', modelo: 65, ambiente: 2, status: 'autorizada',
        chave: '5226...9999', createdAt: '2026-09-20T11:00:00.000Z',
      } as FiscalInvoice,
    ],
  );

  it('filtra por status, incluindo o pseudo-status "sem_emissao"', () => {
    const semEmissao = filterFiscalNoteRows(rows, { status: 'sem_emissao', payment: 'todas', channel: 'todos', query: '' });
    expect(semEmissao).toHaveLength(1);
    expect(semEmissao[0].orderId).toBe('o1');

    const autorizadas = filterFiscalNoteRows(rows, { status: 'autorizada', payment: 'todas', channel: 'todos', query: '' });
    expect(autorizadas).toHaveLength(1);
    expect(autorizadas[0].orderId).toBe('o2');
  });

  it('filtra por forma de pagamento e por canal', () => {
    expect(filterFiscalNoteRows(rows, { status: 'todas', payment: 'dinheiro', channel: 'todos', query: '' })).toHaveLength(1);
    expect(filterFiscalNoteRows(rows, { status: 'todas', payment: 'todas', channel: 'garcom', query: '' })).toHaveLength(1);
  });

  it('busca por nome do cliente, número do pedido ou chave', () => {
    expect(filterFiscalNoteRows(rows, { status: 'todas', payment: 'todas', channel: 'todos', query: 'maria' })).toHaveLength(1);
    expect(filterFiscalNoteRows(rows, { status: 'todas', payment: 'todas', channel: 'todos', query: '43' })).toHaveLength(1);
    expect(filterFiscalNoteRows(rows, { status: 'todas', payment: 'todas', channel: 'todos', query: '9999' })).toHaveLength(1);
    expect(filterFiscalNoteRows(rows, { status: 'todas', payment: 'todas', channel: 'todos', query: 'ninguem' })).toHaveLength(0);
  });
});

// ===========================================================================
// Fila de Requerimento (Módulo Fiscal ▸ Fila de Requerimento): só rejeitadas
// e com erro — o que precisa de uma ação (reenviar) do usuário.
// ===========================================================================
describe('retryQueueRows', () => {
  const order = (over: Partial<Order>): Order => ({
    id: 'o1', orderNumber: 1, total: 50, paymentMethod: 'pix', channel: 'pdv',
    fiscalIssued: false, createdAt: '10:00', createdAtISO: '2026-09-20T10:00:00.000Z',
    customer: { name: 'Cliente 1' },
    ...over,
  } as unknown as Order);

  const invoice = (over: Partial<FiscalInvoice>): FiscalInvoice => ({
    id: 'inv1', orderId: 'o1', modelo: 65, ambiente: 2, status: 'autorizada',
    createdAt: '2026-09-20T10:05:00.000Z',
    ...over,
  } as FiscalInvoice);

  const rows = buildFiscalNoteRows(
    [
      order({ id: 'o-autorizada' }),
      order({ id: 'o-sem-emissao' }),
      order({ id: 'o-rejeitada', orderNumber: 2, customer: { name: 'Maria Silva', phone: '' } }),
      order({ id: 'o-erro', orderNumber: 3 }),
    ],
    [
      invoice({ id: 'inv-ok', orderId: 'o-autorizada', status: 'autorizada' }),
      invoice({ id: 'inv-rej', orderId: 'o-rejeitada', status: 'rejeitada', rejeicaoCodigo: '866', rejeicaoMotivo: 'Ausência de troco' }),
      invoice({ id: 'inv-err', orderId: 'o-erro', status: 'erro', rejeicaoMotivo: 'Integração Brasil NFe não configurada' }),
    ],
  );

  it('só lista rejeitada/erro — nunca autorizada, sem_emissao, processando ou cancelada', () => {
    const fila = retryQueueRows(rows, '');
    expect(fila.map((r) => r.orderId).sort()).toEqual(['o-erro', 'o-rejeitada']);
  });

  it('busca por nº do pedido, cliente ou trecho do motivo', () => {
    expect(retryQueueRows(rows, '2').map((r) => r.orderId)).toEqual(['o-rejeitada']);
    expect(retryQueueRows(rows, 'maria').map((r) => r.orderId)).toEqual(['o-rejeitada']);
    expect(retryQueueRows(rows, 'não configurada').map((r) => r.orderId)).toEqual(['o-erro']);
    expect(retryQueueRows(rows, 'nada bate com isso')).toHaveLength(0);
  });
});
