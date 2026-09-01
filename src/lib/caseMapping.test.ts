import { describe, it, expect } from 'vitest';
import { toCamelKey, toSnakeKey, rowToCamel, toRow } from './caseMapping';

// ===========================================================================
// Toda leitura/escrita no Supabase passa por aqui (AppContext mapeia cada linha).
// Um erro de conversão faz um campo "sumir" silenciosamente ao salvar.
// ===========================================================================

describe('toCamelKey', () => {
  it('converte snake_case simples e composto', () => {
    expect(toCamelKey('opened_at')).toBe('openedAt');
    expect(toCamelKey('sales_cash')).toBe('salesCash');
    expect(toCamelKey('nfce_key')).toBe('nfceKey');
    expect(toCamelKey('initial_float')).toBe('initialFloat');
  });
  it('deixa chave sem underscore intacta', () => {
    expect(toCamelKey('id')).toBe('id');
    expect(toCamelKey('subtotal')).toBe('subtotal');
  });
});

describe('toSnakeKey', () => {
  it('converte camelCase de volta', () => {
    expect(toSnakeKey('openedAt')).toBe('opened_at');
    expect(toSnakeKey('salesCash')).toBe('sales_cash');
    expect(toSnakeKey('nfceKey')).toBe('nfce_key');
  });
  it('deixa chave já snake/simples intacta', () => {
    expect(toSnakeKey('id')).toBe('id');
    expect(toSnakeKey('subtotal')).toBe('subtotal');
  });
});

describe('round-trip', () => {
  it('snake -> camel -> snake preserva chaves alfabéticas', () => {
    for (const k of ['opened_at', 'sales_meal_voucher', 'expected_total', 'delivery_driver_name']) {
      expect(toSnakeKey(toCamelKey(k))).toBe(k);
    }
  });

  it('ASSIMETRIA CONHECIDA: dígito após underscore não sobrevive ao round-trip', () => {
    // toCamelKey('line_1') -> 'line1'; toSnakeKey('line1') -> 'line1' (sem "_").
    // Nenhuma coluna do schema usa esse padrão hoje — este teste é um alarme
    // caso alguém adicione uma (ex.: address_line_1) e o save comece a falhar.
    expect(toCamelKey('line_1')).toBe('line1');
    expect(toSnakeKey(toCamelKey('line_1'))).toBe('line1');
  });
});

describe('rowToCamel', () => {
  it('converte todas as chaves de topo', () => {
    expect(rowToCamel({ id: 'x', opened_at: '10:00', sales_cash: 42 })).toEqual({
      id: 'x',
      openedAt: '10:00',
      salesCash: 42,
    });
  });
  it('mantém valores por referência e não mexe em objeto aninhado', () => {
    const nested = { zipCode: '01000-000', line_1: 'Rua A' };
    const out = rowToCamel<{ addressJson: typeof nested }>({ address_json: nested });
    expect(out.addressJson).toBe(nested); // mesma referência
    expect(out.addressJson.line_1).toBe('Rua A'); // chave interna intocada
  });
});

describe('toRow', () => {
  it('converte objeto camelCase para linha snake_case', () => {
    expect(toRow({ openedBy: 'u1', initialFloat: 100, status: 'aberto' })).toEqual({
      opened_by: 'u1',
      initial_float: 100,
      status: 'aberto',
    });
  });
  it('toRow(rowToCamel(row)) reconstrói a linha original (chaves alfabéticas)', () => {
    const row = { opened_by: 'u1', initial_float: 100, expected_total: 0, status: 'aberto' };
    expect(toRow(rowToCamel(row))).toEqual(row);
  });
});
