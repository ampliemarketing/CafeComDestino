import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabaseClient';
import { hasPermission } from '../../lib/permissions';
import { CashLedgerEntryType } from '../../types';
import { BookOpen, Download, ArrowDownCircle, ArrowUpCircle, Filter, Search, Loader2 } from 'lucide-react';

const TYPE_LABEL: Record<CashLedgerEntryType, string> = {
  abertura: 'Abertura',
  venda: 'Venda',
  adiantamento: 'Adiantamento',
  estorno_venda: 'Estorno de venda',
  estorno_adiantamento: 'Estorno de adiant.',
  sangria: 'Sangria',
  suprimento: 'Suprimento',
  troco: 'Troco',
  despesa: 'Despesa',
  taxa_servico: 'Taxa de serviço',
  couvert: 'Couvert',
  ajuste: 'Ajuste',
};

const METHOD_LABEL: Record<string, string> = {
  dinheiro: 'Dinheiro',
  cartao_credito: 'Crédito',
  cartao_debito: 'Débito',
  pix: 'Pix',
  vale_refeicao: 'Vale-refeição',
  boleto: 'Boleto',
  outro: 'Outro',
};

interface Row {
  id: string;
  seq: number;
  shiftId: string;
  entryType: CashLedgerEntryType;
  direction: 'entrada' | 'saida';
  paymentMethod: string | null;
  amount: number;
  orderId: string | null;
  comandaId: string | null;
  tableId: string | null;
  reason: string | null;
  createdByName: string;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

const fmt = (v: number) => `R$ ${v.toFixed(2)}`;
const fmtDateTime = (iso?: string) => (iso ? new Date(iso).toLocaleString('pt-BR') : '—');

const describe = (r: Row): { main: string; ref?: string } => {
  const on = r.metadata?.orderNumber;
  if (r.tableId) return { main: r.reason || `Mesa ${r.tableId}`, ref: `Mesa ${r.tableId}` };
  if (on) return { main: r.reason || `Pedido #${on}`, ref: `Pedido #${on}` };
  return { main: r.reason || '—' };
};

export const CashLedgerView: React.FC = () => {
  const { cashShiftsHistory, cashShift, currentUser } = useApp();
  const canExport = hasPermission(currentUser, 'livro_caixa.exportar');

  const [shiftFilter, setShiftFilter] = useState<string>(cashShift.id || 'all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);

  const runSearch = async () => {
    setLoading(true);
    let q = supabase.from('cash_ledger').select('*').order('seq', { ascending: true }).limit(3000);
    if (shiftFilter !== 'all') q = q.eq('shift_id', shiftFilter);
    if (typeFilter !== 'all') q = q.eq('entry_type', typeFilter);
    if (methodFilter !== 'all') q = q.eq('payment_method', methodFilter);
    if (fromDate) q = q.gte('created_at', fromDate);
    if (toDate) q = q.lte('created_at', toDate + 'T23:59:59');
    const { data, error } = await q;
    setLoading(false);
    if (error) { setRows([]); return; }
    setRows((data || []).map((d): Row => ({
      id: d.id,
      seq: d.seq,
      shiftId: d.shift_id,
      entryType: d.entry_type,
      direction: d.direction,
      paymentMethod: d.payment_method,
      amount: Number(d.amount),
      orderId: d.order_id,
      comandaId: d.comanda_id,
      tableId: d.table_id,
      reason: d.reason,
      createdByName: d.created_by_name,
      createdAt: d.created_at,
      metadata: d.metadata,
    })));
  };

  const filteredRows = useMemo(() => {
    if (!rows) return [];
    let list = rows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((l) =>
        (l.reason || '').toLowerCase().includes(q) ||
        (l.orderId || '').toLowerCase().includes(q) ||
        (l.createdByName || '').toLowerCase().includes(q) ||
        String(l.metadata?.orderNumber || '').includes(q)
      );
    }
    let running = 0;
    return list.map((l) => {
      const signed = l.direction === 'entrada' ? l.amount : -l.amount;
      running += signed;
      return { ...l, signed, running };
    });
  }, [rows, search]);

  const totals = useMemo(() => {
    const entradas = filteredRows.filter((r) => r.direction === 'entrada').reduce((s, r) => s + r.amount, 0);
    const saidas = filteredRows.filter((r) => r.direction === 'saida').reduce((s, r) => s + r.amount, 0);
    return { entradas, saidas, saldo: entradas - saidas };
  }, [filteredRows]);

  const exportCsv = () => {
    const header = ['Data/Hora', 'Turno', 'Tipo', 'Direção', 'Forma', 'Valor', 'Saldo', 'Referência', 'Descrição', 'Operador'];
    const lines = filteredRows.map((r) => {
      const d = describe(r);
      return [
        fmtDateTime(r.createdAt), r.shiftId, TYPE_LABEL[r.entryType] || r.entryType, r.direction,
        r.paymentMethod ? (METHOD_LABEL[r.paymentMethod] || r.paymentMethod) : '',
        r.signed.toFixed(2), r.running.toFixed(2), d.ref || '', (d.main || '').replace(/[\n;]/g, ' '), r.createdByName,
      ];
    });
    const csv = [header, ...lines].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `livro-caixa-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const shiftLabel = (s: { id: string; openedAt: string; status: string }, i: number) =>
    `Turno ${cashShiftsHistory.length - i} — ${s.openedAt}${s.status === 'aberto' ? ' (aberto)' : ''}`;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5 min-h-screen">
      <div className="bg-stone-900 text-stone-100 p-5 rounded-2xl border border-stone-800 flex items-center gap-4 shadow-md">
        <div className="w-12 h-12 rounded-2xl bg-amber-800 text-white flex items-center justify-center shrink-0">
          <BookOpen className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold">Livro-Caixa</h1>
          <p className="text-xs text-stone-400">Todo lançamento de entrada e saída, linha a linha, com saldo corrente. Registro imutável.</p>
        </div>
        {canExport && rows && rows.length > 0 && (
          <button onClick={exportCsv} className="flex items-center gap-1.5 bg-amber-800 hover:bg-amber-900 text-white px-3 py-2 rounded-xl text-xs font-bold shadow">
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-stone-500 uppercase tracking-wider">
          <Filter className="w-3.5 h-3.5" /> Filtros
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          <label className="flex flex-col gap-1">
            <span className="font-semibold text-stone-600">Turno</span>
            <select value={shiftFilter} onChange={(e) => setShiftFilter(e.target.value)} className="border rounded-lg p-2">
              <option value="all">Todos</option>
              {cashShiftsHistory.map((s, i) => (
                <option key={s.id} value={s.id}>{shiftLabel(s, i)}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold text-stone-600">Tipo</span>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="border rounded-lg p-2">
              <option value="all">Todos</option>
              {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold text-stone-600">Forma de pagamento</span>
            <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} className="border rounded-lg p-2">
              <option value="all">Todas</option>
              {Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold text-stone-600">De</span>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="border rounded-lg p-2" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold text-stone-600">Até</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="border rounded-lg p-2" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold text-stone-600">Buscar (motivo, pedido, operador)</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="filtra o resultado carregado" className="border rounded-lg p-2" />
          </label>
        </div>
        <button
          onClick={runSearch}
          disabled={loading}
          className="flex items-center gap-1.5 bg-stone-900 hover:bg-stone-800 text-white px-4 py-2 rounded-xl text-xs font-bold shadow disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {loading ? 'Carregando…' : 'Buscar lançamentos'}
        </button>
      </div>

      {rows === null ? (
        <div className="bg-white p-10 rounded-2xl border border-stone-200 shadow-sm text-center text-stone-400 text-sm">
          Ajuste os filtros e clique em <strong>Buscar lançamentos</strong>.
        </div>
      ) : (
        <>
          {/* Resumo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
              <div className="flex items-center gap-1.5 text-emerald-700"><ArrowUpCircle className="w-4 h-4" /><span className="text-[10px] font-bold uppercase">Entradas</span></div>
              <p className="text-xl font-bold text-stone-900 mt-1">{fmt(totals.entradas)}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
              <div className="flex items-center gap-1.5 text-rose-700"><ArrowDownCircle className="w-4 h-4" /><span className="text-[10px] font-bold uppercase">Saídas</span></div>
              <p className="text-xl font-bold text-stone-900 mt-1">{fmt(totals.saidas)}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-[10px] font-bold uppercase text-stone-500">Saldo do filtro</span>
              <p className={`text-xl font-bold mt-1 ${totals.saldo < 0 ? 'text-rose-700' : 'text-stone-900'}`}>{fmt(totals.saldo)}</p>
            </div>
          </div>

          {/* Tabela */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto max-h-[560px]">
              <table className="w-full text-xs text-left">
                <thead className="bg-stone-100 text-stone-600 uppercase font-bold border-b sticky top-0">
                  <tr>
                    <th className="p-2.5">Data/Hora</th>
                    <th className="p-2.5">Tipo</th>
                    <th className="p-2.5">Forma</th>
                    <th className="p-2.5">Descrição</th>
                    <th className="p-2.5 text-right">Entrada</th>
                    <th className="p-2.5 text-right">Saída</th>
                    <th className="p-2.5 text-right">Saldo</th>
                    <th className="p-2.5">Operador</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredRows.length === 0 && (
                    <tr><td colSpan={8} className="p-8 text-center text-stone-400">Nenhum lançamento para os filtros selecionados.</td></tr>
                  )}
                  {filteredRows.map((r) => {
                    const d = describe(r);
                    return (
                      <tr key={r.id} className="hover:bg-stone-50">
                        <td className="p-2.5 text-stone-600 whitespace-nowrap">{fmtDateTime(r.createdAt)}</td>
                        <td className="p-2.5 font-semibold text-stone-800">{TYPE_LABEL[r.entryType] || r.entryType}</td>
                        <td className="p-2.5 text-stone-600">{r.paymentMethod ? (METHOD_LABEL[r.paymentMethod] || r.paymentMethod) : '—'}</td>
                        <td className="p-2.5 text-stone-600">
                          {d.main}
                          {d.ref && d.ref !== d.main && <span className="block text-[10px] text-stone-400">{d.ref}</span>}
                        </td>
                        <td className="p-2.5 text-right font-semibold text-emerald-700">{r.direction === 'entrada' ? fmt(r.amount) : ''}</td>
                        <td className="p-2.5 text-right font-semibold text-rose-700">{r.direction === 'saida' ? fmt(r.amount) : ''}</td>
                        <td className={`p-2.5 text-right font-bold ${r.running < 0 ? 'text-rose-700' : 'text-stone-900'}`}>{fmt(r.running)}</td>
                        <td className="p-2.5 text-stone-500">{r.createdByName}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
