import { describe, it, expect } from 'vitest';
import {
  emptyFiscalData,
  normalizeFiscalData,
  fiscalFieldErrors,
  fiscalMissingFields,
  isFiscalComplete,
  resolveProductFiscal,
} from './fiscal';
import type { FiscalData, TaxGroup } from '../types';

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
