import React from 'react';
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

// Isolado num chunk próprio e carregado via lazy() pelo DashboardView: o
// recharts (~380 KB) só baixa quando o Dashboard é realmente aberto, depois
// dos KPIs já terem pintado (item #17).

const brl = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface SalesPoint { hour: string; total: number; orders: number }
interface PaymentSlice { name: string; value: number; amount: number; color: string }

interface Props {
  salesTimeSeries: SalesPoint[];
  groupByHour: boolean;
  periodLabel: string;
  paymentBreakdownData: PaymentSlice[];
}

export const DashboardCharts: React.FC<Props> = ({
  salesTimeSeries,
  groupByHour,
  periodLabel,
  paymentBreakdownData,
}) => (
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
);

export default DashboardCharts;
