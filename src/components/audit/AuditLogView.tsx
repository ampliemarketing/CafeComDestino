import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabaseClient';
import { ShieldCheck, Filter, Search, Loader2, Calendar } from 'lucide-react';
import { AuditLog } from '../../types';

const PAYMENT_LABEL: Record<string, string> = {
  pix: 'Pix',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito: 'Cartão de Débito',
  dinheiro: 'Dinheiro',
  boleto: 'Boleto',
  vale_refeicao: 'Vale-refeição',
  multiplo: 'Múltiplo',
  outro: 'Outro',
};

const brl = (v?: number | null) => (v == null ? null : `R$ ${Number(v).toFixed(2)}`);

// Traduz o "details" (jsonb cru vindo das RPCs do servidor) numa frase única
// em português, uma por tipo de ação conhecida. Ações lançadas pelo cliente
// (logAudit) já chegam com details como string simples e passam direto.
// Ação não reconhecida cai num fallback "chave: valor" — nunca some a
// informação, só fica menos bonito até alguém adicionar o caso aqui.
function describeAuditLog(log: AuditLog): string {
  if (typeof log.details === 'string') return log.details || '—';

  const d = (log.details && typeof log.details === 'object' ? log.details : {}) as Record<string, any>;
  const before = log.amountBefore;
  const after = log.amountAfter;
  const action = log.action;

  if (action === 'Cancelamento de Item de Comanda') {
    return `Removeu ${d.quantity ?? ''}x ${d.productName ?? 'item'} da comanda — Mesa ${d.tableNumber ?? '?'}. ` +
      `Motivo informado: "${d.reason ?? '—'}". Subtotal da comanda passou a ${brl(after) ?? '—'}.`;
  }
  if (action === 'Lançamento de Item na Comanda') {
    return `Lançou ${d.lines ?? ''} item(ns) na comanda — Mesa ${d.tableNumber ?? '?'}. Novo subtotal: ${brl(after) ?? '—'}.`;
  }
  if (action === 'Adiantamento Parcial de Comanda') {
    const extras: string[] = [];
    if (d.serviceFeePortion) extras.push(`${brl(d.serviceFeePortion)} de taxa de serviço`);
    if (d.couvertPortion) extras.push(`${brl(d.couvertPortion)} de couvert`);
    const extrasTxt = extras.length ? ` (incluindo ${extras.join(' e ')})` : '';
    return `Recebeu adiantamento de ${brl(after) ?? '—'}${extrasTxt} — Mesa ${d.tableNumber ?? '?'}${d.personName ? ` (${d.personName})` : ''}.`;
  }
  if (action === 'Estorno de Adiantamento') {
    return `Estornou adiantamento de ${brl(before) ?? '—'}. Motivo informado: "${d.reason ?? '—'}".`;
  }
  if (action === 'Transferência de Comanda') {
    return `Transferiu a comanda de ${d.personName ?? '—'} da Mesa ${d.fromTable ?? '?'} para a Mesa ${d.toTable ?? '?'}.`;
  }
  if (action === 'Ajuste de Quantidade de Couvert') {
    return `Ajustou o couvert para ${d.couvertQty ?? after ?? '?'} pessoa(s) — Mesa ${d.tableNumber ?? '?'}${d.personName ? ` (${d.personName})` : ''}.`;
  }
  if (action === 'Remoção de Taxa de Serviço' || action === 'Remoção de Couvert') {
    const what = action.includes('Couvert') ? 'o couvert' : 'a taxa de serviço';
    return `Removeu ${what} da comanda — Mesa ${d.tableNumber ?? '?'}${d.personName ? ` (${d.personName})` : ''}${d.reason ? `. Motivo: "${d.reason}"` : ''}.`;
  }
  if (action === 'Reativação de Taxa de Serviço' || action === 'Reativação de Couvert') {
    const what = action.includes('Couvert') ? 'o couvert' : 'a taxa de serviço';
    return `Reativou ${what} da comanda — Mesa ${d.tableNumber ?? '?'}${d.personName ? ` (${d.personName})` : ''}.`;
  }
  if (action === 'Abertura de Caixa') {
    return `Abriu o caixa com fundo inicial de ${brl(d.initialFloat ?? after) ?? '—'}.`;
  }
  if (action === 'Fechamento de Caixa') {
    return `Fechou o caixa — esperado ${brl(before) ?? '—'}, conferido ${brl(after) ?? '—'}` +
      `${d.difference != null ? ` (diferença de ${brl(d.difference)})` : ''}.`;
  }
  if (action === 'Reabertura de Caixa') {
    return `Reabriu o caixa${d.orderId ? ` para permitir o estorno do pedido ${d.orderId}` : ''}. Motivo: ${d.motivo ?? '—'}.`;
  }
  if (action === 'Estorno de Venda') {
    return `Estornou a venda de ${brl(before) ?? '—'}${d.shiftReopened ? ' (precisou reabrir o caixa para isso)' : ''}. ` +
      `Motivo informado: "${d.reason ?? '—'}".`;
  }
  if (action === 'Venda PDV' || action === 'Venda Online') {
    return `Registrou o pedido #${d.orderNumber ?? '?'} — total ${brl(after) ?? '—'}, ` +
      `pagamento em ${PAYMENT_LABEL[d.paymentMethod] || d.paymentMethod || '—'}.`;
  }
  if (action === 'Desconto acima do limite') {
    return `Aplicou desconto de ${d.percent ?? '?'}% — acima do limite de ${d.limit ?? '?'}% do cargo. ` +
      `Motivo informado: "${d.reason ?? '—'}".`;
  }
  if (action === 'Despesa em Dinheiro') {
    return `Lançou despesa de ${brl(after) ?? '—'} — ${d.description ?? '—'}.`;
  }
  if (action.startsWith('Movimentação de Caixa')) {
    return `${action.includes('sangria') ? 'Retirou' : 'Adicionou'} ${brl(after) ?? '—'} do caixa` +
      `${d.name ? ` — ${d.name}` : ''}${d.reason ? `. Motivo: "${d.reason}"` : ''}.`;
  }

  // Fallback genérico para qualquer ação ainda não coberta acima — nunca
  // esconde o dado bruto, só não fica com a frase pronta.
  const parts = Object.entries(d)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k}: ${v}`);
  return parts.length > 0 ? parts.join(' • ') : '—';
}

const mapRangeRow = (row: any): AuditLog => ({
  id: row.id,
  userName: row.actor_name || 'Sistema',
  userRole: row.actor_role || '',
  action: row.action,
  module: row.module || '',
  timestamp: row.created_at ? new Date(row.created_at).toLocaleString('pt-BR') : '',
  details: row.details && typeof row.details === 'object' && 'text' in row.details ? row.details.text : row.details,
  entityType: row.entity_type || undefined,
  entityId: row.entity_id || undefined,
  amountBefore: row.amount_before ?? undefined,
  amountAfter: row.amount_after ?? undefined,
});

export const AuditLogView: React.FC = () => {
  const { auditLogs, addToast } = useApp();
  const [actor, setActor] = useState('all');
  const [action, setAction] = useState('all');
  const [search, setSearch] = useState('');

  // Busca por período: vai direto no servidor em vez de depender só das 300
  // linhas mais recentes já carregadas — importante pra achar um evento
  // específico (ex: "quem removeu esse item?") que pode ter acontecido antes
  // do que está carregado por padrão.
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [rangeLogs, setRangeLogs] = useState<AuditLog[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const runRangeSearch = async () => {
    setIsSearching(true);
    let q = supabase.from('audit_log').select('*').order('seq', { ascending: false }).limit(5000);
    if (fromDate) q = q.gte('created_at', fromDate + 'T00:00:00');
    if (toDate) q = q.lte('created_at', toDate + 'T23:59:59.999');
    const { data, error } = await q;
    setIsSearching(false);
    if (error) {
      addToast('error', 'Erro ao buscar auditoria', error.message);
      return;
    }
    setRangeLogs((data || []).map(mapRangeRow));
  };

  const clearRangeSearch = () => {
    setFromDate('');
    setToDate('');
    setRangeLogs(null);
  };

  const sourceLogs = rangeLogs ?? auditLogs;

  const actors = useMemo(() => Array.from(new Set(sourceLogs.map((l) => l.userName))).sort(), [sourceLogs]);
  const actions = useMemo(() => Array.from(new Set(sourceLogs.map((l) => l.action))).sort(), [sourceLogs]);

  const rows = useMemo(() => {
    let list = sourceLogs.map((l) => ({ ...l, description: describeAuditLog(l) }));
    if (actor !== 'all') list = list.filter((l) => l.userName === actor);
    if (action !== 'all') list = list.filter((l) => l.action === action);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((l) =>
        l.action.toLowerCase().includes(q) ||
        (l.module || '').toLowerCase().includes(q) ||
        (l.entityId || '').toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q)
      );
    }
    return list;
  }, [sourceLogs, actor, action, search]);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5 min-h-screen">
      <div className="bg-stone-900 text-stone-100 p-5 rounded-2xl border border-stone-800 flex items-center gap-4 shadow-md">
        <div className="w-12 h-12 rounded-2xl bg-amber-800 text-white flex items-center justify-center shrink-0">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-lg font-bold">Auditoria</h1>
          <p className="text-xs text-stone-400">
            Trilha imutável de quem fez o quê e quando, registrada no servidor no exato momento da ação.
          </p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-stone-500 uppercase tracking-wider">
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
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ação, módulo, descrição..." className="border rounded-lg p-2" />
          </label>
        </div>

        <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-stone-100">
          <div className="flex items-center gap-1.5 text-xs font-bold text-stone-500 uppercase tracking-wider">
            <Calendar className="w-3.5 h-3.5" /> Buscar por período
          </div>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-semibold text-stone-600">De</span>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="border rounded-lg p-2" />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-semibold text-stone-600">Até</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="border rounded-lg p-2" />
          </label>
          <button
            onClick={runRangeSearch}
            disabled={isSearching}
            className="flex items-center gap-1.5 bg-stone-900 hover:bg-stone-800 text-white px-4 py-2 rounded-xl text-xs font-bold shadow disabled:opacity-50"
          >
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {isSearching ? 'Buscando…' : 'Buscar no período'}
          </button>
          {rangeLogs && (
            <button onClick={clearRangeSearch} className="text-xs font-semibold text-stone-500 hover:text-stone-800 underline">
              Voltar para os 300 mais recentes
            </button>
          )}
        </div>
        <p className="text-[10px] text-stone-400">
          {rangeLogs
            ? `Mostrando ${rangeLogs.length} registro(s) do período buscado.`
            : 'Mostrando os 300 registros mais recentes. Se o que você procura for mais antigo, use "Buscar por período" acima.'}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-xs text-left">
            <thead className="bg-stone-100 text-stone-600 uppercase font-bold border-b sticky top-0">
              <tr>
                <th className="p-2.5 whitespace-nowrap">Data/Hora</th>
                <th className="p-2.5">Usuário</th>
                <th className="p-2.5">Ação</th>
                <th className="p-2.5">O que aconteceu</th>
                <th className="p-2.5">Módulo</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-stone-400">Nenhum registro para os filtros selecionados.</td></tr>
              )}
              {rows.map((l) => (
                <tr key={l.id} className="hover:bg-stone-50 align-top">
                  <td className="p-2.5 text-stone-600 whitespace-nowrap">{l.timestamp}</td>
                  <td className="p-2.5 font-semibold text-stone-800 whitespace-nowrap">
                    {l.userName}
                    <span className="block text-[10px] text-stone-400 uppercase">{String(l.userRole)}</span>
                  </td>
                  <td className="p-2.5 text-stone-700 font-semibold whitespace-nowrap">{l.action}</td>
                  <td className="p-2.5 text-stone-700 min-w-[280px]">{l.description}</td>
                  <td className="p-2.5 text-stone-500 whitespace-nowrap">{l.module}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
