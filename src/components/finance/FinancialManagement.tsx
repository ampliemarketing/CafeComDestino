import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  FileText,
  PieChart as PieChartIcon
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { hasPermission } from '../../lib/permissions';
import { MAXLEN, sanitizeText, toBoundedNumber } from '../../lib/validation';

export const FinancialManagement: React.FC = () => {
  const { orders, addToast, currentUser, financialEntries } = useApp();
  const canLancar = hasPermission(currentUser, 'financeiro_dre.lancar');

  const [activeTab, setActiveTab] = useState<'dre' | 'contas'>('dre');

  // New entry modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEntryType, setNewEntryType] = useState<'receita' | 'despesa'>('despesa');
  const [newEntryDesc, setNewEntryDesc] = useState('');
  const [newEntryCategory, setNewEntryCategory] = useState('Insumos / Fornecedores');
  const [newEntryAmount, setNewEntryAmount] = useState(250.00);

  // Financial calculations
  const totalReceitas = financialEntries
    .filter((e) => e.type === 'receita')
    .reduce((acc, e) => acc + e.amount, 0);

  const totalDespesas = financialEntries
    .filter((e) => e.type === 'despesa')
    .reduce((acc, e) => acc + e.amount, 0);

  const lucroLiquido = totalReceitas - totalDespesas;
  const margemLucro = totalReceitas > 0 ? (lucroLiquido / totalReceitas) * 100 : 0;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-stone-900 text-stone-100 p-5 rounded-2xl border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-800 text-white font-bold flex items-center justify-center shadow">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Gestão Financeira & DRE</h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Contas a pagar e receber, demonstrativo de resultados e margem operacional.
            </p>
          </div>
        </div>

        {canLancar && (
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-amber-800 hover:bg-amber-900 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Lançar Conta / Despesa</span>
        </button>
        )}
      </div>

      {/* Financial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Receita Bruta Total</span>
          <p className="text-2xl font-bold text-emerald-700 mt-2">R$ {totalReceitas.toFixed(2)}</p>
          <p className="text-[10px] text-stone-400 mt-1">Vendas PDV, Garçom e Pedidos Online</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Despesas / Custos</span>
          <p className="text-2xl font-bold text-rose-700 mt-2">R$ {totalDespesas.toFixed(2)}</p>
          <p className="text-[10px] text-stone-400 mt-1">Insumos, aluguel, folha e utilidades</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Lucro Líquido</span>
          <p className={`text-2xl font-bold mt-2 ${lucroLiquido >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
            R$ {lucroLiquido.toFixed(2)}
          </p>
          <p className="text-[10px] text-stone-400 mt-1">Resultado operacional do período</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Margem Líquida</span>
          <p className="text-2xl font-bold text-amber-800 mt-2">{margemLucro.toFixed(1)}%</p>
          <p className="text-[10px] text-stone-400 mt-1">Rentabilidade sobre o faturamento</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-4">
        <div className="flex gap-2 border-b pb-3">
          <button
            onClick={() => setActiveTab('dre')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'dre' ? 'bg-amber-800 text-white' : 'bg-stone-100 text-stone-700'
            }`}
          >
            DRE Simplificado
          </button>
          <button
            onClick={() => setActiveTab('contas')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'contas' ? 'bg-amber-800 text-white' : 'bg-stone-100 text-stone-700'
            }`}
          >
            Lançamentos de Contas
          </button>
        </div>

        {/* DRE Tab */}
        {activeTab === 'dre' && (
          <div className="space-y-3 max-w-2xl text-xs">
            <h3 className="font-bold text-stone-900 text-sm border-b pb-2">Demonstrativo do Resultado do Exercício</h3>

            <div className="flex justify-between py-2 border-b font-bold text-emerald-800">
              <span>(+) Receita Operacional Bruta:</span>
              <span>R$ {totalReceitas.toFixed(2)}</span>
            </div>

            <div className="flex justify-between py-1.5 border-b text-stone-700 pl-4">
              <span>- Vendas Balcão & PDV:</span>
              <span>R$ {(totalReceitas * 0.45).toFixed(2)}</span>
            </div>

            <div className="flex justify-between py-1.5 border-b text-stone-700 pl-4">
              <span>- Vendas Salão Garçom:</span>
              <span>R$ {(totalReceitas * 0.35).toFixed(2)}</span>
            </div>

            <div className="flex justify-between py-1.5 border-b text-stone-700 pl-4">
              <span>- Delivery & Pedidos Online:</span>
              <span>R$ {(totalReceitas * 0.20).toFixed(2)}</span>
            </div>

            <div className="flex justify-between py-2 border-b font-bold text-rose-800">
              <span>(-) Deduções e Custos Variáveis (CPV):</span>
              <span>R$ {(totalDespesas * 0.65).toFixed(2)}</span>
            </div>

            <div className="flex justify-between py-2 border-b font-bold text-rose-800">
              <span>(-) Despesas Fixas & Operacionais:</span>
              <span>R$ {(totalDespesas * 0.35).toFixed(2)}</span>
            </div>

            <div className="flex justify-between py-3 bg-stone-100 p-3 rounded-xl font-bold text-sm text-stone-900">
              <span>(=) LUCRO LÍQUIDO DO PERÍODO:</span>
              <span className={lucroLiquido >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                R$ {lucroLiquido.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Contas Table Tab */}
        {activeTab === 'contas' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-stone-100 text-stone-600 uppercase font-bold border-b">
                <tr>
                  <th className="p-3">Data</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Descrição</th>
                  <th className="p-3">Categoria</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {financialEntries.map((e) => (
                  <tr key={e.id} className="hover:bg-stone-50">
                    <td className="p-3 text-stone-600">{e.dueDate}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase ${
                        e.type === 'receita' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {e.type}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-stone-900">{e.description}</td>
                    <td className="p-3 text-stone-600">{e.category}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        e.status === 'pago' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {e.status.toUpperCase()}
                      </span>
                    </td>
                    <td className={`p-3 text-right font-bold ${
                      e.type === 'receita' ? 'text-emerald-700' : 'text-rose-700'
                    }`}>
                      {e.type === 'receita' ? '+' : '-'} R$ {e.amount.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Launch Entry Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-stone-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-stone-900 text-base">Lançamento Financeiro</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-bold">
              <button
                onClick={() => setNewEntryType('despesa')}
                className={`p-3 rounded-xl border ${newEntryType === 'despesa' ? 'bg-rose-700 text-white' : 'bg-stone-50 text-stone-700'}`}
              >
                Despesa / Conta a Pagar
              </button>
              <button
                onClick={() => setNewEntryType('receita')}
                className={`p-3 rounded-xl border ${newEntryType === 'receita' ? 'bg-emerald-700 text-white' : 'bg-stone-50 text-stone-700'}`}
              >
                Receita / A Receber
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-stone-700 block mb-1">Descrição</label>
                <input
                  type="text"
                  maxLength={MAXLEN.name}
                  placeholder="Ex: Fornecedor de Carnes Prime"
                  value={newEntryDesc}
                  onChange={(e) => setNewEntryDesc(sanitizeText(e.target.value, MAXLEN.name))}
                  className="w-full border rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">Valor (R$)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newEntryAmount}
                  onChange={(e) => setNewEntryAmount(toBoundedNumber(e.target.value, 0, 100_000_000))}
                  className="w-full border rounded-xl p-2.5 font-bold"
                />
              </div>
            </div>

            <button
              onClick={async () => {
                if (newEntryAmount <= 0) {
                  addToast('error', 'Valor inválido', 'Informe um valor maior que zero.');
                  return;
                }
                const { error } = await supabase.from('financial_entries').insert({
                  id: 'fin-' + Date.now(),
                  type: newEntryType,
                  description: newEntryDesc.trim() || (newEntryType === 'receita' ? 'Receita avulsa' : 'Despesa avulsa'),
                  category: newEntryCategory,
                  amount: newEntryAmount,
                  due_date: new Date().toISOString().slice(0, 10),
                  status: 'pendente',
                  created_by: currentUser.id,
                  created_by_name: currentUser.name,
                });
                if (error) { addToast('error', 'Erro ao lançar', error.message); return; }
                addToast('success', 'Lançamento registrado com sucesso!');
                setIsModalOpen(false);
                setNewEntryDesc('');
              }}
              className="w-full bg-amber-800 text-white py-2.5 rounded-xl font-bold text-xs shadow"
            >
              Confirmar Lançamento
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
