import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  X, 
  DollarSign, 
  Receipt, 
  CheckCircle2, 
  User, 
  CreditCard, 
  Clock, 
  Plus, 
  Trash2, 
  Printer, 
  Percent, 
  ShieldCheck,
  Package
} from 'lucide-react';
import { DiningTable, TableItem, PaymentMethod, PartialPayment } from '../../types';
import { PrintReceiptModal } from '../common/PrintReceiptModal';
import { MAXLEN, sanitizeText } from '../../lib/validation';

interface PartialPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  table: DiningTable;
  comandaId: string;
}

export const PartialPaymentModal: React.FC<PartialPaymentModalProps> = ({ isOpen, onClose, table, comandaId }) => {
  const { addPartialPayment, currentUser } = useApp();
  const comanda = table.comandas.find((c) => c.id === comandaId);

  const [paymentType, setPaymentType] = useState<'by_item' | 'by_amount'>('by_item');

  // By Item state
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // By Amount state
  const [manualAmount, setManualAmount] = useState<string>('50.00');

  // Customer & notes
  const [customerName, setCustomerName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Payment method selection: single vs split
  const [isSplitPayment, setIsSplitPayment] = useState<boolean>(false);
  const [singleMethod, setSingleMethod] = useState<PaymentMethod>('pix');
  const [splitRows, setSplitRows] = useState<{ method: PaymentMethod; amount: string }[]>([
    { method: 'pix', amount: '0' },
    { method: 'dinheiro', amount: '0' },
  ]);

  // Completed receipt modal
  const [completedPayment, setCompletedPayment] = useState<PartialPayment | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  if (!isOpen || !comanda) return null;

  // Compute comanda financial state
  const activeAdvances = (comanda.advancePayments || []).filter((p) => p.status === 'ativo');
  const totalAdvancesAmount = activeAdvances.reduce((sum, p) => sum + p.amount, 0);

  const totalConsumed = comanda.items
    .filter((i) => i.status !== 'cancelado')
    .reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  const remainingBalance = Math.max(0, totalConsumed - totalAdvancesAmount);

  // Unpaid items that can be selected
  const availableItems = comanda.items.filter((i) => i.status !== 'cancelado' && !i.isPaid && i.unitPrice > 0);

  // Calculate total for selected items
  const selectedItemsTotal = availableItems
    .filter((i) => selectedItemIds.includes(i.id))
    .reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  const effectivePaymentAmount = paymentType === 'by_item' ? selectedItemsTotal : (parseFloat(manualAmount) || 0);

  const toggleItemSelection = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllItems = () => {
    if (selectedItemIds.length === availableItems.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(availableItems.map((i) => i.id));
    }
  };

  const handleConfirmPayment = async () => {
    if (effectivePaymentAmount <= 0) {
      alert('Selecione pelo menos um item ou informe um valor maior que zero.');
      return;
    }

    if (effectivePaymentAmount > remainingBalance + 0.05) {
      alert(`O valor (R$ ${effectivePaymentAmount.toFixed(2)}) não pode ser superior ao saldo restante da mesa (R$ ${remainingBalance.toFixed(2)}).`);
      return;
    }

    let finalSplitPayments: { method: PaymentMethod; amount: number }[] | undefined = undefined;

    if (isSplitPayment) {
      const parsedSplits = splitRows.map((r) => ({
        method: r.method,
        amount: parseFloat(r.amount) || 0,
      })).filter((r) => r.amount > 0);

      const splitSum = parsedSplits.reduce((acc, r) => acc + r.amount, 0);
      if (Math.abs(splitSum - effectivePaymentAmount) > 0.05) {
        alert(`A soma dos pagamentos fracionados (R$ ${splitSum.toFixed(2)}) deve ser exatamente igual ao total a pagar (R$ ${effectivePaymentAmount.toFixed(2)}).`);
        return;
      }
      finalSplitPayments = parsedSplits;
    }

    const created = await addPartialPayment(table.id, comandaId, {
      amount: effectivePaymentAmount,
      paymentMethod: isSplitPayment ? 'multiplo' : singleMethod,
      type: paymentType,
      itemIdsPaid: paymentType === 'by_item' ? selectedItemIds : undefined,
      customerName: customerName.trim() || comanda.personName,
      notes,
      splitPayments: finalSplitPayments,
    });

    if (created) {
      setCompletedPayment(created);
      setIsReceiptOpen(true);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-stone-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl max-w-2xl w-full my-auto shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="bg-stone-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-stone-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-800 text-amber-200 flex items-center justify-center font-bold">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base sm:text-lg">Adiantamento Parcial • Mesa #{table.number}</h3>
                <p className="text-xs text-stone-400">
                  Comanda: {comanda.personName}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">
            {/* Financial Summary Box */}
            <div className="grid grid-cols-3 gap-3 bg-stone-50 p-3.5 rounded-2xl border border-stone-200 text-xs">
              <div className="bg-white p-2.5 rounded-xl border border-stone-200">
                <span className="text-[10px] text-stone-500 font-semibold uppercase block">Consumo Total</span>
                <strong className="text-stone-900 text-sm font-bold">R$ {totalConsumed.toFixed(2)}</strong>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-amber-200 bg-amber-50/30">
                <span className="text-[10px] text-amber-800 font-semibold uppercase block">Já Adiantado</span>
                <strong className="text-amber-900 text-sm font-bold">R$ {totalAdvancesAmount.toFixed(2)}</strong>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/30">
                <span className="text-[10px] text-emerald-800 font-semibold uppercase block">Saldo Restante</span>
                <strong className="text-emerald-900 text-sm font-bold">R$ {remainingBalance.toFixed(2)}</strong>
              </div>
            </div>

            {/* Tabs: By Item vs By Amount */}
            <div className="flex gap-2 bg-stone-100 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setPaymentType('by_item')}
                className={`flex-1 py-2.5 rounded-lg transition flex items-center justify-center gap-1.5 ${
                  paymentType === 'by_item' ? 'bg-amber-800 text-white shadow' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Package className="w-4 h-4" />
                <span>Adiantamento por Produto</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentType('by_amount')}
                className={`flex-1 py-2.5 rounded-lg transition flex items-center justify-center gap-1.5 ${
                  paymentType === 'by_amount' ? 'bg-amber-800 text-white shadow' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <DollarSign className="w-4 h-4" />
                <span>Adiantamento por Valor Manual</span>
              </button>
            </div>

            {/* TAB 1: BY ITEM SELECTION */}
            {paymentType === 'by_item' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-stone-700 uppercase tracking-wider">
                    Selecione os produtos a serem pagos ({availableItems.length} pendentes)
                  </span>
                  {availableItems.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSelectAllItems}
                      className="text-amber-800 hover:underline font-bold text-[11px]"
                    >
                      {selectedItemIds.length === availableItems.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                    </button>
                  )}
                </div>

                {availableItems.length === 0 ? (
                  <div className="p-4 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl text-xs text-center">
                    Não há produtos pendentes nesta mesa (todos os itens já foram pagos ou são cortesias).
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {availableItems.map((item) => {
                      const isChecked = selectedItemIds.includes(item.id);
                      const itemTotal = item.unitPrice * item.quantity;

                      return (
                        <div
                          key={item.id}
                          onClick={() => toggleItemSelection(item.id)}
                          className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between text-xs ${
                            isChecked ? 'bg-amber-50 border-amber-600 ring-1 ring-amber-600' : 'bg-white border-stone-200 hover:bg-stone-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}} // handled by parent div
                              className="w-4 h-4 accent-amber-800 rounded cursor-pointer"
                            />
                            <div>
                              <p className="font-bold text-stone-900">{item.quantity}x {item.productName}</p>
                              <p className="text-[10px] text-stone-500">
                                Unitário: R$ {item.unitPrice.toFixed(2)} {item.waiterName ? `• Pedido por ${item.waiterName}` : ''}
                              </p>
                            </div>
                          </div>
                          <strong className="font-bold text-stone-900 text-sm">R$ {itemTotal.toFixed(2)}</strong>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: BY MANUAL AMOUNT */}
            {paymentType === 'by_amount' && (
              <div className="space-y-3 bg-stone-50 p-4 rounded-2xl border border-stone-200">
                <label className="font-bold text-stone-700 text-xs block">
                  Informe o Valor do Adiantamento (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 font-bold text-stone-500 text-sm">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max={remainingBalance}
                    value={manualAmount}
                    onChange={(e) => setManualAmount(e.target.value)}
                    className="w-full border rounded-xl pl-10 pr-4 py-2.5 font-bold text-lg text-amber-900 focus:ring-2 focus:ring-amber-700 bg-white"
                  />
                </div>
                <div className="flex gap-2">
                  {[20, 50, 100, 150, Math.round(remainingBalance / 2)].map((val) => (
                    val > 0 && val <= remainingBalance && (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setManualAmount(val.toFixed(2))}
                        className="px-2.5 py-1 bg-white border border-stone-300 rounded-lg text-xs font-semibold hover:bg-amber-50 hover:border-amber-600 transition"
                      >
                        R$ {val}
                      </button>
                    )
                  ))}
                  <button
                    type="button"
                    onClick={() => setManualAmount(remainingBalance.toFixed(2))}
                    className="px-2.5 py-1 bg-amber-800 text-white rounded-lg text-xs font-bold shadow hover:bg-amber-900"
                  >
                    Saldo Total (R$ {remainingBalance.toFixed(2)})
                  </button>
                </div>
              </div>
            )}

            {/* Customer Name & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-semibold text-stone-700 block mb-1">
                  Nome / Identificação do Cliente (Opcional)
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    maxLength={MAXLEN.personName}
                    placeholder="Ex: Pedro (vai embora mais cedo)"
                    value={customerName}
                    onChange={(e) => setCustomerName(sanitizeText(e.target.value, MAXLEN.personName))}
                    className="w-full border rounded-xl pl-9 pr-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">Observações do Lançamento</label>
                <input
                  type="text"
                  maxLength={MAXLEN.shortNote}
                  placeholder="Ex: Pagou bebidas e 1 prato"
                  value={notes}
                  onChange={(e) => setNotes(sanitizeText(e.target.value, MAXLEN.shortNote))}
                  className="w-full border rounded-xl p-2 text-xs"
                />
              </div>
            </div>

            {/* Payment Method Selector (Single vs Split) */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs uppercase text-stone-700 tracking-wider">
                  Forma de Pagamento
                </span>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-amber-900">
                  <input
                    type="checkbox"
                    checked={isSplitPayment}
                    onChange={(e) => setIsSplitPayment(e.target.checked)}
                    className="w-4 h-4 accent-amber-800 rounded cursor-pointer"
                  />
                  <span>Múltiplas Formas / Pagamento Misto</span>
                </label>
              </div>

              {!isSplitPayment ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'pix', label: 'PIX', icon: '⚡' },
                    { id: 'cartao_credito', label: 'Crédito', icon: '💳' },
                    { id: 'cartao_debito', label: 'Débito', icon: '💳' },
                    { id: 'dinheiro', label: 'Dinheiro', icon: '💵' },
                    { id: 'vale_refeicao', label: 'Vale-refeição', icon: '🎫' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSingleMethod(m.id as PaymentMethod)}
                      className={`p-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        singleMethod === m.id
                          ? 'bg-amber-800 text-white border-amber-800 shadow'
                          : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      <span>{m.icon}</span>
                      <span>{m.label}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-2 bg-stone-50 p-3 rounded-xl border border-stone-200 text-xs">
                  <p className="text-[11px] text-stone-500 font-semibold">
                    Divida o valor de R$ {effectivePaymentAmount.toFixed(2)} entre mais de uma forma:
                  </p>
                  {splitRows.map((row, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={row.method}
                        onChange={(e) => {
                          const val = e.target.value as PaymentMethod;
                          setSplitRows((prev) => prev.map((r, i) => (i === idx ? { ...r, method: val } : r)));
                        }}
                        className="border rounded-xl p-2 bg-white font-semibold text-xs"
                      >
                        <option value="pix">PIX</option>
                        <option value="cartao_credito">Cartão de Crédito</option>
                        <option value="cartao_debito">Cartão de Débito</option>
                        <option value="dinheiro">Dinheiro</option>
                        <option value="vale_refeicao">Vale-refeição</option>
                      </select>
                      <div className="relative flex-1">
                        <span className="absolute left-2.5 top-2 text-stone-400 font-bold">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.amount}
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : String(Math.max(0, Number(e.target.value) || 0));
                            setSplitRows((prev) => prev.map((r, i) => (i === idx ? { ...r, amount: val } : r)));
                          }}
                          className="w-full border rounded-xl pl-8 pr-2 py-2 font-bold bg-white text-xs"
                        />
                      </div>
                      {splitRows.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setSplitRows((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-rose-600 p-1 hover:bg-rose-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSplitRows((prev) => [...prev, { method: 'dinheiro', amount: '0' }])}
                    className="text-amber-800 hover:underline font-bold text-xs flex items-center gap-1 mt-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar outra forma</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Footer Action */}
          <div className="bg-stone-50 p-4 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="text-xs">
              <span className="text-stone-500 font-semibold block">Total a Pagar Agora:</span>
              <strong className="text-amber-900 font-bold text-lg">R$ {effectivePaymentAmount.toFixed(2)}</strong>
              <span className="text-[10px] text-stone-400 block">
                Novo saldo restante da mesa: R$ {Math.max(0, remainingBalance - effectivePaymentAmount).toFixed(2)}
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-stone-200 text-stone-700 font-bold rounded-xl text-xs hover:bg-stone-300 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                className="flex-1 sm:flex-none px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs shadow transition flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmar Pagamento</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Ticket Print Modal for Partial Payment */}
      {isReceiptOpen && completedPayment && (
        <PrintReceiptModal
          isOpen={isReceiptOpen}
          onClose={() => {
            setIsReceiptOpen(false);
            onClose();
          }}
          title="Comprovante de Adiantamento Parcial"
          receiptData={{
            tableNumber: table.number,
            customerName: completedPayment.customerName,
            waiterName: completedPayment.userName,
            items: completedPayment.paidItemsDetails
              ? completedPayment.paidItemsDetails.map((i) => ({ name: i.productName, quantity: i.quantity, price: i.unitPrice }))
              : [{ name: `Adiantamento por Valor (Mesa #${table.number})`, quantity: 1, price: completedPayment.amount }],
            subtotal: completedPayment.amount,
            total: completedPayment.amount,
            type: 'adiantamento_parcial',
            paymentMethod: completedPayment.paymentMethod,
            splitPayments: completedPayment.splitPayments,
            remainingBalance: completedPayment.remainingBalanceAfter,
          }}
        />
      )}
    </>
  );
};
