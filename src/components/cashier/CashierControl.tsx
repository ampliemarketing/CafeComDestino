import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Wallet, 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  X,
  Lock,
  Unlock
} from 'lucide-react';

export const CashierControl: React.FC = () => {
  const { cashShift, cashMovements, openCashShift, closeCashShift, addCashMovement, currentUser } = useApp();

  const [openFloatInput, setOpenFloatInput] = useState<number>(200);
  const [closeActualInput, setCloseActualInput] = useState<number>(0);
  const [closeNotesInput, setCloseNotesInput] = useState<string>('');

  // Movement Modal
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [movType, setMovType] = useState<'reforco' | 'sangria'>('sangria');
  const [movAmount, setMovAmount] = useState<number>(50);
  const [movReason, setMovReason] = useState<string>('');

  // Close Shift Modal
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);

  const expectedTotal = cashShift.initialFloat + cashShift.salesCash + cashShift.additions - cashShift.withdrawals;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-stone-900 text-stone-100 p-5 rounded-2xl border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-800 text-white font-bold flex items-center justify-center shadow">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">Controle de Caixa</h2>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                cashShift.status === 'aberto' ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : 'bg-rose-950 text-rose-400 border-rose-800'
              }`}>
                STATUS: {cashShift.status.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              Operador: {cashShift.openedBy || currentUser.name} • Aberto em: {cashShift.openedAt}
            </p>
          </div>
        </div>

        {cashShift.status === 'aberto' ? (
          <button
            onClick={() => {
              setCloseActualInput(expectedTotal);
              setIsCloseModalOpen(true);
            }}
            className="bg-rose-700 hover:bg-rose-800 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow flex items-center gap-2"
          >
            <Lock className="w-4 h-4" />
            <span>Fechar Caixa do Turno</span>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Fundo Inicial"
              value={openFloatInput}
              onChange={(e) => setOpenFloatInput(Number(e.target.value))}
              className="bg-stone-800 text-white border border-stone-700 rounded-xl px-3 py-2 text-xs w-32 font-bold"
            />
            <button
              onClick={() => openCashShift(openFloatInput)}
              className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow flex items-center gap-2"
            >
              <Unlock className="w-4 h-4" />
              <span>Abrir Novo Caixa</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Cash Shift Balances Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Fundo Inicial</span>
          <p className="text-2xl font-bold text-stone-900 mt-2">R$ {cashShift.initialFloat.toFixed(2)}</p>
          <p className="text-[10px] text-stone-400 mt-1">Troco para abertura de turno</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Vendas em Dinheiro</span>
          <p className="text-2xl font-bold text-emerald-700 mt-2">R$ {cashShift.salesCash.toFixed(2)}</p>
          <p className="text-[10px] text-stone-400 mt-1">Total recebido em espécie</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Vendas Cartão & Pix</span>
          <p className="text-2xl font-bold text-amber-800 mt-2">R$ {(cashShift.salesCard + cashShift.salesPix).toFixed(2)}</p>
          <p className="text-[10px] text-stone-400 mt-1">Pix: R$ {cashShift.salesPix.toFixed(2)} | Cartões: R$ {cashShift.salesCard.toFixed(2)}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm bg-stone-50">
          <span className="text-xs font-semibold text-stone-600 uppercase tracking-wider">Saldo Esperado em Gaveta</span>
          <p className="text-2xl font-bold text-stone-900 mt-2">R$ {expectedTotal.toFixed(2)}</p>
          <p className="text-[10px] text-stone-500 mt-1">Fundo + Dinheiro + Reforços - Sangrias</p>
        </div>
      </div>

      {/* Cash Actions & Movements Table */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-stone-900 text-sm">Movimentações do Caixa (Sangrias & Reforços)</h3>
          {cashShift.status === 'aberto' && (
            <button
              onClick={() => setIsMovementModalOpen(true)}
              className="bg-amber-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow flex items-center gap-1.5"
            >
              <DollarSign className="w-4 h-4" />
              <span>Nova Movimentação</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 my-2">
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex justify-between items-center text-xs">
            <span className="font-semibold text-emerald-950">Total Reforços (+):</span>
            <span className="font-bold text-emerald-800 text-sm">R$ {cashShift.additions.toFixed(2)}</span>
          </div>
          <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 flex justify-between items-center text-xs">
            <span className="font-semibold text-rose-950">Total Sangrias (-):</span>
            <span className="font-bold text-rose-800 text-sm">R$ {cashShift.withdrawals.toFixed(2)}</span>
          </div>
        </div>

        {/* Movement Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-stone-100 text-stone-600 uppercase font-bold border-b">
              <tr>
                <th className="p-3">Horário</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Motivo</th>
                <th className="p-3">Operador</th>
                <th className="p-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {cashMovements.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-stone-400">
                    Nenhuma sangria ou reforço registrado no turno.
                  </td>
                </tr>
              ) : (
                cashMovements.map((m) => (
                  <tr key={m.id} className="hover:bg-stone-50">
                    <td className="p-3 font-medium text-stone-600">{m.timestamp}</td>
                    <td className="p-3 font-bold uppercase">
                      <span className={`px-2 py-0.5 rounded text-[10px] ${
                        m.type === 'reforco' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {m.type}
                      </span>
                    </td>
                    <td className="p-3 text-stone-800">{m.reason}</td>
                    <td className="p-3 text-stone-600">{m.userName}</td>
                    <td className={`p-3 text-right font-bold ${
                      m.type === 'reforco' ? 'text-emerald-700' : 'text-rose-700'
                    }`}>
                      {m.type === 'reforco' ? '+' : '-'} R$ {m.amount.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Movement Modal */}
      {isMovementModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-stone-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-stone-900 text-base">Registrar Movimentação de Caixa</h3>
              <button onClick={() => setIsMovementModalOpen(false)} className="p-1 text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMovType('sangria')}
                className={`p-3 rounded-xl border text-center font-bold text-xs ${
                  movType === 'sangria' ? 'bg-rose-700 text-white border-rose-700' : 'bg-stone-50 border-stone-200 text-stone-700'
                }`}
              >
                Sangria (Retirada)
              </button>
              <button
                onClick={() => setMovType('reforco')}
                className={`p-3 rounded-xl border text-center font-bold text-xs ${
                  movType === 'reforco' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-stone-50 border-stone-200 text-stone-700'
                }`}
              >
                Reforço (Entrada)
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-stone-700 block mb-1">Valor (R$)</label>
                <input
                  type="number"
                  value={movAmount}
                  onChange={(e) => setMovAmount(Number(e.target.value))}
                  className="w-full border rounded-xl p-2.5 font-bold"
                />
              </div>
              <div>
                <label className="font-semibold text-stone-700 block mb-1">Motivo / Justificativa</label>
                <input
                  type="text"
                  placeholder="Ex: Pagamento fornecedor hortifruti, troco extra..."
                  value={movReason}
                  onChange={(e) => setMovReason(e.target.value)}
                  className="w-full border rounded-xl p-2.5"
                />
              </div>
            </div>

            <button
              onClick={() => {
                if (movAmount > 0 && movReason) {
                  addCashMovement(movType, movAmount, movReason);
                  setIsMovementModalOpen(false);
                  setMovReason('');
                }
              }}
              className="w-full bg-amber-800 text-white py-3 rounded-xl font-bold text-xs shadow"
            >
              Confirmar Movimento
            </button>
          </div>
        </div>
      )}

      {/* Close Shift Modal */}
      {isCloseModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-stone-200">
            <h3 className="font-bold text-stone-900 text-base">Fechamento de Caixa</h3>
            <div className="p-3 bg-stone-100 rounded-xl border space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Saldo Esperado em Espécie:</span>
                <span className="font-bold">R$ {expectedTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-stone-700 block mb-1">Valor Contado em Gaveta (R$)</label>
                <input
                  type="number"
                  value={closeActualInput}
                  onChange={(e) => setCloseActualInput(Number(e.target.value))}
                  className="w-full border rounded-xl p-2.5 font-bold text-base"
                />
              </div>

              <div className="p-2 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 font-bold flex justify-between">
                <span>Diferença de Caixa:</span>
                <span>R$ {(closeActualInput - expectedTotal).toFixed(2)}</span>
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">Observações do Fechamento</label>
                <textarea
                  placeholder="Justificativa para divergências..."
                  value={closeNotesInput}
                  onChange={(e) => setCloseNotesInput(e.target.value)}
                  className="w-full border rounded-xl p-2.5"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setIsCloseModalOpen(false)}
                className="flex-1 py-2.5 bg-stone-200 text-stone-700 font-bold rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  closeCashShift(closeActualInput, closeNotesInput);
                  setIsCloseModalOpen(false);
                }}
                className="flex-1 py-2.5 bg-rose-700 text-white font-bold rounded-xl text-xs shadow"
              >
                Confirmar Fechamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
