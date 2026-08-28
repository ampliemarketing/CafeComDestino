import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  DollarSign,
  TrendingUp,
  ShoppingBag,
  Utensils,
  Clock,
  CheckCircle2,
  Truck,
  AlertTriangle,
  Ban,
  CreditCard,
  Filter,
  ArrowUpRight,
  Flame,
  Scale,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

type Period = 'hoje' | 'ontem' | 'semana' | 'mes' | 'ano';

const brl = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// "DD/MM/YYYY HH:MM:SS" (new Date().toLocaleString('pt-BR')) -> epoch ms
const parsePtBrDateTime = (s?: string): number | null => {
  if (!s) return null;
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})(?:[,\s]+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)).getTime();
};

const getPeriodRange = (period: Period, now: Date): { start: number; end: number; label: string } => {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  switch (period) {
    case 'ontem': {
      const s = new Date(startOfToday);
      s.setDate(s.getDate() - 1);
      return { start: s.getTime(), end: startOfToday.getTime(), label: 'Ontem' };
    }
    case 'semana': {
      const s = new Date(startOfToday);
      s.setDate(s.getDate() - 6);
      return { start: s.getTime(), end: startOfTomorrow.getTime(), label: 'Últimos 7 dias' };
    }
    case 'mes': {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      const label = s.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      return { start: s.getTime(), end: startOfTomorrow.getTime(), label: label.charAt(0).toUpperCase() + label.slice(1) };
    }
    case 'ano': {
      const s = new Date(now.getFullYear(), 0, 1);
      return { start: s.getTime(), end: startOfTomorrow.getTime(), label: String(now.getFullYear()) };
    }
    case 'hoje':
    default:
      return { start: startOfToday.getTime(), end: startOfTomorrow.getTime(), label: 'Hoje' };
  }
};

// Arredonda uma lista de percentuais garantindo soma exata de 100 (maior resto).
const toRoundedPercents = (values: number[]): number[] => {
  const total = values.reduce((a, b) => a + b, 0);
  if (total <= 0) return values.map(() => 0);
  const raw = values.map((v) => (v / total) * 100);
  const floors = raw.map((r) => Math.floor(r));
  let remainder = 100 - floors.reduce((a, b) => a + b, 0);
  const byFrac = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  const out = [...floors];
  for (let k = 0; k < byFrac.length && remainder > 0; k++, remainder--) out[byFrac[k].i]++;
  return out;
};

const paymentMethodLabels: Record<string, string> = {
  pix: 'Pix',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito: 'Cartão de Débito',
  dinheiro: 'Dinheiro',
  vale_refeicao: 'Vale-refeição',
  boleto: 'Boleto',
  multiplo: 'Múltiplo',
};
const paymentMethodColors: Record<string, string> = {
  pix: '#2E8B57',
  cartao_credito: '#A67C52',
  cartao_debito: '#3B82F6',
  dinheiro: '#D98532',
  vale_refeicao: '#7C3AED',
  boleto: '#78716C',
  multiplo: '#8B5CF6',
};

export const DashboardView: React.FC = () => {
  const { companyProfile, orders, tables, products, ingredients, lossRecords, setActiveView } = useApp();
  const [period, setPeriod] = useState<Period>('hoje');

  const now = useMemo(() => new Date(), []);
  const { start: periodStart, end: periodEnd, label: periodLabel } = useMemo(
    () => getPeriodRange(period, now),
    [period, now]
  );

  // Alguns pedidos legados podem não ter timestamp. Se NENHUM tiver, o filtro por
  // data é desativado (mostra tudo) para não zerar o painel indevidamente.
  const hasTimestamps = useMemo(() => orders.some((o) => !!o.createdAtISO), [orders]);

  const orderTime = (iso?: string) => (iso ? new Date(iso).getTime() : NaN);
  const inPeriod = (iso?: string) => {
    if (!hasTimestamps) return true;
    const t = orderTime(iso);
    return !Number.isNaN(t) && t >= periodStart && t < periodEnd;
  };

  // ---- Recortes por período ----
  const periodOrders = useMemo(() => orders.filter((o) => inPeriod(o.createdAtISO)), [orders, hasTimestamps, periodStart, periodEnd]);
  const completedOrders = periodOrders.filter((o) => o.orderStatus === 'concluido');
  const canceledOrders = periodOrders.filter((o) => o.orderStatus === 'cancelado');

  // ---- Estados operacionais: sempre ao vivo (não dependem do período) ----
  const prepOrders = orders.filter((o) => o.orderStatus === 'em_preparo' || o.orderStatus === 'aceito');
  const readyOrders = orders.filter((o) => o.orderStatus === 'pronto');
  const deliveryOrders = orders.filter((o) => o.orderStatus === 'saiu_entrega');
  const pendingPaymentOrders = orders.filter((o) => o.paymentStatus === 'aguardando_pagamento');
  const openTablesCount = tables.filter((t) => t.status !== 'livre').length;

  // ---- Faturamento do período ----
  const totalPeriodRevenue = completedOrders.reduce((sum, o) => sum + o.total, 0);
  const totalOrdersCount = completedOrders.length;
  const avgTicket = totalOrdersCount > 0 ? totalPeriodRevenue / totalOrdersCount : 0;

  // ---- Faturamento do mês corrente (independente do seletor de período) ----
  const monthStart = useMemo(() => new Date(now.getFullYear(), now.getMonth(), 1).getTime(), [now]);
  const monthLabel = useMemo(() => {
    const l = now.toLocaleDateString('pt-BR', { month: 'long' });
    return l.charAt(0).toUpperCase() + l.slice(1);
  }, [now]);
  const totalMonthlyRevenue = useMemo(() => {
    return orders
      .filter((o) => o.orderStatus === 'concluido' && (!hasTimestamps || orderTime(o.createdAtISO) >= monthStart))
      .reduce((sum, o) => sum + o.total, 0);
  }, [orders, hasTimestamps, monthStart]);

  // ---- Conferência: faturamento registrado x valor dos itens vendidos ----
  const grossItemsValue = completedOrders.reduce(
    (sum, o) => sum + o.items.reduce((a, it) => a + it.unitPrice * it.quantity, 0),
    0
  );
  const totalDiscounts = completedOrders.reduce((sum, o) => sum + (o.discount || 0), 0);
  const totalDeliveryFees = completedOrders.reduce((sum, o) => sum + (o.deliveryFee || 0), 0);
  const totalUnitsSold = completedOrders.reduce(
    (sum, o) => sum + o.items.reduce((a, it) => a + it.quantity, 0),
    0
  );
  const expectedRevenue = grossItemsValue - totalDiscounts + totalDeliveryFees;
  const revenueDiff = totalPeriodRevenue - expectedRevenue;
  const revenueMatches = Math.abs(revenueDiff) < 0.01;

  // ---- Série temporal (por hora em dia único, por dia em períodos maiores) ----
  const groupByHour = period === 'hoje' || period === 'ontem';
  const salesTimeSeries = useMemo(() => {
    const buckets = completedOrders.reduce<Record<string, { label: string; sortKey: number; total: number; orders: number }>>((acc, o) => {
      const d = o.createdAtISO ? new Date(o.createdAtISO) : null;
      let label: string;
      let sortKey: number;
      if (groupByHour) {
        const h = d ? d.getHours() : parseInt((o.createdAt || '').split(':')[0], 10);
        if (Number.isNaN(h)) return acc;
        label = `${String(h).padStart(2, '0')}:00`;
        sortKey = h;
      } else {
        if (!d) return acc;
        label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        sortKey = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      }
      if (!acc[label]) acc[label] = { label, sortKey, total: 0, orders: 0 };
      acc[label].total += o.total;
      acc[label].orders += 1;
      return acc;
    }, {});
    return Object.values(buckets)
      .sort((a, b) => a.sortKey - b.sortKey)
      .map(({ label, total, orders }) => ({ hour: label, total: Math.round(total * 100) / 100, orders }));
  }, [completedOrders, groupByHour]);

  // ---- Formas de pagamento (rateia pagamentos múltiplos por método) ----
  const paymentBreakdownData = useMemo(() => {
    const totals = completedOrders.reduce<Record<string, number>>((acc, o) => {
      if (o.splitPayments && o.splitPayments.length > 0) {
        o.splitPayments.forEach((sp) => {
          acc[sp.method] = (acc[sp.method] || 0) + sp.amount;
        });
      } else {
        acc[o.paymentMethod] = (acc[o.paymentMethod] || 0) + o.total;
      }
      return acc;
    }, {});
    const entries = Object.entries(totals);
    const percents = toRoundedPercents(entries.map(([, v]) => v));
    return entries.map(([method, value], idx) => ({
      name: paymentMethodLabels[method] || method,
      value: percents[idx],
      amount: value,
      color: paymentMethodColors[method] || '#78716c',
    }));
  }, [completedOrders]);

  // ---- Produtos mais vendidos (somente com venda no período) ----
  const soldQtyByProduct = completedOrders.reduce<Record<string, number>>((acc, o) => {
    o.items.forEach((it) => {
      acc[it.productId] = (acc[it.productId] || 0) + it.quantity;
    });
    return acc;
  }, {});
  const topProductsList = [...products]
    .map((p) => ({ product: p, qty: soldQtyByProduct[p.id] || 0 }))
    .filter((x) => x.qty > 0)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 4);

  // ---- Estoque baixo (ao vivo) ----
  const lowStockIngredients = ingredients.filter((i) => i.stockQuantity <= i.minStock);

  // ---- Perdas do período (dados locais deste navegador) ----
  const periodLossRecords = lossRecords.filter((l) => {
    const t = parsePtBrDateTime(l.registeredAt);
    if (t === null) return true;
    return t >= periodStart && t < periodEnd;
  });
  const totalLossesValue = periodLossRecords.reduce((sum, l) => sum + l.costValue, 0);

  const revenueCardTitle = period === 'hoje' ? 'Faturamento do Dia' : `Faturamento · ${periodLabel}`;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header & Period Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <span>Visão Geral da Operação</span>
            <span className="text-xs font-normal text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full border">
              {companyProfile.name} Dashboard
            </span>
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            Acompanhamento das vendas, pedidos, mesas e desempenho financeiro — período: <strong className="text-stone-700">{periodLabel}</strong>.
          </p>
        </div>

        {/* Period Filter Buttons */}
        <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200 text-xs font-medium">
          <Filter className="w-3.5 h-3.5 text-stone-500 ml-2 mr-1" />
          {(['hoje', 'ontem', 'semana', 'mes', 'ano'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg capitalize transition ${
                period === p ? 'bg-amber-800 text-white shadow-sm font-semibold' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Top Main Financial KPi Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Period Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">{revenueCardTitle}</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-stone-900 mt-3">{brl(totalPeriodRevenue)}</p>
          <p className="text-xs text-stone-500 mt-2">
            {completedOrders.length === 0
              ? 'Nenhuma venda concluída no período'
              : `${completedOrders.length} venda(s) concluída(s)`}
          </p>
        </div>

        {/* Monthly Revenue (month-to-date, independent) */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Faturamento do Mês</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center font-bold">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-stone-900 mt-3">{brl(totalMonthlyRevenue)}</p>
          <p className="text-xs text-stone-500 mt-2">Mês corrente ({monthLabel}), até hoje</p>
        </div>

        {/* Total Orders & Ticket */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Qtd Pedidos</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-stone-900 mt-3">{totalOrdersCount} pedidos</p>
          <p className="text-xs text-stone-500 mt-2">Ticket Médio: <strong className="text-stone-800">{brl(avgTicket)}</strong></p>
        </div>

        {/* Open Tables & Active Salão */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Mesas Ocupadas</span>
            <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold">
              <Utensils className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-stone-900 mt-3">{openTablesCount} / {tables.length} mesas</p>
          <button
            onClick={() => setActiveView('tables')}
            className="text-xs text-amber-800 hover:underline font-semibold mt-2 flex items-center gap-1"
          >
            <span>Ver mapa do salão</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Revenue Reconciliation Card */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-sm text-stone-900 flex items-center gap-2">
              <Scale className="w-4 h-4 text-amber-600" />
              <span>Conferência de Faturamento ({periodLabel})</span>
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              O faturamento registrado bate com a quantidade e o preço dos itens vendidos?
            </p>
          </div>
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
              revenueMatches
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
          >
            {revenueMatches ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            {revenueMatches ? 'Valores conferem' : `Divergência de ${brl(Math.abs(revenueDiff))}`}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
            <p className="text-stone-500">Itens vendidos (bruto)</p>
            <p className="font-bold text-stone-900 mt-1">{brl(grossItemsValue)}</p>
            <p className="text-[10px] text-stone-500 mt-0.5">{totalUnitsSold} unidade(s)</p>
          </div>
          <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
            <p className="text-stone-500">(−) Descontos</p>
            <p className="font-bold text-rose-600 mt-1">{brl(totalDiscounts)}</p>
          </div>
          <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
            <p className="text-stone-500">(+) Taxas de entrega</p>
            <p className="font-bold text-stone-900 mt-1">{brl(totalDeliveryFees)}</p>
          </div>
          <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
            <p className="text-stone-500">(=) Esperado</p>
            <p className="font-bold text-stone-900 mt-1">{brl(expectedRevenue)}</p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
            <p className="text-emerald-700">Faturamento registrado</p>
            <p className="font-bold text-emerald-800 mt-1">{brl(totalPeriodRevenue)}</p>
          </div>
          <div className={`p-3 rounded-xl border ${revenueMatches ? 'bg-stone-50 border-stone-200' : 'bg-rose-50 border-rose-200'}`}>
            <p className={revenueMatches ? 'text-stone-500' : 'text-rose-700'}>Divergência</p>
            <p className={`font-bold mt-1 ${revenueMatches ? 'text-stone-900' : 'text-rose-700'}`}>{brl(revenueDiff)}</p>
          </div>
        </div>
        {!revenueMatches && (
          <p className="text-[11px] text-rose-600 mt-3">
            Há pedidos concluídos cujo total não corresponde à soma dos itens (menos descontos, mais entrega).
            Verifique lançamentos manuais de preço, itens cancelados em pedidos antigos ou descontos não registrados.
          </p>
        )}
      </div>

      {/* Operational Realtime Workflow Status Strip */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
        <h3 className="font-bold text-sm text-stone-900 mb-3 flex items-center gap-2">
          <Flame className="w-4 h-4 text-amber-600" />
          <span>Status da Operação em Tempo Real</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div
            onClick={() => setActiveView('kitchen')}
            className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-stone-800 cursor-pointer hover:bg-amber-100 transition"
          >
            <div className="flex items-center justify-between text-amber-800">
              <Clock className="w-4 h-4" />
              <span className="font-bold text-base">{prepOrders.length}</span>
            </div>
            <p className="text-xs font-semibold mt-1">Em Preparo</p>
          </div>

          <div
            onClick={() => setActiveView('kitchen')}
            className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-stone-800 cursor-pointer hover:bg-emerald-100 transition"
          >
            <div className="flex items-center justify-between text-emerald-800">
              <CheckCircle2 className="w-4 h-4" />
              <span className="font-bold text-base">{readyOrders.length}</span>
            </div>
            <p className="text-xs font-semibold mt-1">Prontos / Exp</p>
          </div>

          <div
            onClick={() => setActiveView('deliveries')}
            className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-stone-800 cursor-pointer hover:bg-blue-100 transition"
          >
            <div className="flex items-center justify-between text-blue-800">
              <Truck className="w-4 h-4" />
              <span className="font-bold text-base">{deliveryOrders.length}</span>
            </div>
            <p className="text-xs font-semibold mt-1">Em Entrega</p>
          </div>

          <div
            onClick={() => setActiveView('sales')}
            className="p-3 rounded-xl bg-stone-100 border border-stone-200 text-stone-800 cursor-pointer hover:bg-stone-200 transition"
          >
            <div className="flex items-center justify-between text-stone-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="font-bold text-base">{completedOrders.length}</span>
            </div>
            <p className="text-xs font-semibold mt-1">Concluídos ({periodLabel})</p>
          </div>

          <div
            onClick={() => setActiveView('sales')}
            className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-stone-800 cursor-pointer hover:bg-rose-100 transition"
          >
            <div className="flex items-center justify-between text-rose-800">
              <Ban className="w-4 h-4" />
              <span className="font-bold text-base">{canceledOrders.length}</span>
            </div>
            <p className="text-xs font-semibold mt-1">Cancelados ({periodLabel})</p>
          </div>

          <div
            onClick={() => setActiveView('caixas')}
            className="p-3 rounded-xl bg-amber-50/70 border border-amber-300 text-stone-800 cursor-pointer hover:bg-amber-100 transition"
          >
            <div className="flex items-center justify-between text-amber-900">
              <CreditCard className="w-4 h-4" />
              <span className="font-bold text-base">{pendingPaymentOrders.length}</span>
            </div>
            <p className="text-xs font-semibold mt-1">Pgto Pendente</p>
          </div>
        </div>
      </div>

      {/* Recharts Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Time Series Chart */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-stone-900 text-sm">
                Faturamento e Pedidos {groupByHour ? 'por Horário' : 'por Dia'}
              </h3>
              <p className="text-xs text-stone-500">
                {groupByHour ? 'Picos de demanda ao longo do dia' : 'Evolução das vendas no período'}
              </p>
            </div>
            <span className="text-xs font-medium text-stone-500 bg-stone-100 px-2 py-1 rounded-lg">
              {periodLabel}
            </span>
          </div>
          <div className="h-64 w-full">
            {salesTimeSeries.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-stone-400">
                Nenhuma venda concluída no período.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesTimeSeries}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E7E2DC" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#78716c' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#78716c' }} />
                  <Tooltip
                    formatter={(val: any, name: any) => [
                      name === 'orders' ? `${val} pedido(s)` : brl(Number(val)),
                      name === 'orders' ? 'Pedidos' : 'Faturamento',
                    ]}
                    contentStyle={{ backgroundColor: '#1c1917', color: '#fff', borderRadius: '12px', fontSize: '12px' }}
                  />
                  <Bar dataKey="total" fill="#A67C52" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Payment Methods Donut */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-stone-900 text-sm mb-1">Formas de Pagamento</h3>
            <p className="text-xs text-stone-500 mb-4">Distribuição do faturamento por meio ({periodLabel})</p>
            <div className="h-44 w-full relative">
              {paymentBreakdownData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-stone-400">
                  Nenhuma venda concluída no período.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentBreakdownData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {paymentBreakdownData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: any, _n: any, p: any) => [`${val}% · ${brl(p?.payload?.amount || 0)}`, 'Participação']} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <div className="space-y-1.5 text-xs pt-2 border-t border-stone-200">
            {paymentBreakdownData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-stone-600">{item.name}</span>
                </div>
                <span className="font-bold text-stone-900">{item.value}% <span className="font-normal text-stone-400">· {brl(item.amount)}</span></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row: Top Products, Low Stock Alerts, Inventory Losses */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Top Selling Products */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-stone-900 text-sm">Produtos Mais Vendidos ({periodLabel})</h3>
            <button
              onClick={() => setActiveView('products')}
              className="text-xs text-amber-800 font-semibold hover:underline"
            >
              Ver catálogo
            </button>
          </div>
          <div className="space-y-3">
            {topProductsList.length === 0 ? (
              <p className="text-xs text-stone-500 py-6 text-center">Nenhuma venda registrada no período.</p>
            ) : (
              topProductsList.map(({ product: prod, qty }, idx) => (
                <div key={prod.id} className="flex items-center justify-between p-2 rounded-xl bg-stone-50 border border-stone-200">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-stone-200 text-stone-700 font-bold text-xs flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-xs text-stone-900">{prod.name}</p>
                      <p className="text-[10px] text-stone-500">{brl(prod.price)}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    {qty} un
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-stone-900 text-sm flex items-center gap-1.5 text-amber-800">
              <AlertTriangle className="w-4 h-4" />
              <span>Estoque Baixo ({lowStockIngredients.length})</span>
            </h3>
            <button
              onClick={() => setActiveView('inventory')}
              className="text-xs text-amber-800 font-semibold hover:underline"
            >
              Comprar
            </button>
          </div>
          {lowStockIngredients.length === 0 ? (
            <p className="text-xs text-stone-500 py-6 text-center">Nenhum insumo com estoque crítico no momento.</p>
          ) : (
            <div className="space-y-2">
              {lowStockIngredients.map((ing) => (
                <div key={ing.id} className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-rose-950">{ing.name}</p>
                    <p className="text-[10px] text-rose-700">Mínimo sugerido: {ing.minStock} {ing.unit}</p>
                  </div>
                  <span className="font-bold text-rose-700 bg-rose-100 px-2 py-1 rounded-lg">
                    {ing.stockQuantity} {ing.unit}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Registered Losses & Waste */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-stone-900 text-sm">Registro de Perdas ({periodLabel})</h3>
              <button
                onClick={() => setActiveView('inventory')}
                className="text-xs text-amber-800 font-semibold hover:underline"
              >
                Lançar perda
              </button>
            </div>
            <div className="p-3 bg-stone-100 rounded-xl border border-stone-200 mb-3 flex items-center justify-between">
              <span className="text-xs text-stone-600 font-medium">Custo Total de Perdas</span>
              <span className="text-sm font-bold text-rose-600">{brl(totalLossesValue)}</span>
            </div>
            <div className="space-y-2">
              {periodLossRecords.length === 0 ? (
                <p className="text-xs text-stone-500 py-2 text-center">Nenhuma perda registrada no período.</p>
              ) : (
                periodLossRecords.slice(0, 2).map((l) => (
                  <div key={l.id} className="p-2 rounded-lg bg-stone-50 border border-stone-200 text-xs">
                    <div className="flex justify-between font-semibold text-stone-800">
                      <span>{l.ingredientName} ({l.quantity} {l.unit})</span>
                      <span className="text-rose-600">{brl(l.costValue)}</span>
                    </div>
                    <p className="text-[10px] text-stone-500 mt-0.5">Motivo: {l.reason} por {l.registeredBy}</p>
                  </div>
                ))
              )}
            </div>
          </div>
          <p className="text-[10px] text-stone-400 mt-3 pt-2 border-t text-center">
            Perdas e cortesias ainda são dados locais deste navegador
          </p>
        </div>
      </div>
    </div>
  );
};
