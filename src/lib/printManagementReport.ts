// Geração e impressão do relatório gerencial (vendas, perdas, cortesias) em
// formato A4. Segue o mesmo padrão de impressão do cupom (src/lib/printReceipt.ts):
// HTML puro, sem libs de PDF, disparado num iframe fora de tela via window.print().
// O usuário gera o PDF de fato escolhendo "Salvar como PDF" na caixa de impressão
// do navegador — não há geração de PDF binário no cliente.

import type { CompanyProfileData } from '../types';

export interface ReportChannelRow {
  name: string;
  value: number;
}

export interface ReportProductRow {
  name: string;
  quantity: number;
  revenue: number;
}

export interface ReportReasonRow {
  name: string;
  value: number;
}

export interface ManagementReportData {
  generatedAt: string;
  sales: {
    totalRevenue: number;
    totalCount: number;
    averageTicket: number;
    byChannel: ReportChannelRow[];
    topProducts: ReportProductRow[];
  };
  losses: {
    totalCost: number;
    count: number;
    byReason: ReportReasonRow[];
  };
  courtesies: {
    totalRetailValue: number;
    totalCostValue: number;
    count: number;
    byReason: ReportReasonRow[];
  };
}

const brl = (v: number) => `R$ ${v.toFixed(2)}`;

const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const table = (headers: string[], rows: string[][], emptyLabel: string): string => {
  if (rows.length === 0) return `<p class="muted">${esc(emptyLabel)}</p>`;
  return `
    <table>
      <thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  `;
};

export function buildManagementReportHtml(d: ManagementReportData, company: CompanyProfileData): string {
  const salesRows = table(
    ['Canal', 'Faturamento'],
    d.sales.byChannel.map((c) => [esc(c.name), brl(c.value)]),
    'Sem vendas registradas.',
  );

  const productRows = table(
    ['Produto', 'Qtd. Vendida', 'Faturamento'],
    d.sales.topProducts.map((p) => [esc(p.name), String(p.quantity), brl(p.revenue)]),
    'Sem itens vendidos registrados.',
  );

  const lossRows = table(
    ['Motivo', 'Custo (R$)'],
    d.losses.byReason.map((r) => [esc(r.name), brl(r.value)]),
    'Sem registros de perda.',
  );

  const courtesyRows = table(
    ['Motivo', 'Valor de Venda (R$)'],
    d.courtesies.byReason.map((r) => [esc(r.name), brl(r.value)]),
    'Sem registros de cortesia.',
  );

  return `<!doctype html><html><head><meta charset="utf-8"><title>Relatório Gerencial</title><style>
    @page { size: A4; margin: 15mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body { font-family: "Segoe UI", Arial, sans-serif; font-size: 12px; color: #1c1917; }
    h1 { font-size: 18px; margin: 0 0 2px; }
    h2 { font-size: 13px; margin: 0 0 8px; padding-bottom: 4px; border-bottom: 2px solid #78350f; color: #78350f; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1c1917; padding-bottom: 10px; margin-bottom: 16px; }
    .muted { color: #78716c; font-size: 10px; margin: 4px 0 0; }
    section { margin-bottom: 20px; page-break-inside: avoid; }
    .kpis { display: flex; gap: 12px; margin-bottom: 10px; }
    .kpi { flex: 1; border: 1px solid #d6d3d1; border-radius: 6px; padding: 8px 10px; }
    .kpi .label { font-size: 9px; text-transform: uppercase; color: #78716c; font-weight: 700; }
    .kpi .value { font-size: 15px; font-weight: 700; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { text-align: left; padding: 5px 8px; border-bottom: 1px solid #e7e5e4; }
    th { background: #f5f5f4; font-size: 9px; text-transform: uppercase; color: #57534e; }
    td:last-child, th:last-child { text-align: right; }
    footer { margin-top: 24px; font-size: 9px; color: #a8a29e; text-align: center; }
  </style></head><body>
    <div class="header">
      <div>
        <h1>${esc(company.tradeName || company.name)}</h1>
        <p class="muted">CNPJ: ${esc(company.cnpj || '—')}</p>
      </div>
      <div style="text-align:right">
        <h1>Relatório Gerencial</h1>
        <p class="muted">Gerado em ${esc(d.generatedAt)}</p>
      </div>
    </div>

    <section>
      <h2>Vendas &amp; Faturamento</h2>
      <div class="kpis">
        <div class="kpi"><div class="label">Faturamento Bruto</div><div class="value">${brl(d.sales.totalRevenue)}</div></div>
        <div class="kpi"><div class="label">Total de Pedidos</div><div class="value">${d.sales.totalCount}</div></div>
        <div class="kpi"><div class="label">Ticket Médio</div><div class="value">${brl(d.sales.averageTicket)}</div></div>
      </div>
      ${salesRows}
      <div style="margin-top:10px">${productRows}</div>
    </section>

    <section>
      <h2>Perdas de Estoque</h2>
      <div class="kpis">
        <div class="kpi"><div class="label">Custo Total de Perdas</div><div class="value">${brl(d.losses.totalCost)}</div></div>
        <div class="kpi"><div class="label">Ocorrências</div><div class="value">${d.losses.count}</div></div>
      </div>
      ${lossRows}
    </section>

    <section>
      <h2>Cortesias Concedidas</h2>
      <div class="kpis">
        <div class="kpi"><div class="label">Valor de Venda Concedido</div><div class="value">${brl(d.courtesies.totalRetailValue)}</div></div>
        <div class="kpi"><div class="label">Custo Real de Produção</div><div class="value">${brl(d.courtesies.totalCostValue)}</div></div>
        <div class="kpi"><div class="label">Lançamentos</div><div class="value">${d.courtesies.count}</div></div>
      </div>
      ${courtesyRows}
    </section>

    <footer>${esc(company.name)} — Sistema de Gestão · Pedidos cancelados não entram no faturamento.</footer>
  </body></html>`;
}

/**
 * Mesma técnica do cupom (iframe com srcdoc + window.print()), mas com um
 * iframe A4 em vez de bobina de 80 mm. Sem lib de PDF: o "Exportar PDF" vira
 * "Salvar como PDF" na caixa de impressão do navegador.
 */
export function printManagementReportHtml(html: string, onError?: (msg: string) => void): void {
  try {
    document.querySelectorAll('iframe[data-print-report]').forEach((el) => el.remove());

    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-print-report', '');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:210mm;height:1400px;border:0;opacity:0;';

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
      setTimeout(() => {
        try {
          win.focus();
          win.print();
        } catch {
          onError?.('O navegador bloqueou a exportação do relatório.');
        }
        setTimeout(cleanup, 15_000);
      }, 60);
    };

    iframe.srcdoc = html;
    document.body.appendChild(iframe);
  } catch {
    onError?.('Não foi possível gerar o relatório.');
  }
}
