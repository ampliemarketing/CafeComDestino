import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Grid2X2,
  Users,
  Plus,
  Receipt,
  Printer,
  ArrowRightLeft,
  CheckCircle2,
  DollarSign,
  Trash2,
  X,
  Sparkles,
  Gift,
  Clock,
  RotateCcw,
  CreditCard,
  ShieldAlert,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Search
} from 'lucide-react';
import { DiningTable, TableStatus, PaymentMethod } from '../../types';
import { PrintReceiptModal } from '../common/PrintReceiptModal';
import { PartialPaymentModal } from './PartialPaymentModal';
import { CourtesyModal } from './CourtesyModal';

export const TableManagement: React.FC = () => {
  const {
    tables,
    tableSectors,
    createTable,
    deleteTable,
    openComanda,
    cancelComandaItem,
    transferComanda,
    closeComandaAndPay,
    cancelPartialPayment,
    addToast,
    currentUser
  } = useApp();

  const [selectedSector, setSelectedSector] = useState<string>('todos');
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [activeTable, setActiveTable] = useState<DiningTable | null>(null);
  const [selectedComandaId, setSelectedComandaId] = useState<string | null>(null);

  // New Comanda modal (opens a free table, or adds another person to one already occupied)
  const [isOpenModalOpen, setIsOpenModalOpen] = useState(false);
  const [guestCount, setGuestCount] = useState(2);
  const [personName, setPersonName] = useState('');

  // New Table Modal
  const [isNewTableModalOpen, setIsNewTableModalOpen] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState<number>(1);
  const [newTableSector, setNewTableSector] = useState<string>('');
  const [newTableCapacity, setNewTableCapacity] = useState<number>(2);

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isPartialModalOpen, setIsPartialModalOpen] = useState(false);
  const [isCourtesyModalOpen, setIsCourtesyModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [targetTableId, setTargetTableId] = useState<string>('');

  // Final Pay Modal
  const [isFinalPayModalOpen, setIsFinalPayModalOpen] = useState(false);
  const [finalPaymentMethod, setFinalPaymentMethod] = useState<PaymentMethod>('pix');
  const [finalDiscount, setFinalDiscount] = useState<number>(0);

  // Delete Table Confirmation Modal
  const [tableToDelete, setTableToDelete] = useState<DiningTable | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');

  const normalizedTableSearch = tableSearchQuery.trim().toLowerCase();
  const filteredTables = tables
    .filter((t) => selectedSector === 'todos' || t.sector === selectedSector)
    .filter((t) =>
      !normalizedTableSearch ||
      String(t.number).includes(normalizedTableSearch) ||
      t.sector.toLowerCase().includes(normalizedTableSearch) ||
      t.comandas.some((c) => c.personName.toLowerCase().includes(normalizedTableSearch))
    )
    .slice()
    .sort((a, b) => a.number - b.number);

  // Keep activeTable/currentComanda updated when tables state changes
  const currentActiveTable = activeTable ? tables.find((t) => t.id === activeTable.id) || null : null;
  const currentComanda = currentActiveTable?.comandas.find((c) => c.id === selectedComandaId) || null;

  const handleOpenTableClick = (tb: DiningTable) => {
    setActiveTable(tb);
    setSelectedComandaId(null);
    if (tb.status === 'livre') {
      setGuestCount(2);
      setPersonName('');
      setIsOpenModalOpen(true);
    }
  };

  const handleOpenNewComandaModal = () => {
    setGuestCount(2);
    setPersonName('');
    setIsOpenModalOpen(true);
  };

  const getStatusBadge = (status: TableStatus) => {
    switch (status) {
      case 'ocupada': return { label: 'Ocupada', class: 'bg-amber-100 text-amber-800 border-amber-300' };
      default: return { label: 'Livre', class: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-stone-900 text-stone-100 p-5 rounded-2xl border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-800 text-white font-bold flex items-center justify-center shadow">
            <Grid2X2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Gestão de Mesas e Comandas</h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Mapa do restaurante, comandas por pessoa, adiantamento parcial, cortesias e fechamento.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Sector Tabs */}
          <div className="flex gap-1.5 bg-stone-800 p-1.5 rounded-xl border border-stone-700 text-xs font-semibold overflow-x-auto">
            {['todos', ...tableSectors.map((s) => s.name)].map((sec) => (
              <button
                key={sec}
                onClick={() => setSelectedSector(sec)}
                className={`px-3 py-1.5 rounded-lg transition capitalize whitespace-nowrap ${
                  selectedSector === sec ? 'bg-amber-800 text-white shadow' : 'text-stone-300 hover:text-white'
                }`}
              >
                {sec}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              if (tableSectors.length === 0) {
                addToast('error', 'Nenhuma área cadastrada', 'Crie uma área do restaurante em Grupos antes de cadastrar mesas.');
                return;
              }
              const nextNumber = tables.length > 0 ? Math.max(...tables.map((t) => t.number)) + 1 : 1;
              setNewTableNumber(nextNumber);
              setNewTableSector(tableSectors[0].name);
              setNewTableCapacity(2);
              setIsNewTableModalOpen(true);
            }}
            className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-2.5 rounded-xl text-xs font-bold shadow transition shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Mesa</span>
          </button>
        </div>
      </div>

      {(!currentActiveTable || currentActiveTable.status === 'livre') && (
        <>
      {/* Table Search */}
      <div className="bg-white p-3.5 rounded-2xl border border-stone-200">
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar mesa por número, setor ou cliente..."
            value={tableSearchQuery}
            onChange={(e) => setTableSearchQuery(e.target.value)}
            className="w-full bg-white border border-stone-300 rounded-xl pl-9 pr-3 py-2 text-xs focus:ring-2 focus:ring-amber-700"
          />
        </div>
      </div>

      {/* Grid of Tables */}
      {filteredTables.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl border border-stone-200 text-center text-xs text-stone-400">
          Nenhuma mesa encontrada{tableSearchQuery ? ` para "${tableSearchQuery}"` : ''}.
        </div>
      ) : (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4">
        {filteredTables.map((tb) => {
          const badge = getStatusBadge(tb.status);
          const isSelected = activeTable?.id === tb.id;

          const tableAdvances = tb.comandas.reduce(
            (sum, c) => sum + (c.advancePayments || []).filter((p) => p.status === 'ativo').reduce((s, p) => s + p.amount, 0),
            0
          );
          const tableSubtotal = tb.comandas.reduce((sum, c) => sum + c.subtotal, 0);
          const remainingBalance = Math.max(0, tableSubtotal - tableAdvances);
          const hasAnyItems = tb.comandas.some((c) => c.items.length > 0);

          return (
            <div
              key={tb.id}
              onClick={() => handleOpenTableClick(tb)}
              className={`bg-white p-4 rounded-2xl border-2 transition cursor-pointer shadow-sm hover:shadow-md flex flex-col justify-between h-44 ${
                isSelected ? 'ring-2 ring-amber-800 border-amber-800' : ''
              } ${
                tb.status === 'livre'
                  ? 'border-emerald-200 bg-emerald-50/10'
                  : remainingBalance === 0 && hasAnyItems
                  ? 'border-emerald-500 bg-emerald-50/20'
                  : 'border-amber-600 bg-amber-50/20'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-2xl font-bold text-stone-900">Mesa {tb.number}</span>
                  <p className="text-[10px] text-stone-500 font-semibold">{tb.sector} • {tb.capacity} lug</p>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${badge.class}`}>
                    {badge.label}
                  </span>
                  {tb.status === 'livre' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setTableToDelete(tb);
                        setDeleteConfirmInput('');
                      }}
                      className="text-stone-300 hover:text-rose-600 p-0.5"
                      title="Remover mesa"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {tb.comandas.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs font-bold text-stone-800 truncate">
                    {tb.comandas.length} comanda{tb.comandas.length > 1 ? 's' : ''}: {tb.comandas.map((c) => c.personName).join(', ')}
                  </p>

                  {/* Financial indicators */}
                  {tableAdvances > 0 && (
                    <div className="flex items-center justify-between text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-bold">
                      <span>Adiantado:</span>
                      <span>R$ {tableAdvances.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-stone-200">
                    <span className="text-stone-500 text-[10px]">{tb.comandas.length} comanda(s)</span>
                    <div className="text-right">
                      <span className="font-bold text-amber-900 text-sm block">
                        R$ {remainingBalance.toFixed(2)}
                      </span>
                      {tableAdvances > 0 && (
                        <span className="text-[9px] text-stone-400 block line-through">
                          R$ {tableSubtotal.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-stone-400 text-xs flex items-center gap-1 font-medium">
                  <Plus className="w-4 h-4 text-emerald-600" />
                  <span>Mesa Livre (Abrir)</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}
        </>
      )}

      {/* Comandas list of the selected table */}
      {currentActiveTable && currentActiveTable.status !== 'livre' && (
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setActiveTable(null); setSelectedComandaId(null); }}
                className="bg-stone-800 hover:bg-stone-700 text-white p-2.5 rounded-xl transition"
                title="Voltar para todas as mesas"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h3 className="font-bold text-lg text-stone-900">
                Mesa #{currentActiveTable.number} — {currentActiveTable.comandas.length} comanda(s) aberta(s)
              </h3>
            </div>
            <button
              onClick={handleOpenNewComandaModal}
              className="bg-amber-800 hover:bg-amber-900 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Comanda</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {currentActiveTable.comandas.map((c) => {
              const isSelected = c.id === selectedComandaId;
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedComandaId(c.id)}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition flex items-center justify-between ${
                    isSelected ? 'border-amber-800 bg-amber-50/40' : 'border-stone-200 hover:border-amber-400 bg-stone-50'
                  }`}
                >
                  <div>
                    <p className="font-bold text-sm text-stone-900">{c.personName}</p>
                    <p className="text-[10px] text-stone-500">
                      {c.guestCount ? `${c.guestCount} pessoas • ` : ''}{c.items.length} item(ns) • {c.openedAt}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-800 text-sm">R$ {c.subtotal.toFixed(2)}</span>
                    <ChevronRight className="w-4 h-4 text-stone-400" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Comanda Consumption & Detail Drawer */}
      {currentActiveTable && currentComanda && (
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-md space-y-5">
          {/* Header Actions */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-xl text-stone-900">
                  Comanda Mesa #{currentActiveTable.number} • {currentComanda.personName}
                </h3>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${getStatusBadge(currentActiveTable.status).class}`}>
                  {getStatusBadge(currentActiveTable.status).label}
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-1">
                {currentComanda.guestCount} pessoas • Garçom: {currentComanda.waiterName || 'Atendente'} • Aberta às {currentComanda.openedAt}
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setIsTransferModalOpen(true)}
                className="bg-stone-100 hover:bg-stone-200 text-stone-800 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-stone-300"
              >
                <ArrowRightLeft className="w-4 h-4 text-stone-600" />
                <span>Transferir Comanda</span>
              </button>

              <button
                onClick={() => setIsCourtesyModalOpen(true)}
                className="bg-amber-100 hover:bg-amber-200 text-amber-900 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-amber-300"
              >
                <Gift className="w-4 h-4 text-amber-800" />
                <span>Lançar Cortesia</span>
              </button>

              <button
                onClick={() => setIsPartialModalOpen(true)}
                className="bg-amber-800 hover:bg-amber-900 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow transition flex items-center gap-1.5"
              >
                <Receipt className="w-4 h-4" />
                <span>Adiantamento Parcial</span>
              </button>

              <button
                onClick={() => setIsPrintModalOpen(true)}
                className="bg-stone-800 hover:bg-stone-900 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow transition flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Pré-Conta</span>
              </button>

              <button
                onClick={() => setIsFinalPayModalOpen(true)}
                className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-xl text-xs font-bold shadow transition flex items-center gap-1.5"
              >
                <DollarSign className="w-4 h-4" />
                <span>Fechar e Receber Comanda</span>
              </button>
            </div>
          </div>

          {/* Financial Totals Summary Bar */}
          {(() => {
            const activeAdvances = (currentComanda.advancePayments || []).filter((p) => p.status === 'ativo');
            const totalAdvances = activeAdvances.reduce((sum, p) => sum + p.amount, 0);
            const remainingBalance = Math.max(0, currentComanda.subtotal - totalAdvances);

            return (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-stone-50 p-4 rounded-2xl border border-stone-200">
                <div className="bg-white p-3 rounded-xl border border-stone-200">
                  <span className="text-[10px] text-stone-500 font-bold uppercase block">Consumo Total da Comanda</span>
                  <strong className="text-stone-900 font-bold text-lg">R$ {currentComanda.subtotal.toFixed(2)}</strong>
                </div>

                <div className="bg-white p-3 rounded-xl border border-amber-200 bg-amber-50/40">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-amber-800 font-bold uppercase">Total Adiantado PAGO</span>
                    <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-bold">
                      {activeAdvances.length} pagamentos
                    </span>
                  </div>
                  <strong className="text-amber-900 font-bold text-lg">R$ {totalAdvances.toFixed(2)}</strong>
                </div>

                <div className="bg-white p-3 rounded-xl border border-emerald-300 bg-emerald-50/40">
                  <span className="text-[10px] text-emerald-800 font-bold uppercase block">Saldo Restante PENDENTE</span>
                  <strong className="text-emerald-950 font-bold text-lg">R$ {remainingBalance.toFixed(2)}</strong>
                </div>
              </div>
            );
          })()}

          {/* Items Consumed */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs uppercase text-stone-500 tracking-wider">
                Produtos Lançados na Comanda ({currentComanda.items.length})
              </h4>
            </div>

            {currentComanda.items.length === 0 ? (
              <p className="text-stone-400 text-xs italic py-2">Nenhum item consumido até o momento.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {currentComanda.items.map((it) => (
                  <div
                    key={it.id}
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs transition ${
                      it.isPaid
                        ? 'bg-emerald-50/60 border-emerald-200'
                        : it.isCourtesy
                        ? 'bg-amber-50/60 border-amber-200'
                        : 'bg-stone-50 border-stone-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-stone-900">{it.quantity}x {it.productName}</p>
                          {it.isPaid && (
                            <span className="text-[9px] bg-emerald-700 text-white px-2 py-0.5 rounded-full font-bold">
                              PAGO EM ADIANTAMENTO
                            </span>
                          )}
                          {it.isCourtesy && (
                            <span className="text-[9px] bg-amber-800 text-white px-2 py-0.5 rounded-full font-bold">
                              CORTESIA
                            </span>
                          )}
                        </div>
                        {it.notes && <p className="text-[10px] text-stone-500 italic mt-0.5">Obs: {it.notes}</p>}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className={`font-bold text-xs ${it.isCourtesy ? 'line-through text-stone-400' : 'text-stone-900'}`}>
                        R$ {(it.unitPrice * it.quantity).toFixed(2)}
                      </span>
                      {!it.isPaid && !it.isCourtesy && (
                        <button
                          onClick={() => cancelComandaItem(currentActiveTable.id, currentComanda.id, it.id, 'Cancelado pelo operador')}
                          className="text-rose-600 hover:text-rose-800 p-1 hover:bg-rose-50 rounded-lg"
                          title="Cancelar item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* List of Partial Payments Completed */}
          {currentComanda.advancePayments && currentComanda.advancePayments.length > 0 && (
            <div className="border-t pt-4 space-y-3">
              <h4 className="font-bold text-xs uppercase text-stone-500 tracking-wider flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-amber-800" />
                <span>Histórico de Adiantamentos Parciais Nesta Comanda</span>
              </h4>

              <div className="space-y-2">
                {currentComanda.advancePayments.map((adv) => (
                  <div
                    key={adv.id}
                    className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                      adv.status === 'estornado' ? 'bg-rose-50/50 border-rose-200 text-stone-400' : 'bg-amber-50/40 border-amber-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-900">{adv.customerName}</span>
                        <span className="text-[10px] font-semibold text-stone-500">• {adv.paidAt}</span>
                        <span className="text-[9px] bg-stone-200 text-stone-700 px-1.5 py-0.5 rounded font-mono uppercase">
                          {adv.paymentMethod}
                        </span>
                        {adv.status === 'estornado' && (
                          <span className="text-[9px] bg-rose-700 text-white px-2 py-0.5 rounded-full font-bold">
                            ESTORNADO
                          </span>
                        )}
                      </div>
                      {adv.paidItemsDetails && adv.paidItemsDetails.length > 0 ? (
                        <p className="text-[11px] text-stone-600 mt-0.5">
                          Itens: {adv.paidItemsDetails.map((i) => `${i.quantity}x ${i.productName}`).join(', ')}
                        </p>
                      ) : (
                        <p className="text-[11px] text-stone-600 mt-0.5">
                          Modalidade: Adiantamento por Valor Manual
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <strong className={`font-bold text-sm ${adv.status === 'estornado' ? 'line-through text-stone-400' : 'text-amber-900'}`}>
                        R$ {adv.amount.toFixed(2)}
                      </strong>
                      {adv.status === 'ativo' && (
                        <button
                          onClick={() => {
                            if (confirm(`Estornar o adiantamento de R$ ${adv.amount.toFixed(2)} (${adv.customerName})?`)) {
                              cancelPartialPayment(currentActiveTable.id, currentComanda.id, adv.id);
                            }
                          }}
                          className="text-rose-600 hover:underline text-[11px] font-bold"
                        >
                          Estornar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: New Table */}
      {isNewTableModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-stone-200">
            <h3 className="font-bold text-stone-900 text-base">Nova Mesa</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-stone-700 block mb-1">Número da Mesa</label>
                <input
                  type="number"
                  min="1"
                  value={newTableNumber}
                  onChange={(e) => setNewTableNumber(Number(e.target.value))}
                  className="w-full border rounded-xl p-2.5"
                />
              </div>
              <div>
                <label className="font-semibold text-stone-700 block mb-1">Setor</label>
                <select
                  value={newTableSector}
                  onChange={(e) => setNewTableSector(e.target.value)}
                  className="w-full border rounded-xl p-2.5 bg-white font-semibold"
                >
                  {tableSectors.map((sec) => (
                    <option key={sec.id} value={sec.name}>{sec.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-semibold text-stone-700 block mb-1">Capacidade (lugares)</label>
                <input
                  type="number"
                  min="1"
                  value={newTableCapacity}
                  onChange={(e) => setNewTableCapacity(Number(e.target.value))}
                  className="w-full border rounded-xl p-2.5"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsNewTableModalOpen(false)}
                className="flex-1 py-2.5 bg-stone-200 text-stone-700 font-bold rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (tables.some((t) => t.number === newTableNumber)) {
                    addToast('error', 'Número já existe', `Já existe uma mesa com o número ${newTableNumber}.`);
                    return;
                  }
                  createTable(newTableNumber, newTableSector, newTableCapacity);
                  setIsNewTableModalOpen(false);
                }}
                className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs shadow"
              >
                Criar Mesa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Delete Table Confirmation */}
      {tableToDelete && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-stone-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-stone-900 text-base">Remover Mesa {tableToDelete.number}?</h3>
                <p className="text-xs text-stone-500">Essa ação não pode ser desfeita.</p>
              </div>
            </div>

            <div className="text-xs">
              <label className="font-semibold text-stone-700 block mb-1">
                Digite <strong className="text-rose-700">{tableToDelete.number}</strong> para confirmar a exclusão
              </label>
              <input
                type="text"
                autoFocus
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                placeholder={`${tableToDelete.number}`}
                className="w-full border rounded-xl p-2.5 font-bold focus:ring-2 focus:ring-rose-600"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setTableToDelete(null)}
                className="flex-1 py-2.5 bg-stone-200 text-stone-700 font-bold rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  deleteTable(tableToDelete.id);
                  setTableToDelete(null);
                }}
                disabled={deleteConfirmInput.trim() !== String(tableToDelete.number)}
                className="flex-1 py-2.5 bg-rose-700 hover:bg-rose-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs shadow"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: New Comanda (opens a free table, or adds another person to one already occupied) */}
      {isOpenModalOpen && activeTable && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-stone-200">
            <h3 className="font-bold text-stone-900 text-base">Nova Comanda • Mesa #{activeTable.number}</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-stone-700 block mb-1">Nome do Cliente / Identificação</label>
                <input
                  type="text"
                  placeholder="Ex: Carlos Andrade"
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  className="w-full border rounded-xl p-2.5"
                />
              </div>
              <div>
                <label className="font-semibold text-stone-700 block mb-1">Quantidade de Pessoas</label>
                <input
                  type="number"
                  min="1"
                  value={guestCount}
                  onChange={(e) => setGuestCount(Number(e.target.value))}
                  className="w-full border rounded-xl p-2.5"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsOpenModalOpen(false)}
                className="flex-1 py-2.5 bg-stone-200 text-stone-700 font-bold rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  const created = await openComanda(activeTable.id, personName || 'Cliente', guestCount);
                  setIsOpenModalOpen(false);
                  if (created) setSelectedComandaId(created.id);
                }}
                className="flex-1 py-2.5 bg-amber-800 text-white font-bold rounded-xl text-xs shadow"
              >
                Abrir Comanda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Final Comanda Closure */}
      {isFinalPayModalOpen && currentActiveTable && currentComanda && (
        <div className="fixed inset-0 z-50 bg-stone-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-stone-900 text-base">Fechar e Receber • {currentComanda.personName} (Mesa #{currentActiveTable.number})</h3>
              <button onClick={() => setIsFinalPayModalOpen(false)}>
                <X className="w-5 h-5 text-stone-400" />
              </button>
            </div>

            {(() => {
              const activeAdvances = (currentComanda.advancePayments || []).filter((p) => p.status === 'ativo');
              const totalAdvances = activeAdvances.reduce((sum, p) => sum + p.amount, 0);
              const remainingBeforeDiscount = Math.max(0, currentComanda.subtotal - totalAdvances);
              const finalAmountToCollect = Math.max(0, remainingBeforeDiscount - finalDiscount);

              return (
                <div className="space-y-4 text-xs">
                  <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 space-y-1.5">
                    <div className="flex justify-between text-stone-600">
                      <span>Consumo Bruto:</span>
                      <strong className="text-stone-900">R$ {currentComanda.subtotal.toFixed(2)}</strong>
                    </div>
                    <div className="flex justify-between text-amber-900 font-semibold">
                      <span>Adiantamentos Já Pagos ({activeAdvances.length}):</span>
                      <span>- R$ {totalAdvances.toFixed(2)}</span>
                    </div>
                    {finalDiscount > 0 && (
                      <div className="flex justify-between text-rose-700 font-semibold">
                        <span>Desconto Aplicado:</span>
                        <span>- R$ {finalDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-emerald-950 font-bold text-sm border-t pt-1.5">
                      <span>VALOR A COBRAR AGORA:</span>
                      <strong className="text-base text-emerald-800">R$ {finalAmountToCollect.toFixed(2)}</strong>
                    </div>
                  </div>

                  {/* Discount */}
                  <div>
                    <label className="font-semibold text-stone-700 block mb-1">Desconto Extra (R$)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={finalDiscount}
                      onChange={(e) => setFinalDiscount(Math.max(0, Number(e.target.value)))}
                      className="w-full border rounded-xl p-2 font-bold"
                    />
                  </div>

                  {/* Payment method for remaining */}
                  {finalAmountToCollect > 0 ? (
                    <div>
                      <label className="font-bold text-stone-700 block mb-1">Forma de Pagamento do Saldo Restante</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'pix', label: 'PIX', icon: '⚡' },
                          { id: 'cartao_credito', label: 'Crédito', icon: '💳' },
                          { id: 'cartao_debito', label: 'Débito', icon: '💳' },
                          { id: 'dinheiro', label: 'Dinheiro', icon: '💵' },
                        ].map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setFinalPaymentMethod(m.id as PaymentMethod)}
                            className={`p-2.5 rounded-xl border font-bold transition flex items-center justify-center gap-1.5 ${
                              finalPaymentMethod === m.id
                                ? 'bg-amber-800 text-white border-amber-800'
                                : 'bg-white text-stone-700 border-stone-200'
                            }`}
                          >
                            <span>{m.icon}</span>
                            <span>{m.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="bg-emerald-50 text-emerald-900 border border-emerald-200 p-3 rounded-xl text-center font-bold">
                      Comanda totalmente quitada via adiantamentos! Clique em confirmar para liberar.
                    </p>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsFinalPayModalOpen(false)}
                      className="flex-1 py-2.5 bg-stone-200 text-stone-700 font-bold rounded-xl"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        closeComandaAndPay(currentActiveTable.id, currentComanda.id, finalPaymentMethod, finalDiscount);
                        setIsFinalPayModalOpen(false);
                        setSelectedComandaId(null);
                      }}
                      className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow"
                    >
                      Confirmar e Finalizar
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* MODAL: Transfer Comanda */}
      {isTransferModalOpen && currentActiveTable && currentComanda && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-stone-200 text-xs">
            <h3 className="font-bold text-stone-900 text-base">Transferir Comanda de {currentComanda.personName}</h3>
            <p className="text-stone-500">Selecione a mesa de destino para onde os itens consumidos serão movidos:</p>

            <select
              value={targetTableId}
              onChange={(e) => setTargetTableId(e.target.value)}
              className="w-full border rounded-xl p-2.5 bg-white font-bold text-xs"
            >
              <option value="">Selecione a mesa de destino...</option>
              {tables
                .filter((t) => t.id !== currentActiveTable.id)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    Mesa {t.number} ({t.sector}) - {t.status === 'livre' ? 'Livre' : `Ocupada (${t.comandas.length} comanda(s))`}
                  </option>
                ))}
            </select>

            <div className="flex gap-2">
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="flex-1 py-2.5 bg-stone-200 text-stone-700 font-bold rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (targetTableId) {
                    transferComanda(currentActiveTable.id, currentComanda.id, targetTableId);
                    setIsTransferModalOpen(false);
                    setSelectedComandaId(null);
                  }
                }}
                className="flex-1 py-2.5 bg-amber-800 text-white font-bold rounded-xl shadow"
              >
                Transferir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Partial Payment Modal Component */}
      {isPartialModalOpen && currentActiveTable && currentComanda && (
        <PartialPaymentModal
          isOpen={isPartialModalOpen}
          onClose={() => setIsPartialModalOpen(false)}
          table={currentActiveTable}
          comandaId={currentComanda.id}
        />
      )}

      {/* Courtesy Modal Component */}
      {isCourtesyModalOpen && (
        <CourtesyModal
          isOpen={isCourtesyModalOpen}
          onClose={() => setIsCourtesyModalOpen(false)}
          tableId={currentActiveTable?.id}
          tableNumber={currentActiveTable?.number}
          comandaId={currentComanda?.id}
        />
      )}

      {/* Thermal Ticket Modal */}
      {isPrintModalOpen && currentActiveTable && currentComanda && (
        <PrintReceiptModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          title="Pré-Conta da Mesa"
          receiptData={{
            tableNumber: currentActiveTable.number,
            customerName: currentComanda.personName,
            waiterName: currentComanda.waiterName || currentUser.name,
            items: currentComanda.items.map((i) => ({ name: i.productName, quantity: i.quantity, price: i.unitPrice, notes: i.notes })),
            subtotal: currentComanda.subtotal,
            total: currentComanda.subtotal,
            type: 'pre_conta',
          }}
        />
      )}
    </div>
  );
};
