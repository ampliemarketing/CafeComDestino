import React from 'react';
import { useApp } from '../../context/AppContext';
import { CashShift, CashMovement } from '../../types';
import { ShiftSalesStats } from './shiftStats';

interface CashShiftPrintReportProps {
  shift: CashShift;
  turno: number;
  movements: CashMovement[];
  stats: ShiftSalesStats;
}

const paymentRows = (shift: CashShift) => [
  { label: 'Dinheiro', system: shift.salesCash, conferred: shift.actualTotal },
  { label: 'Cartão de Crédito', system: shift.salesCredit, conferred: shift.conferredCredit },
  { label: 'Cartão de Débito', system: shift.salesDebit, conferred: shift.conferredDebit },
  { label: 'Pix', system: shift.salesPix, conferred: shift.conferredPix },
  { label: 'Vale-refeição', system: shift.salesMealVoucher, conferred: shift.conferredMealVoucher },
  { label: 'Outros', system: shift.salesOther, conferred: shift.conferredOther },
];

export const CashShiftPrintReport: React.FC<CashShiftPrintReportProps> = ({ shift, turno, movements, stats }) => {
  const { companyProfile } = useApp();

  return (
    <div className="font-mono text-[11px] text-black bg-white p-6 max-w-[420px] mx-auto">
      <div className="text-center border-b border-dashed border-black pb-2 mb-2">
        <p className="font-bold text-sm uppercase">{companyProfile.tradeName}</p>
        <p>CNPJ: {companyProfile.cnpj}</p>
      </div>

      <div className="text-center font-bold uppercase py-1 my-1 border-y border-black">
        Relatório de Fechamento de Caixa — Turno #{turno}
      </div>

      <div className="space-y-0.5 pb-2 border-b border-dashed border-black">
        <p>Aberto por: {shift.openedBy}</p>
        <p>Em: {shift.openedAt}</p>
        {shift.status === 'fechado' && <p>Fechado por: {shift.closedBy}</p>}
        {shift.status === 'fechado' && <p>Em: {shift.closedAt}</p>}
        <p>Status: {shift.status.toUpperCase()}</p>
      </div>

      <div className="py-2 border-b border-dashed border-black">
        <p className="font-bold uppercase mb-1">Formas de Pagamento (Sistema x Conferido)</p>
        {paymentRows(shift).map((row) => (
          <div key={row.label} className="flex justify-between">
            <span>{row.label}:</span>
            <span>
              R$ {row.system.toFixed(2)} / {row.conferred != null ? `R$ ${row.conferred.toFixed(2)}` : '—'}
            </span>
          </div>
        ))}
      </div>

      <div className="py-2 border-b border-dashed border-black">
        <p className="font-bold uppercase mb-1">Movimentação em Espécie</p>
        <div className="flex justify-between"><span>Fundo Inicial:</span><span>R$ {shift.initialFloat.toFixed(2)}</span></div>
        <div className="flex justify-between"><span>(+) Vendas Dinheiro:</span><span>R$ {shift.salesCash.toFixed(2)}</span></div>
        <div className="flex justify-between"><span>(+) Suprimentos:</span><span>R$ {shift.additions.toFixed(2)}</span></div>
        <div className="flex justify-between"><span>(-) Sangrias:</span><span>R$ {shift.withdrawals.toFixed(2)}</span></div>
        <div className="flex justify-between font-bold border-t border-black mt-1 pt-1"><span>(=) Esperado:</span><span>R$ {shift.expectedTotal.toFixed(2)}</span></div>
        <div className="flex justify-between"><span>Contado:</span><span>{shift.actualTotal != null ? `R$ ${shift.actualTotal.toFixed(2)}` : '—'}</span></div>
        <div className="flex justify-between font-bold"><span>Diferença:</span><span>{shift.difference != null ? `R$ ${shift.difference.toFixed(2)}` : '—'}</span></div>
      </div>

      <div className="py-2 border-b border-dashed border-black">
        <p className="font-bold uppercase mb-1">Vendas do Período</p>
        <div className="flex justify-between"><span>Total Bruto:</span><span>R$ {stats.totalBruto.toFixed(2)}</span></div>
        <div className="flex justify-between"><span>Nº Pedidos:</span><span>{stats.numPedidos}</span></div>
        <div className="flex justify-between"><span>Ticket Médio:</span><span>R$ {stats.ticketMedio.toFixed(2)}</span></div>
        <div className="flex justify-between"><span>Cancelamentos:</span><span>{stats.cancelamentos.qtd} / R$ {stats.cancelamentos.valor.toFixed(2)}</span></div>
        <div className="flex justify-between"><span>Descontos:</span><span>{stats.descontos.qtd} / R$ {stats.descontos.valor.toFixed(2)}</span></div>
      </div>

      <div className="py-2 border-b border-dashed border-black">
        <p className="font-bold uppercase mb-1">Movimentações ({movements.length})</p>
        {movements.length === 0 && <p>Nenhuma movimentação registrada.</p>}
        {movements.map((m) => (
          <div key={m.id} className="flex justify-between">
            <span>{m.timestamp} {m.type === 'reforco' ? '(+)' : '(-)'} {m.name}{m.reason ? ` - ${m.reason}` : ''}</span>
            <span>R$ {m.amount.toFixed(2)}</span>
          </div>
        ))}
      </div>

      {shift.notes && (
        <div className="py-2">
          <p className="font-bold uppercase mb-1">Observações</p>
          <p>{shift.notes}</p>
        </div>
      )}

      <p className="text-center pt-2 text-[9px]">Emitido em {new Date().toLocaleString('pt-BR')}</p>
    </div>
  );
};
