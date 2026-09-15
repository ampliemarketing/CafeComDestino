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
  PAYMENT_METHOD_SEFAZ,
} from './fiscal';
import type { FiscalData, Order, TaxGroup } from '../types';

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
    const old = { ncm: '2106.90.90', cfop: '5102', cstCsosn: '102', taxPercentage: 4.5 };
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
