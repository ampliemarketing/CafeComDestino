import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ShieldCheck, Filter } from 'lucide-react';

const fmtMoney = (v?: number) => (v == null ? '' : `R$ ${Number(v).toFixed(2)}`);

export const AuditLogView: React.FC = () => {
  const { auditLogs } = useApp();
  const [actor, setActor] = useState('all');
  const [action, setAction] = useState('all');
  const [search, setSearch] = useState('');

  const actors = useMemo(() => Array.from(new Set(auditLogs.map((l) => l.userName))).sort(), [auditLogs]);
  const actions = useMemo(() => Array.from(new Set(auditLogs.map((l) => l.action))).sort(), [auditLogs]);

  const rows = useMemo(() => {
    let list = [...auditLogs];
    if (actor !== 'all') list = list.filter((l) => l.userName === actor);
    if (action !== 'all') list = list.filter((l) => l.action === action);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((l) =>
        l.action.toLowerCase().includes(q) ||
        (l.module || '').toLowerCase().includes(q) ||
        (l.entityId || '').toLowerCase().includes(q) ||
        JSON.stringify(l.details || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [auditLogs, actor, action, search]);

  const renderDetails = (d: unknown) => {
    if (d == null) return '—';
    if (typeof d === 'string') return d;
    try { return JSON.stringify(d); } catch { return String(d); }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5 min-h-screen">
      <div className="bg-stone-900 text-stone-100 p-5 rounded-2xl border border-stone-800 flex items-center gap-4 shadow-md">
        <div className="w-12 h-12 rounded-2xl bg-amber-800 text-white flex items-center justify-center shrink-0">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-lg font-bold">Auditoria</h1>
          <p className="text-xs text-stone-400">Trilha imutável de quem fez o quê e quando. Registrada no servidor.</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
        <div className="flex items-center gap-1.5 text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">
          <Filter className="w-3.5 h-3.5" /> Filtros
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <label className="flex flex-col gap-1">
            <span className="font-semibold text-stone-600">Usuário</span>
            <select value={actor} onChange={(e) => setActor(e.target.value)} className="border rounded-lg p-2">
              <option value="all">Todos</option>
              {actors.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold text-stone-600">Ação</span>
            <select value={action} onChange={(e) => setAction(e.target.value)} className="border rounded-lg p-2">
              <option value="all">Todas</option>
              {actions.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold text-stone-600">Buscar</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="módulo, entidade, detalhe..." className="border rounded-lg p-2" />
          </label>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-xs text-left">
            <thead className="bg-stone-100 text-stone-600 uppercase font-bold border-b sticky top-0">
              <tr>
                <th className="p-2.5">Data/Hora</th>
                <th className="p-2.5">Usuário</th>
                <th className="p-2.5">Ação</th>
                <th className="p-2.5">Módulo</th>
                <th className="p-2.5">Entidade</th>
                <th className="p-2.5 text-right">Antes → Depois</th>
                <th className="p-2.5">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-stone-400">Nenhum registro.</td></tr>
              )}
              {rows.map((l) => (
                <tr key={l.id} className="hover:bg-stone-50 align-top">
                  <td className="p-2.5 text-stone-600 whitespace-nowrap">{l.timestamp}</td>
                  <td className="p-2.5 font-semibold text-stone-800">
                    {l.userName}
                    <span className="block text-[10px] text-stone-400 uppercase">{String(l.userRole)}</span>
                  </td>
                  <td className="p-2.5 text-stone-800">{l.action}</td>
                  <td className="p-2.5 text-stone-500">{l.module}</td>
                  <td className="p-2.5 text-stone-500">
                    {l.entityType || '—'}
                    {l.entityId && <span className="block text-[10px] text-stone-400">{l.entityId}</span>}
                  </td>
                  <td className="p-2.5 text-right text-stone-600 whitespace-nowrap">
                    {l.amountBefore != null || l.amountAfter != null ? `${fmtMoney(l.amountBefore) || '—'} → ${fmtMoney(l.amountAfter) || '—'}` : '—'}
                  </td>
                  <td className="p-2.5 text-stone-500 max-w-[280px] truncate" title={renderDetails(l.details)}>{renderDetails(l.details)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
