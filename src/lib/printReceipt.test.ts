import { describe, it, expect } from 'vitest';
import { orderToReceiptData, buildReceiptHtml, paymentLabel, RECEIPT_TYPE_LABEL } from './printReceipt';
import type { Order, CompanyProfileData } from '../types';

// ===========================================================================
// Cupom térmico (80mm): garante que o texto mostrado no papel bate com o
// pedido (mapeamento de dados) e que o HTML gerado escapa entrada do cliente
// e some/aparece com as linhas certas conforme o pedido (taxas, desconto,
// pagamento misto, NFC-e).
// ===========================================================================

const company = (over: Partial<CompanyProfileData> = {}) =>
  ({
    name: 'Restaurante Ltda',
    tradeName: 'Café com Destino',
    cnpj: '12.345.678/0001-90',
    address: { street: 'Rua das Flores', number: '100', neighborhood: 'Centro' },
    phone: '(11) 4000-0000',
    ...over,
  }) as unknown as CompanyProfileData;

const order = (over: Partial<Order> = {}): Order =>
  ({
    id: 'o1',
    orderNumber: 42,
    channel: 'pdv',
    customer: { name: 'Maria', phone: '11999999999' },
    items: [],
    serviceType: 'consumo_local',
    subtotal: 0,
    deliveryFee: 0,
    discount: 0,
    total: 0,
    paymentMethod: 'dinheiro',
    paymentStatus: 'pagamento_aprovado',
    orderStatus: 'concluido',
    createdAt: '',
    updatedAt: '',
    fiscalIssued: true,
    ...over,
  }) as Order;

describe('paymentLabel', () => {
  it('traduz os métodos conhecidos', () => {
    expect(paymentLabel('pix')).toBe('PIX');
    expect(paymentLabel('cartao_credito')).toBe('CARTÃO CRÉDITO');
    expect(paymentLabel('vale_refeicao')).toBe('VALE-REFEIÇÃO');
  });

  it('cai para maiúsculas quando o método é desconhecido', () => {
    expect(paymentLabel('vale_presente')).toBe('VALE_PRESENTE');
  });

  it('vazio quando não informado', () => {
    expect(paymentLabel(undefined)).toBe('');
  });
});

describe('orderToReceiptData', () => {
  it('monta o endereço juntando só as partes preenchidas', () => {
    const o = order({
      customer: {
        name: 'João',
        phone: '11988887777',
        address: { street: 'Av. Brasil', number: '200', neighborhood: 'Centro', complement: '', reference: '' },
      },
    });
    expect(orderToReceiptData(o, 'delivery').deliveryAddress).toBe('Av. Brasil, 200 - Centro');
  });

  it('inclui complemento e referência quando existem', () => {
    const o = order({
      customer: {
        name: 'João',
        phone: '11988887777',
        address: { street: 'Av. Brasil', number: '200', neighborhood: 'Centro', complement: 'Ap 12', reference: 'Perto do mercado' },
      },
    });
    expect(orderToReceiptData(o, 'delivery').deliveryAddress).toBe('Av. Brasil, 200 - Ap 12 - Centro - Ref.: Perto do mercado');
  });

  it('sem endereço quando o pedido não é de entrega', () => {
    expect(orderToReceiptData(order(), 'caixa').deliveryAddress).toBeUndefined();
  });

  it('valores zerados de taxas/desconto viram undefined (não aparecem no cupom)', () => {
    const d = orderToReceiptData(order({ discount: 0, deliveryFee: 0, serviceFee: 0, couvert: 0, advancePaid: 0 }), 'caixa');
    expect(d.discount).toBeUndefined();
    expect(d.deliveryFee).toBeUndefined();
    expect(d.serviceFee).toBeUndefined();
    expect(d.couvert).toBeUndefined();
    expect(d.advancePaid).toBeUndefined();
  });

  it('mapeia itens e adicionais do pedido', () => {
    const o = order({
      items: [
        {
          id: 'i1',
          productId: 'p1',
          productName: 'Pizza',
          quantity: 2,
          unitPrice: 30,
          additions: [{ id: 'a1', name: 'Borda', price: 5 }],
          notes: 'sem cebola',
        },
      ],
    });
    expect(orderToReceiptData(o, 'caixa').items).toEqual([
      { name: 'Pizza', quantity: 2, price: 30, notes: 'sem cebola', additions: [{ id: 'a1', name: 'Borda', price: 5 }] },
    ]);
  });
});

describe('buildReceiptHtml', () => {
  const baseCompany = company();

  it('escapa HTML no nome do cliente (evita quebrar o cupom com dado do usuário)', () => {
    const d = orderToReceiptData(order({ customer: { name: '<b>Zé</b>', phone: '11999999999' } }), 'caixa');
    const html = buildReceiptHtml(d, baseCompany);
    expect(html).toContain('CLIENTE: &lt;b&gt;Zé&lt;/b&gt;');
    expect(html).not.toContain('<b>Zé</b>');
  });

  it('mostra o cabeçalho do tipo de cupom certo', () => {
    const html = buildReceiptHtml(orderToReceiptData(order(), 'cozinha'), baseCompany);
    expect(html).toContain(RECEIPT_TYPE_LABEL.cozinha);
  });

  it('some com PEDIDO #/MESA # quando não existem', () => {
    const d = orderToReceiptData(order({ orderNumber: undefined, tableNumber: undefined }), 'caixa');
    const html = buildReceiptHtml(d, baseCompany);
    expect(html).not.toContain('PEDIDO #');
    expect(html).not.toContain('MESA #');
  });

  it('some com as linhas de taxa/desconto quando os valores são zero/ausentes', () => {
    const html = buildReceiptHtml(orderToReceiptData(order(), 'caixa'), baseCompany);
    expect(html).not.toContain('TAXA ENTREGA');
    expect(html).not.toContain('TAXA DE SERVIÇO');
    expect(html).not.toContain('COUVERT');
    expect(html).not.toContain('DESCONTO');
    expect(html).not.toContain('ADIANTAMENTO PAGO');
  });

  it('troca o rótulo do total para "RESTANTE A PAGAR" quando há adiantamento', () => {
    const d = orderToReceiptData(order({ advancePaid: 20, total: 30 }), 'adiantamento_parcial');
    const html = buildReceiptHtml(d, baseCompany);
    expect(html).toContain('RESTANTE A PAGAR:');
    expect(html).not.toContain('>TOTAL:<');
  });

  it('lista pagamento misto em vez do método único quando há splitPayments', () => {
    const d = orderToReceiptData(
      order({ splitPayments: [{ method: 'pix', amount: 20 }, { method: 'dinheiro', amount: 10 }] }),
      'caixa',
    );
    const html = buildReceiptHtml(d, baseCompany);
    expect(html).toContain('Pagamento Misto');
    expect(html).toContain('PIX');
    expect(html).toContain('DINHEIRO');
  });

  it('mostra a chave da NFC-e só quando o pedido foi emitido', () => {
    const semNota = buildReceiptHtml(orderToReceiptData(order(), 'caixa'), baseCompany);
    expect(semNota).not.toContain('NFC-e EMITIDA');

    const comNota = buildReceiptHtml(orderToReceiptData(order({ nfceKey: '123456789' }), 'caixa'), baseCompany);
    expect(comNota).toContain('NFC-e EMITIDA COM SUCESSO');
    expect(comNota).toContain('123456789');
  });
});
