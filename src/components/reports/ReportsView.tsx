import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  BarChart3, 
  TrendingUp, 
  PieChart as PieChartIcon, 
  Download, 
  Printer, 
  Calendar, 
  Sparkles,
  Award,
  DollarSign,
  TrendingDown,
  Gift,
  FileText
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';

export const ReportsView: React.FC = () => {
  const { orders, products, lossRecords, courtesyRecords, addToast } = useApp();

  const [activeReportTab, setActiveReportTab] = useState<'sales' | 'losses' | 'courtesies'>('sales');

  const totalSalesCount = orders.length;
  const totalRevenue = orders.reduce((acc, o) => acc + o.total, 0);
  const averageTicket = totalSalesCount > 0 ? totalRevenue / totalSalesCount : 0;

  // Losses metrics
  const totalLossCost = lossRecords.reduce((acc, l) => acc + l.costValue, 0);
  const lossCount = lossRecords.length;

  // Courtesy metrics
  const totalCourtesyRetail = courtesyRecords.reduce((acc, c) => acc + c.totalRetailValue, 0);
  const totalCourtesyCost = courtesyRecords.reduce((acc, c) => acc + c.totalCostValue, 0);
  const courtesyCount = courtesyRecords.length;

  // Sales Chart data
  const salesByChannel = [
    { name: 'PDV Balcão', value: orders.filter((o) => o.channel === 'pdv').reduce((acc, o) => acc + o.total, 0) },
    { name: 'Garçom Salão', value: orders.filter((o) => o.channel === 'garcom').reduce((acc, o) => acc + o.total, 0) },
    { name: 'Online Menu', value: orders.filter((o) => o.channel === 'online').reduce((acc, o) => acc + o.total, 0) },
  ];

  // Losses by Reason chart data
  const lossByReasonMap: Record<string, number> = {};
  lossRecords.forEach((l) => {
    const key = l.reason.replace('_', ' ').toUpperCase();
    lossByReasonMap[key] = (lossByReasonMap[key] || 0) + l.costValue;
  });
  const lossByReasonData = Object.keys(lossByReasonMap).map((reason) => ({
    name: reason,
    value: lossByReasonMap[reason],
  }));

  // Courtesy by Reason chart data
  const courtesyByReasonMap: Record<string, number> = {};
  courtesyRecords.forEach((c) => {
    const key = c.reason.replace('_', ' ').toUpperCase();
    courtesyByReasonMap[key] = (courtesyByReasonMap[key] || 0) + c.totalRetailValue;
  });
  const courtesyByReasonData = Object.keys(courtesyByReasonMap).map((reason) => ({
    name: reason,
    value: courtesyByReasonMap[reason],
  }));

  const COLORS = ['#A67C52', '#3D2A1D', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
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

        <button
          onClick={() => addToast('info', 'Exportando Relatório', 'Relatório gerencial exportado com sucesso!')}
          className="bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 px-4 py-2.5 rounded-xl font-bold text-xs shadow flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          <span>Exportar Relatórios (PDF / Excel)</span>
        </button>
      </div>

      {/* Report Sub-Tabs */}
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

      {/* TAB 1: SALES REPORT */}
      {activeReportTab === 'sales' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Faturamento Bruto</span>
              <p className="text-2xl font-bold text-emerald-700 mt-2">R$ {totalRevenue.toFixed(2)}</p>
              <p className="text-[10px] text-stone-400 mt-1">Total de vendas e comandas concluídas</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Total de Pedidos</span>
              <p className="text-2xl font-bold text-amber-800 mt-2">{totalSalesCount}</p>
              <p className="text-[10px] text-stone-400 mt-1">Comandas e vendas registradas</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Ticket Médio</span>
              <p className="text-2xl font-bold text-stone-900 mt-2">R$ {averageTicket.toFixed(2)}</p>
              <p className="text-[10px] text-stone-400 mt-1">Gasto médio por cliente/mesa</p>
            </div>
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
              <h3 className="font-bold text-stone-900 text-sm">Produtos Mais Vendidos (Curva ABC)</h3>
              <div className="space-y-2">
                {products.slice(0, 5).map((p, idx) => (
                  <div key={p.id} className="p-3 bg-stone-50 rounded-xl border flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-lg bg-amber-800 text-white font-bold flex items-center justify-center text-[10px]">
                        #{idx + 1}
                      </span>
                      <div>
                        <p className="font-bold text-stone-900">{p.name}</p>
                        <p className="text-[10px] text-stone-500">Preço: R$ {p.price.toFixed(2)}</p>
                      </div>
                    </div>
                    <span className="font-bold text-amber-900">R$ {(p.price * 12).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LOSSES REPORT */}
      {activeReportTab === 'losses' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider block">Custo Total de Perdas</span>
              <p className="text-2xl font-bold text-rose-700 mt-2">R$ {totalLossCost.toFixed(2)}</p>
              <p className="text-[10px] text-stone-400 mt-1">Impacto financeiro direto no custo do estoque</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider block">Total de Ocorrências</span>
              <p className="text-2xl font-bold text-stone-900 mt-2">{lossCount} registros</p>
              <p className="text-[10px] text-stone-400 mt-1">Ocorrências de descartes/avarias</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider block">Maior Causa de Perda</span>
              <p className="text-base font-bold text-amber-900 mt-2 uppercase">
                {lossByReasonData[0]?.name || 'Validade Expirada'}
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
              <p className="text-xs text-stone-400 italic">Sem registros suficientes para gráfico.</p>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: COURTESY REPORT */}
      {activeReportTab === 'courtesies' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-xs font-semibold text-amber-900 uppercase tracking-wider block">Valor de Venda Concedido</span>
              <p className="text-2xl font-bold text-amber-900 mt-2">R$ {totalCourtesyRetail.toFixed(2)}</p>
              <p className="text-[10px] text-stone-400 mt-1">Total de venda oferecido gratuitamente ao cliente</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider block">Custo Real de Produção</span>
              <p className="text-2xl font-bold text-stone-800 mt-2">R$ {totalCourtesyCost.toFixed(2)}</p>
              <p className="text-[10px] text-stone-400 mt-1">Custo interno de fabricação das cortesias</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider block">Cortesias Concedidas</span>
              <p className="text-2xl font-bold text-stone-900 mt-2">{courtesyCount} lançamentos</p>
              <p className="text-[10px] text-stone-400 mt-1">Autorizações registradas pela gerência</p>
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
              <p className="text-xs text-stone-400 italic">Sem registros de cortesia até o momento.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
