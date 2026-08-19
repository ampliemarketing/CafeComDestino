import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  DollarSign, 
  TrendingUp, 
  ShoppingBag, 
  Receipt, 
  Utensils, 
  Clock, 
  CheckCircle2, 
  Truck, 
  AlertTriangle, 
  Ban, 
  CreditCard, 
  Boxes, 
  Filter, 
  ArrowUpRight, 
  ChevronRight,
  Flame
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
  LineChart, 
  Line 
} from 'recharts';

export const DashboardView: React.FC = () => {
  const { companyProfile, orders, tables, products, ingredients, lossRecords, setActiveView } = useApp();
  const [period, setPeriod] = useState<'hoje' | 'ontem' | 'semana' | 'mes' | 'ano'>('hoje');

  // Calculations
  const completedOrders = orders.filter((o) => o.orderStatus === 'concluido');
  const canceledOrders = orders.filter((o) => o.orderStatus === 'cancelado');
  const prepOrders = orders.filter((o) => o.orderStatus === 'em_preparo' || o.orderStatus === 'aceito');
  const readyOrders = orders.filter((o) => o.orderStatus === 'pronto');
  const deliveryOrders = orders.filter((o) => o.orderStatus === 'saiu_entrega');
  const pendingPaymentOrders = orders.filter((o) => o.paymentStatus === 'aguardando_pagamento');

  const openTablesCount = tables.filter((t) => t.status !== 'livre').length;

  const totalDailyRevenue = completedOrders.reduce((sum, o) => sum + o.total, 0);
  const totalMonthlyRevenue = totalDailyRevenue;
  const totalOrdersCount = completedOrders.length;
  const avgTicket = totalOrdersCount > 0 ? totalDailyRevenue / totalOrdersCount : 0;

  // Low stock check
  const lowStockIngredients = ingredients.filter((i) => i.stockQuantity <= i.minStock);

  // Losses sum
  const totalLossesValue = lossRecords.reduce((sum, l) => sum + l.costValue, 0);

  // Hourly sales, derived from real completed orders (createdAt is stored as "HH:MM")
  const hourlySalesData = Object.entries(
    completedOrders.reduce<Record<string, { total: number; orders: number }>>((acc, o) => {
      const hour = (o.createdAt || '').split(':')[0];
      if (!hour) return acc;
      const key = `${hour}:00`;
      if (!acc[key]) acc[key] = { total: 0, orders: 0 };
      acc[key].total += o.total;
      acc[key].orders += 1;
      return acc;
    }, {})
  )
    .map(([hour, v]) => ({ hour, ...v }))
    .sort((a, b) => a.hour.localeCompare(b.hour));

  // Payment method breakdown, derived from real completed orders
  const paymentMethodLabels: Record<string, string> = {
    pix: 'Pix',
    cartao_credito: 'Cartão de Crédito',
    cartao_debito: 'Cartão de Débito',
    dinheiro: 'Dinheiro',
    multiplo: 'Múltiplo',
  };
  const paymentMethodColors: Record<string, string> = {
    pix: '#2E8B57',
    cartao_credito: '#A67C52',
    cartao_debito: '#3B82F6',
    dinheiro: '#D98532',
    multiplo: '#8B5CF6',
  };
  const paymentBreakdownData = Object.entries(
    completedOrders.reduce<Record<string, number>>((acc, o) => {
      acc[o.paymentMethod] = (acc[o.paymentMethod] || 0) + o.total;
      return acc;
    }, {})
  ).map(([method, total]) => ({
    name: paymentMethodLabels[method] || method,
    value: totalDailyRevenue > 0 ? Math.round((total / totalDailyRevenue) * 100) : 0,
    color: paymentMethodColors[method] || '#78716c',
  }));

  // Top selling products, derived from real completed orders
  const soldQtyByProduct = completedOrders.reduce<Record<string, number>>((acc, o) => {
    o.items.forEach((it) => {
      acc[it.productId] = (acc[it.productId] || 0) + it.quantity;
    });
    return acc;
  }, {});
  const topProductsList = [...products]
    .sort((a, b) => (soldQtyByProduct[b.id] || 0) - (soldQtyByProduct[a.id] || 0))
    .slice(0, 4);

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
            Acompanhamento em tempo real das vendas, pedidos, mesas e desempenho financeiro.
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
        {/* Daily Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Faturamento do Dia</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-stone-900 mt-3">
            R$ {totalDailyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-stone-500 mt-2">{completedOrders.length} venda(s) concluída(s)</p>
        </div>

        {/* Monthly Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Faturamento do Mês</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center font-bold">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-stone-900 mt-3">
            R$ {totalMonthlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-stone-500 mt-2">Total de todas as vendas registradas</p>
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
          <p className="text-xs text-stone-500 mt-2">Ticket Médio: <strong className="text-stone-800">R$ {avgTicket.toFixed(2)}</strong></p>
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
            <p className="text-xs font-semibold mt-1">Concluídos</p>
          </div>

          <div 
            onClick={() => setActiveView('sales')}
            className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-stone-800 cursor-pointer hover:bg-rose-100 transition"
          >
            <div className="flex items-center justify-between text-rose-800">
              <Ban className="w-4 h-4" />
              <span className="font-bold text-base">{canceledOrders.length}</span>
            </div>
            <p className="text-xs font-semibold mt-1">Cancelados</p>
          </div>

          <div 
            onClick={() => setActiveView('cashier')}
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
        {/* Hourly Sales Chart */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-stone-900 text-sm">Faturamento e Pedidos por Horário</h3>
              <p className="text-xs text-stone-500">Picos de demanda ao longo do dia</p>
            </div>
            <span className="text-xs font-medium text-stone-500 bg-stone-100 px-2 py-1 rounded-lg">
              Hoje
            </span>
          </div>
          <div className="h-64 w-full">
            {hourlySalesData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-stone-400">
                Nenhuma venda concluída ainda.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlySalesData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E7E2DC" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#78716c' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#78716c' }} />
                  <Tooltip
                    formatter={(val: any) => [`R$ ${val}`, 'Vendas']}
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
            <p className="text-xs text-stone-500 mb-4">Distribuição do faturamento por meio</p>
            <div className="h-44 w-full relative">
              {paymentBreakdownData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-stone-400">
                  Nenhuma venda concluída ainda.
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
                    <Tooltip formatter={(val: any) => [`${val}%`, 'Participação']} />
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
                <span className="font-bold text-stone-900">{item.value}%</span>
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
            <h3 className="font-bold text-stone-900 text-sm">Produtos Mais Vendidos</h3>
            <button 
              onClick={() => setActiveView('products')} 
              className="text-xs text-amber-800 font-semibold hover:underline"
            >
              Ver catálogo
            </button>
          </div>
          <div className="space-y-3">
            {topProductsList.length === 0 ? (
              <p className="text-xs text-stone-500 py-6 text-center">Nenhum produto cadastrado ainda.</p>
            ) : (
              topProductsList.map((prod, idx) => (
                <div key={prod.id} className="flex items-center justify-between p-2 rounded-xl bg-stone-50 border border-stone-200">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-stone-200 text-stone-700 font-bold text-xs flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-xs text-stone-900">{prod.name}</p>
                      <p className="text-[10px] text-stone-500">R$ {prod.price.toFixed(2)}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    {soldQtyByProduct[prod.id] || 0} un
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
              <h3 className="font-bold text-stone-900 text-sm">Registro de Perdas</h3>
              <button 
                onClick={() => setActiveView('inventory')} 
                className="text-xs text-amber-800 font-semibold hover:underline"
              >
                Lançar perda
              </button>
            </div>
            <div className="p-3 bg-stone-100 rounded-xl border border-stone-200 mb-3 flex items-center justify-between">
              <span className="text-xs text-stone-600 font-medium">Custo Total de Perdas</span>
              <span className="text-sm font-bold text-rose-600">R$ {totalLossesValue.toFixed(2)}</span>
            </div>
            <div className="space-y-2">
              {lossRecords.slice(0, 2).map((l) => (
                <div key={l.id} className="p-2 rounded-lg bg-stone-50 border border-stone-200 text-xs">
                  <div className="flex justify-between font-semibold text-stone-800">
                    <span>{l.ingredientName} ({l.quantity} {l.unit})</span>
                    <span className="text-rose-600">R$ {l.costValue.toFixed(2)}</span>
                  </div>
                  <p className="text-[10px] text-stone-500 mt-0.5">Motivo: {l.reason} por {l.registeredBy}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-stone-400 mt-3 pt-2 border-t text-center">
            {companyProfile.name} - Controle Integrado de Desperdício
          </p>
        </div>
      </div>
    </div>
  );
};
