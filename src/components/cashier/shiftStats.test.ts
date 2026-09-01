import { describe, it, expect } from 'vitest';
import { diffTone, computeShiftStats } from './shiftStats';
import type { Order, Product, Category } from '../../types';

// ===========================================================================
// Números do fechamento de caixa: total bruto do turno, ticket médio, quebra
// por categoria e o tom (verde/vermelho/âmbar) da diferença de conferência.
// ===========================================================================

describe('diffTone', () => {
  it('neutro quando não há diferença informada', () => {
    expect(diffTone(undefined)).toBe('neutral');
    expect(diffTone(null)).toBe('neutral');
  });
  it('ok quando bate exatamente', () => {
    expect(diffTone(0)).toBe('ok');
  });
  it('short quando falta dinheiro (negativo)', () => {
    expect(diffTone(-0.01)).toBe('short');
    expect(diffTone(-50)).toBe('short');
  });
  it('over quando sobra dinheiro (positivo)', () => {
    expect(diffTone(0.01)).toBe('over');
    expect(diffTone(50)).toBe('over');
  });
});

// --- fábricas de fixture -----------------------------------------------------
const cat = (id: string, name: string): Category =>
  ({ id, name, icon: '', order: 0, active: true, showsInStock: false }) as Category;

const prod = (id: string, categoryId: string): Product =>
  ({ id, categoryId, name: id, code: id, price: 0 }) as unknown as Product;

const order = (over: Partial<Order>): Order =>
  ({
    id: 'o1',
    orderNumber: 1,
    channel: 'pdv',
    customer: { name: 'x', phone: '' },
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

describe('computeShiftStats', () => {
  it('turno vazio zera tudo', () => {
    const s = computeShiftStats([], [], []);
    expect(s).toEqual({
      totalBruto: 0,
      numPedidos: 0,
      ticketMedio: 0,
      cancelamentos: { qtd: 0, valor: 0 },
      descontos: { qtd: 0, valor: 0 },
      porCategoria: [],
    });
  });

  it('soma bruto e ticket médio só dos pedidos não cancelados', () => {
    const orders = [
      order({ id: 'a', total: 100 }),
      order({ id: 'b', total: 50 }),
      order({ id: 'c', total: 999, orderStatus: 'cancelado' }),
    ];
    const s = computeShiftStats(orders, [], []);
    expect(s.totalBruto).toBe(150);
    expect(s.numPedidos).toBe(2);
    expect(s.ticketMedio).toBe(75);
  });

  it('contabiliza cancelamentos à parte (qtd e valor)', () => {
    const orders = [
      order({ id: 'a', total: 100 }),
      order({ id: 'c', total: 40, orderStatus: 'cancelado' }),
      order({ id: 'd', total: 10, orderStatus: 'cancelado' }),
    ];
    const s = computeShiftStats(orders, [], []);
    expect(s.cancelamentos).toEqual({ qtd: 2, valor: 50 });
  });

  it('contabiliza descontos (qtd e soma dos descontos)', () => {
    const orders = [
      order({ id: 'a', total: 90, discount: 10 }),
      order({ id: 'b', total: 100, discount: 0 }),
      order({ id: 'c', total: 45, discount: 5 }),
    ];
    const s = computeShiftStats(orders, [], []);
    expect(s.descontos).toEqual({ qtd: 2, valor: 15 });
  });

  it('quebra por categoria: (unitPrice + adicionais) * quantidade, ordenado desc', () => {
    const categories = [cat('bebidas', 'Bebidas'), cat('pratos', 'Pratos')];
    const products = [prod('coca', 'bebidas'), prod('feijoada', 'pratos')];
    const orders = [
      order({
        id: 'a',
        total: 0,
        items: [
          { id: 'i1', productId: 'coca', productName: 'Coca', quantity: 2, unitPrice: 6, additions: [] },
          {
            id: 'i2',
            productId: 'feijoada',
            productName: 'Feijoada',
            quantity: 1,
            unitPrice: 40,
            additions: [{ id: 'x', name: 'Bacon extra', price: 5 }],
          },
        ],
      }),
    ];
    const s = computeShiftStats(orders, products, categories);
    expect(s.porCategoria).toEqual([
      { categoryId: 'pratos', categoryName: 'Pratos', total: 45 },
      { categoryId: 'bebidas', categoryName: 'Bebidas', total: 12 },
    ]);
  });

  it('item de produto desconhecido cai em "outros"/"Outros"', () => {
    const orders = [
      order({
        id: 'a',
        items: [{ id: 'i1', productId: 'fantasma', productName: '?', quantity: 1, unitPrice: 10, additions: [] }],
      }),
    ];
    const s = computeShiftStats(orders, [], []);
    expect(s.porCategoria).toEqual([{ categoryId: 'outros', categoryName: 'Outros', total: 10 }]);
  });

  it('itens de pedido cancelado não entram na quebra por categoria', () => {
    const products = [prod('coca', 'bebidas')];
    const orders = [
      order({
        id: 'a',
        orderStatus: 'cancelado',
        items: [{ id: 'i1', productId: 'coca', productName: 'Coca', quantity: 5, unitPrice: 6, additions: [] }],
      }),
    ];
    const s = computeShiftStats(orders, products, [cat('bebidas', 'Bebidas')]);
    expect(s.porCategoria).toEqual([]);
  });
});
