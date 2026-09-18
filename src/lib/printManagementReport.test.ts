import { describe, it, expect } from 'vitest';
import { buildManagementReportHtml, type ManagementReportData } from './printManagementReport';
import type { CompanyProfileData } from '../types';

// ===========================================================================
// Relatório gerencial A4: confere os estados "sem registro", a renderização
// das tabelas quando há dados, as seções opcionais (forma de pagamento,
// diária) e o escape de HTML vindo de nomes de produto/motivo cadastrados
// pelo usuário.
// ===========================================================================

const company = (over: Partial<CompanyProfileData> = {}) =>
  ({
    name: 'Restaurante Ltda',
    tradeName: 'Café com Destino',
    cnpj: '12.345.678/0001-90',
    ...over,
  }) as unknown as CompanyProfileData;

const baseData = (over: Partial<ManagementReportData> = {}): ManagementReportData => ({
  generatedAt: '18/09/2026 10:00',
  sales: { totalRevenue: 0, totalCount: 0, averageTicket: 0, byChannel: [], topProducts: [] },
  losses: { totalCost: 0, count: 0, byReason: [] },
  courtesies: { totalRetailValue: 0, totalCostValue: 0, count: 0, byReason: [] },
  ...over,
});

describe('buildManagementReportHtml', () => {
  it('mostra as mensagens de "sem registro" quando as listas vêm vazias', () => {
    const html = buildManagementReportHtml(baseData(), company());
    expect(html).toContain('Sem vendas registradas.');
    expect(html).toContain('Sem itens vendidos registrados.');
    expect(html).toContain('Sem registros de perda.');
    expect(html).toContain('Sem registros de cortesia.');
  });

  it('renderiza as linhas das tabelas quando há dados', () => {
    const html = buildManagementReportHtml(
      baseData({
        sales: {
          totalRevenue: 150,
          totalCount: 3,
          averageTicket: 50,
          byChannel: [{ name: 'Salão', value: 150 }],
          topProducts: [{ name: 'Pizza', quantity: 3, revenue: 150 }],
        },
      }),
      company(),
    );
    expect(html).toContain('Salão');
    expect(html).toContain('R$ 150.00');
    expect(html).toContain('Pizza');
  });

  it('só mostra a tabela de forma de pagamento e a diária quando informadas', () => {
    const semExtras = buildManagementReportHtml(baseData(), company());
    expect(semExtras).not.toContain('Por forma de pagamento');
    expect(semExtras).not.toContain('Faturamento por dia');

    const comExtras = buildManagementReportHtml(
      baseData({
        sales: {
          totalRevenue: 0,
          totalCount: 0,
          averageTicket: 0,
          byChannel: [],
          topProducts: [],
          byPaymentMethod: [{ name: 'PIX', value: 50 }],
          daily: [{ date: '18/09', revenue: 50, count: 1 }],
        },
      }),
      company(),
    );
    expect(comExtras).toContain('Por forma de pagamento');
    expect(comExtras).toContain('Faturamento por dia');
  });

  it('escapa nome de motivo/produto para evitar HTML injetado no relatório', () => {
    const html = buildManagementReportHtml(
      baseData({ losses: { totalCost: 10, count: 1, byReason: [{ name: '<script>alert(1)</script>', value: 10 }] } }),
      company(),
    );
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('usa "—" quando a empresa não tem CNPJ cadastrado', () => {
    expect(buildManagementReportHtml(baseData(), company({ cnpj: '' }))).toContain('CNPJ: —');
  });

  it('mostra o período só quando informado', () => {
    expect(buildManagementReportHtml(baseData({ period: '01/09 a 18/09/2026' }), company())).toContain(
      'Período: 01/09 a 18/09/2026',
    );
    expect(buildManagementReportHtml(baseData(), company())).not.toContain('Período:');
  });
});
