import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabaseClient';
import {
  BarChart3,
  Download,
  Calendar,
  DollarSign,
  TrendingDown,
  Gift,
  CreditCard,
  Loader2,
  Filter
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid
} from 'recharts';
import { hasPermission } from '../../lib/permissions';
import { buildManagementReportHtml, printManagementReportHtml } from '../../lib/printManagementReport';

type PeriodPreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth' | 'custom';

const PERIOD_LABELS: Record<PeriodPreset, string> = {
  today: 'Hoje',
  yesterday: 'Ontem',
  last7: 'Últimos 7 dias',
  last30: 'Últimos 30 dias',
  thisMonth: 'Este mês',
  lastMonth: 'Mês passado',
  custom: 'Personalizado',
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  pix: 'Pix',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito: 'Cartão de Débito',
  dinheiro: 'Dinheiro',
  boleto: 'Boleto',
  vale_refeicao: 'Vale-refeição',
  multiplo: 'Múltiplo',
  outro: 'Outro',
};

const toDateInput = (d: Date) => d.toISOString().slice(0, 10);

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };

function computeRange(preset: PeriodPreset, customFrom: string, customTo: string): { from: Date; to: Date } {
  const now = new Date();
  switch (preset) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'yesterday': {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case 'last7': {
      const from = new Date(now); from.setDate(from.getDate() - 6);
      return { from: startOfDay(from), to: endOfDay(now) };
    }
    case 'last30': {
      const from = new Date(now); from.setDate(from.getDate() - 29);
      return { from: startOfDay(from), to: endOfDay(now) };
    }
    case 'thisMonth': {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from: startOfDay(from), to: endOfDay(to) };
    }
    case 'lastMonth': {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: startOfDay(from), to: endOfDay(to) };
    }
    case 'custom':
    default: {
      const from = customFrom ? startOfDay(new Date(customFrom + 'T00:00:00')) : startOfDay(now);
      const to = customTo ? endOfDay(new Date(customTo + 'T00:00:00')) : endOfDay(now);
      return { from, to };
    }
  }
}

interface RangeOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

interface RangeOrder {
  orderNumber: number;
  channel: string;
  items: RangeOrderItem[];
  total: number;
  paymentMethod: string;
  splitPayments: { method: string; amount: number }[] | null;
  orderStatus: string;
  createdAt: string;
}

interface RangeLoss {
  costValue: number;
  reason: string;
  createdAt: string;
}

interface RangeCourtesy {
  totalRetailValue: number;
  totalCostValue: number;
  reason: string;
  createdAt: string;
}

export const ReportsView: React.FC = () => {
  const { addToast, currentUser, companyProfile, alertDialog } = useApp();
  const canExport = hasPermission(currentUser, 'relatorios.exportar');

  const [activeReportTab, setActiveReportTab] = useState<'sales' | 'losses' | 'courtesies'>('sales');

  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('thisMonth');
  const [customFrom, setCustomFrom] = useState(() => toDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [customTo, setCustomTo] = useState(() => toDateInput(new Date()));

  const [appliedRange, setAppliedRange] = useState(() => computeRange('thisMonth', '', ''));
  const [isLoading, setIsLoading] = useState(false);
  const [rangeOrders, setRangeOrders] = useState<RangeOrder[]>([]);
  const [rangeLosses, setRangeLosses] = useState<RangeLoss[]>([]);
  const [rangeCourtesies, setRangeCourtesies] = useState<RangeCourtesy[]>([]);

  // Busca direto no Supabase (não usa os arrays já carregados no contexto):
  // orders/loss_records/courtesy_records ficam limitados às linhas mais
  // recentes (500-1000) no app inteiro, o que faria um período mais antigo
  // mostrar dado incompleto sem aviso nenhum. Aqui a consulta é sempre
  // filtrada pelo período exato escolhido, então cobre qualquer intervalo.
  const runReport = async (range: { from: Date; to: Date }) => {
    setIsLoading(true);
    const fromISO = range.from.toISOString();
    const toISO = range.to.toISOString();

    const [ordersRes, lossesRes, courtesiesRes] = await Promise.all([
      supabase
        .from('orders')
        .select('order_number, channel, items, total, payment_method, split_payments, order_status, created_at')
        .gte('created_at', fromISO)
        .lte('created_at', toISO)
        .order('created_at', { ascending: true })
        .limit(20000),
      supabase
        .from('loss_records')
        .select('cost_value, reason, created_at')
        .gte('created_at', fromISO)
        .lte('created_at', toISO)
        .limit(20000),
      supabase
        .from('courtesy_records')
        .select('total_retail_value, total_cost_value, reason, created_at')
        .gte('created_at', fromISO)
        .lte('created_at', toISO)
        .limit(20000),
    ]);

    setIsLoading(false);

    if (ordersRes.error || lossesRes.error || courtesiesRes.error) {
      await alertDialog({
        title: 'Erro ao carregar relatório',
        message: ordersRes.error?.message || lossesRes.error?.message || courtesiesRes.error?.message || 'Falha desconhecida.',
      });
      return;
    }

    setRangeOrders((ordersRes.data || []).map((r: any): RangeOrder => ({
      orderNumber: r.order_number,
      channel: r.channel,
      items: Array.isArray(r.items) ? r.items : [],
      total: Number(r.total) || 0,
      paymentMethod: r.payment_method,
      splitPayments: r.split_payments || null,
      orderStatus: r.order_status,
      createdAt: r.created_at,
    })));
    setRangeLosses((lossesRes.data || []).map((r: any): RangeLoss => ({
      costValue: Number(r.cost_value) || 0,
      reason: r.reason,
      createdAt: r.created_at,
    })));
    setRangeCourtesies((courtesiesRes.data || []).map((r: any): RangeCourtesy => ({
      totalRetailValue: Number(r.total_retail_value) || 0,
      totalCostValue: Number(r.total_cost_value) || 0,
      reason: r.reason,
      createdAt: r.created_at,
    })));
  };

  useEffect(() => {
    runReport(appliedRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyPreset = (preset: PeriodPreset) => {
    setPeriodPreset(preset);
    if (preset === 'custom') return; // espera o usuário escolher as datas e clicar em Aplicar
    const range = computeRange(preset, customFrom, customTo);
    setAppliedRange(range);
    runReport(range);
  };

  const applyCustomRange = () => {
    if (!customFrom || !customTo) {
      addToast('error', 'Período incompleto', 'Escolha as duas datas (de/até).');
      return;
    }
    if (customFrom > customTo) {
      addToast('error', 'Período inválido', 'A data inicial não pode ser depois da data final.');
      return;
    }
    const range = computeRange('custom', customFrom, customTo);
    setAppliedRange(range);
    runReport(range);
  };

  const periodLabel = `${appliedRange.from.toLocaleDateString('pt-BR')} a ${appliedRange.to.toLocaleDateString('pt-BR')}`;

  // Pedidos cancelados não representam faturamento real — mesmo critério usado
  // no fechamento de caixa (ver shiftStats.ts: orderStatus !== 'cancelado').
  const validOrders = useMemo(() => rangeOrders.filter((o) => o.orderStatus !== 'cancelado'), [rangeOrders]);

  const totalSalesCount = validOrders.length;
  const totalRevenue = validOrders.reduce((acc, o) => acc + o.total, 0);
  const averageTicket = totalSalesCount > 0 ? totalRevenue / totalSalesCount : 0;

  const totalLossCost = rangeLosses.reduce((acc, l) => acc + l.costValue, 0);
  const lossCount = rangeLosses.length;

  const totalCourtesyRetail = rangeCourtesies.reduce((acc, c) => acc + c.totalRetailValue, 0);
  const totalCourtesyCost = rangeCourtesies.reduce((acc, c) => acc + c.totalCostValue, 0);
  const courtesyCount = rangeCourtesies.length;

  const salesByChannel = useMemo(() => ([
    { name: 'PDV Balcão', value: validOrders.filter((o) => o.channel === 'pdv').reduce((acc, o) => acc + o.total, 0) },
    { name: 'Garçom Salão', value: validOrders.filter((o) => o.channel === 'garcom').reduce((acc, o) => acc + o.total, 0) },
    { name: 'Online Menu', value: validOrders.filter((o) => o.channel === 'online').reduce((acc, o) => acc + o.total, 0) },
  ]), [validOrders]);

  // Vendas por forma de pagamento — pedidos com pagamento "multiplo" têm o
  // valor distribuído por forma real (splitPayments), em vez de virar um
  // balde único de "múltiplo" sem informação nenhuma.
  const salesByPaymentMethod = useMemo(() => {
    const map = new Map<string, number>();
    validOrders.forEach((o) => {
      if (o.paymentMethod === 'multiplo' && o.splitPayments && o.splitPayments.length > 0) {
        o.splitPayments.forEach((sp) => {
          map.set(sp.method, (map.get(sp.method) || 0) + (Number(sp.amount) || 0));
        });
      } else {
        map.set(o.paymentMethod, (map.get(o.paymentMethod) || 0) + o.total);
      }
    });
    return Array.from(map.entries())
      .map(([method, value]) => ({ name: PAYMENT_METHOD_LABEL[method] || method, value }))
      .sort((a, b) => b.value - a.value);
  }, [validOrders]);

  const dailyRevenue = useMemo(() => {
    const map = new Map<string, { date: string; revenue: number; count: number }>();
    validOrders.forEach((o) => {
      const day = new Date(o.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const entry = map.get(day) || { date: day, revenue: 0, count: 0 };
      entry.revenue += o.total;
      entry.count += 1;
      map.set(day, entry);
    });
    return Array.from(map.values());
  }, [validOrders]);

  const topProducts = useMemo(() => {
    const productSales = new Map<string, { name: string; quantity: number; revenue: number }>();
    validOrders.forEach((o) => {
      o.items.forEach((it) => {
        const entry = productSales.get(it.productId) || { name: it.productName, quantity: 0, revenue: 0 };
        entry.quantity += it.quantity;
        entry.revenue += it.quantity * it.unitPrice;
        productSales.set(it.productId, entry);
      });
    });
    return Array.from(productSales.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [validOrders]);

  const lossByReasonData = useMemo(() => {
    const map: Record<string, number> = {};
    rangeLosses.forEach((l) => {
      const key = l.reason.replace('_', ' ').toUpperCase();
      map[key] = (map[key] || 0) + l.costValue;
    });
    return Object.keys(map).map((reason) => ({ name: reason, value: map[reason] })).sort((a, b) => b.value - a.value);
  }, [rangeLosses]);

  const courtesyByReasonData = useMemo(() => {
    const map: Record<string, number> = {};
    rangeCourtesies.forEach((c) => {
      const key = c.reason.replace('_', ' ').toUpperCase();
      map[key] = (map[key] || 0) + c.totalRetailValue;
    });
    return Object.keys(map).map((reason) => ({ name: reason, value: map[reason] })).sort((a, b) => b.value - a.value);
  }, [rangeCourtesies]);

  const COLORS = ['#A67C52', '#3D2A1D', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  const handleExport = () => {
    const html = buildManagementReportHtml(
      {
        generatedAt: new Date().toLocaleString('pt-BR'),
        period: periodLabel,
        sales: {
          totalRevenue, totalCount: totalSalesCount, averageTicket,
          byChannel: salesByChannel, byPaymentMethod: salesByPaymentMethod,
          topProducts, daily: dailyRevenue,
        },
        losses: { totalCost: totalLossCost, count: lossCount, byReason: lossByReasonData },
        courtesies: {
          totalRetailValue: totalCourtesyRetail,
          totalCostValue: totalCourtesyCost,
          count: courtesyCount,
          byReason: courtesyByReasonData,
        },
      },
      companyProfile,
    );
    printManagementReportHtml(html, (msg) => addToast('error', 'Falha ao exportar', msg));
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="bg-stone-900 text-stone-100 p-5 rounded-2xl border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-800 text-white font-bold flex items-center justify-center shadow">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Relatórios de Desempenho & Módulo Gerencial</h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Acompanhamento de vendas, relatórios analíticos de perdas de estoque e cortesias concedidas.
            </p>
          </div>
        </div>

        {canExport && (
        <button
          onClick={handleExport}
          disabled={isLoading}
          className="bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 px-4 py-2.5 rounded-xl font-bold text-xs shadow flex items-center gap-2 disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          <span>Exportar Relatório (PDF)</span>
        </button>
        )}
      </div>

      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-stone-500 uppercase tracking-wider">
          <Filter className="w-3.5 h-3.5" /> Período do Relatório
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(PERIOD_LABELS) as PeriodPreset[]).map((preset) => (
            <button
              key={preset}
              onClick={() => applyPreset(preset)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                periodPreset === preset ? 'bg-amber-800 text-white shadow' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              {PERIOD_LABELS[preset]}
            </button>
          ))}
        </div>

        {periodPreset === 'custom' && (
          <div className="flex flex-wrap items-end gap-3 text-xs pt-1">
            <label className="flex flex-col gap-1">
              <span className="font-semibold text-stone-600">De</span>
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="border rounded-lg p-2" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-semibold text-stone-600">Até</span>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="border rounded-lg p-2" />
            </label>
            <button
              onClick={applyCustomRange}
              disabled={isLoading}
              className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-lg text-xs font-bold shadow disabled:opacity-50"
            >
              Aplicar Filtro
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 text-[11px] text-stone-500 pt-1 border-t border-stone-100">
          <Calendar className="w-3.5 h-3.5" />
          <span>
            Exibindo período: <strong className="text-stone-700">{periodLabel}</strong>
          </span>
          {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700 ml-1" />}
        </div>
      </div>

      <div className="flex gap-2 bg-stone-100 p-1.5 rounded-2xl border border-stone-200 text-xs font-bold">
        <button
          onClick={() => setActiveReportTab('sales')}
          className={`flex-1 py-3 rounded-xl transition flex items-center justify-center gap-2 ${
            activeReportTab === 'sales' ? 'bg-amber-800 text-white shadow' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Vendas & Faturamento</span>
        </button>

        <button
          onClick={() => setActiveReportTab('losses')}
          className={`flex-1 py-3 rounded-xl transition flex items-center justify-center gap-2 ${
            activeReportTab === 'losses' ? 'bg-amber-800 text-white shadow' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <TrendingDown className="w-4 h-4" />
          <span>Perdas de Estoque (Custo: R$ {totalLossCost.toFixed(2)})</span>
        </button>

        <button
          onClick={() => setActiveReportTab('courtesies')}
          className={`flex-1 py-3 rounded-xl transition flex items-center justify-center gap-2 ${
            activeReportTab === 'courtesies' ? 'bg-amber-800 text-white shadow' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <Gift className="w-4 h-4" />
          <span>Cortesias Concedidas (Valor: R$ {totalCourtesyRetail.toFixed(2)})</span>
        </button>
      </div>

      {activeReportTab === 'sales' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Faturamento Bruto</span>
              <p className="text-2xl font-bold text-emerald-700 mt-2">R$ {totalRevenue.toFixed(2)}</p>
              <p className="text-[10px] text-stone-400 mt-1">Total de vendas e comandas concluídas no período</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Total de Pedidos</span>
              <p className="text-2xl font-bold text-amber-800 mt-2">{totalSalesCount}</p>
              <p className="text-[10px] text-stone-400 mt-1">Comandas e vendas registradas no período</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Ticket Médio</span>
              <p className="text-2xl font-bold text-stone-900 mt-2">R$ {averageTicket.toFixed(2)}</p>
              <p className="text-[10px] text-stone-400 mt-1">Gasto médio por cliente/mesa</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-3">
            <h3 className="font-bold text-stone-900 text-sm">Faturamento por Dia</h3>
            {dailyRevenue.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                    <XAxis dataKey="date" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip formatter={(value: any) => `R$ ${Number(value).toFixed(2)}`} />
                    <Line type="monotone" dataKey="revenue" stroke="#A67C52" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-xs text-stone-400 italic">Sem vendas no período selecionado.</p>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-3">
              <h3 className="font-bold text-stone-900 text-sm">Vendas por Canal de Atendimento</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={salesByChannel}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {salesByChannel.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => `R$ ${Number(value).toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-3">
              <h3 className="font-bold text-stone-900 text-sm flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-amber-800" />
                Vendas por Forma de Pagamento
              </h3>
              <div className="space-y-2">
                {salesByPaymentMethod.length === 0 && (
                  <p className="text-xs text-stone-400 italic">Sem vendas no período selecionado.</p>
                )}
                {salesByPaymentMethod.map((m, idx) => (
                  <div key={m.name} className="p-3 bg-stone-50 rounded-xl border flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[idx % COLORS.length] }} />
                      <p className="font-bold text-stone-900">{m.name}</p>
                    </div>
                    <span className="font-bold text-amber-900">R$ {m.value.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-3">
            <h3 className="font-bold text-stone-900 text-sm">Produtos Mais Vendidos (por Faturamento)</h3>
            <div className="space-y-2">
              {topProducts.length === 0 && (
                <p className="text-xs text-stone-400 italic">Sem itens vendidos registrados no período.</p>
              )}
              {topProducts.map((p, idx) => (
                <div key={p.name + idx} className="p-3 bg-stone-50 rounded-xl border flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-amber-800 text-white font-bold flex items-center justify-center text-[10px]">
                      #{idx + 1}
                    </span>
                    <div>
                      <p className="font-bold text-stone-900">{p.name}</p>
                      <p className="text-[10px] text-stone-500">{p.quantity} unid. vendidas</p>
                    </div>
                  </div>
                  <span className="font-bold text-amber-900">R$ {p.revenue.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeReportTab === 'losses' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider block">Custo Total de Perdas</span>
              <p className="text-2xl font-bold text-rose-700 mt-2">R$ {totalLossCost.toFixed(2)}</p>
              <p className="text-[10px] text-stone-400 mt-1">Impacto financeiro direto no custo do estoque no período</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider block">Total de Ocorrências</span>
              <p className="text-2xl font-bold text-stone-900 mt-2">{lossCount} registros</p>
              <p className="text-[10px] text-stone-400 mt-1">Ocorrências de descartes/avarias no período</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider block">Maior Causa de Perda</span>
              <p className="text-base font-bold text-amber-900 mt-2 uppercase">
                {lossByReasonData[0]?.name || '—'}
              </p>
              <p className="text-[10px] text-stone-400 mt-1">Identificação para controle preventivo</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-4">
            <h3 className="font-bold text-stone-900 text-sm">Análise de Perdas por Motivo (Custo R$)</h3>
            {lossByReasonData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={lossByReasonData}>
                    <XAxis dataKey="name" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip formatter={(val: any) => `R$ ${Number(val).toFixed(2)}`} />
                    <Bar dataKey="value" fill="#EF4444" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-xs text-stone-400 italic">Sem registros no período selecionado.</p>
            )}
          </div>
        </div>
      )}

      {activeReportTab === 'courtesies' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-xs font-semibold text-amber-900 uppercase tracking-wider block">Valor de Venda Concedido</span>
              <p className="text-2xl font-bold text-amber-900 mt-2">R$ {totalCourtesyRetail.toFixed(2)}</p>
              <p className="text-[10px] text-stone-400 mt-1">Total de venda oferecido gratuitamente ao cliente no período</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider block">Custo Real de Produção</span>
              <p className="text-2xl font-bold text-stone-800 mt-2">R$ {totalCourtesyCost.toFixed(2)}</p>
              <p className="text-[10px] text-stone-400 mt-1">Custo interno de fabricação das cortesias</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider block">Cortesias Concedidas</span>
              <p className="text-2xl font-bold text-stone-900 mt-2">{courtesyCount} lançamentos</p>
              <p className="text-[10px] text-stone-400 mt-1">Autorizações registradas pela gerência no período</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-4">
            <h3 className="font-bold text-stone-900 text-sm">Distribuição de Cortesias por Motivo</h3>
            {courtesyByReasonData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={courtesyByReasonData}>
                    <XAxis dataKey="name" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip formatter={(val: any) => `R$ ${Number(val).toFixed(2)}`} />
                    <Bar dataKey="value" fill="#A67C52" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-xs text-stone-400 italic">Sem registros de cortesia no período selecionado.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
