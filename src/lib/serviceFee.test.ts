import { describe, it, expect } from 'vitest';
import { comandaServiceFee, comandaCouvert } from './serviceFee';

// ===========================================================================
// Dinheiro. Estas duas funções têm que dar EXATAMENTE o mesmo número que a RPC
// close_comanda_and_pay (servidor) — o front usa o resultado pra montar o total
// mostrado ao cliente antes de fechar a comanda. Divergência aqui = troco errado.
// ===========================================================================

const profile = (over: Partial<Parameters<typeof comandaServiceFee>[1] & Parameters<typeof comandaCouvert>[1]> = {}) => ({
  serviceFeeEnabled: true,
  serviceFeePercent: 10,
  couvertEnabled: true,
  couvertValue: 8,
  ...over,
});

describe('comandaServiceFee', () => {
  it('aplica o percentual sobre o subtotal', () => {
    expect(comandaServiceFee({ subtotal: 100, serviceFeeApplied: undefined }, profile())).toBe(10);
    expect(comandaServiceFee({ subtotal: 250, serviceFeeApplied: undefined }, profile({ serviceFeePercent: 12 }))).toBe(30);
  });

  it('arredonda para 2 casas (meio centavo)', () => {
    // 33.33 * 10 / 100 = 3.333 -> 3.33
    expect(comandaServiceFee({ subtotal: 33.33, serviceFeeApplied: undefined }, profile())).toBe(3.33);
    // 100.55 * 13 / 100 = 13.0715 -> 13.07
    expect(comandaServiceFee({ subtotal: 100.55, serviceFeeApplied: undefined }, profile({ serviceFeePercent: 13 }))).toBe(13.07);
  });

  it('não cobra quando a taxa está desabilitada na empresa', () => {
    expect(comandaServiceFee({ subtotal: 100, serviceFeeApplied: undefined }, profile({ serviceFeeEnabled: false }))).toBe(0);
  });

  it('não cobra quando o garçom removeu a taxa (serviceFeeApplied === false)', () => {
    expect(comandaServiceFee({ subtotal: 100, serviceFeeApplied: false }, profile())).toBe(0);
  });

  it('cobra quando serviceFeeApplied === true explicitamente', () => {
    expect(comandaServiceFee({ subtotal: 100, serviceFeeApplied: true }, profile())).toBe(10);
  });

  it('percentual ausente/zero => 0', () => {
    expect(comandaServiceFee({ subtotal: 100, serviceFeeApplied: undefined }, profile({ serviceFeePercent: 0 }))).toBe(0);
  });

  it('subtotal 0 => 0', () => {
    expect(comandaServiceFee({ subtotal: 0, serviceFeeApplied: undefined }, profile())).toBe(0);
  });
});

describe('comandaCouvert', () => {
  it('cobra o valor FIXO (não multiplica por pessoas) quando qty ausente', () => {
    expect(comandaCouvert({ couvertQty: undefined, couvertApplied: undefined }, profile({ couvertValue: 8 }))).toBe(8);
  });

  it('multiplica pelo couvertQty quando definido', () => {
    expect(comandaCouvert({ couvertQty: 3, couvertApplied: undefined }, profile({ couvertValue: 8.5 }))).toBe(25.5);
  });

  it('trata couvertQty null como 1', () => {
    expect(comandaCouvert({ couvertQty: null as unknown as number, couvertApplied: undefined }, profile({ couvertValue: 8 }))).toBe(8);
  });

  it('não cobra quando o couvert está desabilitado na empresa', () => {
    expect(comandaCouvert({ couvertQty: 2, couvertApplied: undefined }, profile({ couvertEnabled: false }))).toBe(0);
  });

  it('não cobra quando removido da comanda (couvertApplied === false)', () => {
    expect(comandaCouvert({ couvertQty: 2, couvertApplied: false }, profile({ couvertValue: 8 }))).toBe(0);
  });

  it('couvertValue ausente/zero => 0', () => {
    expect(comandaCouvert({ couvertQty: 4, couvertApplied: undefined }, profile({ couvertValue: 0 }))).toBe(0);
  });

  it('arredonda para 2 casas', () => {
    // 8.333 * 3 = 24.999 -> 25.00
    expect(comandaCouvert({ couvertQty: 3, couvertApplied: undefined }, profile({ couvertValue: 8.333 }))).toBe(25);
  });
});
