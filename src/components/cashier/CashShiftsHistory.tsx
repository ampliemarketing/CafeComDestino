import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { History, Unlock } from 'lucide-react';
import { hasPermission } from '../../lib/permissions';
import { toBoundedNumber } from '../../lib/validation';

export const CashShiftsHistory: React.FC = () => {
  const { cashShift, cashShiftsHistory, setSelectedCashShiftId, setActiveView, openCashShift, currentUser } = useApp();
  const [openFloatInput, setOpenFloatInput] = useState<number>(200);
  const canOpen = hasPermission(currentUser, 'caixas.abrir');

  const openShift = (id: string) => {
    setSelectedCashShiftId(id);
    setActiveView('caixa-detalhe');
  };

  const handleOpenCashShift = async () => {
    const newId = await openCashShift(openFloatInput);
    if (newId) openShift(newId);
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 min-h-screen">
      {/* Header Banner */}
      <div className="bg-stone-900 text-stone-100 p-5 rounded-2xl border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-800 text-white font-bold flex items-center justify-center shadow">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Caixas</h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Histórico de abertura e fechamento de todos os turnos de caixa. Dê duplo clique num turno para ver os detalhes.
            </p>
          </div>
        </div>

        {cashShift.status === 'aberto' ? (
          <button
            onClick={() => openShift(cashShift.id)}
            className="bg-emerald-800 hover:bg-emerald-900 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow flex items-center gap-2"
          >
            <Unlock className="w-4 h-4" />
            <span>Ver Caixa Aberto</span>
          </button>
        ) : canOpen ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Fundo Inicial"
              value={openFloatInput}
              onChange={(e) => setOpenFloatInput(toBoundedNumber(e.target.value, 0, 1_000_000))}
              className="bg-stone-800 text-white border border-stone-700 rounded-xl px-3 py-2 text-xs w-32 font-bold"
            />
            <button
              onClick={handleOpenCashShift}
              className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow flex items-center gap-2"
            >
              <Unlock className="w-4 h-4" />
              <span>Abrir Caixa</span>
            </button>
          </div>
        ) : null}
      </div>

      {/* History Table */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-4">
        <div className="overflow-x-auto overflow-y-auto max-h-[620px]">
          <table className="w-full text-xs text-left">
            <thead className="bg-stone-100 text-stone-600 uppercase font-bold border-b sticky top-0">
              <tr>
                <th className="p-3">Turno</th>
                <th className="p-3">Data/Hora Abertura</th>
                <th className="p-3">Data/Hora Fechamento</th>
                <th className="p-3">Responsável</th>
                <th className="p-3 text-right">Total de Entradas (+)</th>
                <th className="p-3 text-right">Total de Saídas (-)</th>
                <th className="p-3 text-right">Saldo Final</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {cashShiftsHistory.map((shift, index) => {
                const turno = cashShiftsHistory.length - index;
                const cardLegacy = shift.salesCredit === 0 && shift.salesDebit === 0 && shift.salesCard > 0;
                const entradas = shift.salesCash + shift.salesCredit + shift.salesDebit + shift.salesPix
                  + shift.salesMealVoucher + shift.salesOther + (cardLegacy ? shift.salesCard : 0) + shift.additions;
                // Igual ao detalhe do turno: mercadoria vendida (preço de menu) + sangrias.
                const saidas = (shift.goodsOut ?? 0) + shift.withdrawals;
                // Diferença entre entradas e saídas — sem o fundo de troco. ~0 = turno batendo.
                const saldo = entradas - saidas;

                return (
                  <tr
                    key={shift.id}
                    onDoubleClick={() => openShift(shift.id)}
                    title="Duplo clique para ver detalhes do turno"
                    className="hover:bg-stone-50 cursor-pointer select-none"
                  >
                    <td className="p-3 font-bold font-mono text-stone-900">{turno}</td>
                    <td className="p-3 text-stone-600">{shift.openedAt}</td>
                    <td className="p-3 text-stone-600">{shift.closedAt || '—'}</td>
                    <td className="p-3 font-semibold text-stone-800">{shift.openedBy}</td>
                    <td className="p-3 text-right font-bold text-emerald-700">R$ {entradas.toFixed(2)}</td>
                    <td className="p-3 text-right font-bold text-rose-700">R$ {saidas.toFixed(2)}</td>
                    <td className={`p-3 text-right font-bold ${Math.abs(saldo) > 0.005 ? 'text-rose-700' : 'text-emerald-700'}`}>
                      R$ {saldo.toFixed(2)}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        shift.status === 'aberto'
                          ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                          : 'bg-stone-800 text-stone-300 border-stone-700'
                      }`}>
                        {shift.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {cashShiftsHistory.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-stone-400">
                    Nenhum caixa foi aberto ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
