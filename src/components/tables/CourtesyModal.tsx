import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  X, 
  Gift, 
  ShieldCheck, 
  CheckCircle2, 
  UserCheck, 
  AlertCircle,
  FileText
} from 'lucide-react';
import { Product, CourtesyReason } from '../../types';

interface CourtesyModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableId?: string;
  tableNumber?: number;
}

export const CourtesyModal: React.FC<CourtesyModalProps> = ({
  isOpen,
  onClose,
  tableId,
  tableNumber
}) => {
  const { products, users, recordCourtesy, currentUser } = useApp();

  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState<CourtesyReason>('promocional');
  const [customerName, setCustomerName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Authorization state
  const [authorizerId, setAuthorizerId] = useState<string>(
    users.find((u) => u.role === 'admin' || u.role === 'gerente')?.id || users[0].id
  );
  const [authPin, setAuthPin] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');

  if (!isOpen) return null;

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const handleConfirmCourtesy = () => {
    if (!selectedProduct) return;

    // Check authorizer PIN code
    const authorizer = users.find((u) => u.id === authorizerId);
    if (!authorizer) {
      setAuthError('Selecione um usuário autorizador.');
      return;
    }

    if (authorizer.code && authPin !== authorizer.code) {
      setAuthError(`Código PIN incorreto para ${authorizer.name}. (Dica demo: PIN ${authorizer.code})`);
      return;
    }

    recordCourtesy({
      productId: selectedProduct.id,
      quantity,
      reason,
      source: tableId ? 'mesa' : 'comanda',
      targetReference: tableNumber ? `Mesa #${tableNumber}` : 'Balcão / Geral',
      customerName: customerName || undefined,
      authorizedBy: `${authorizer.name} (${authorizer.role.toUpperCase()})`,
      notes: notes || undefined,
      tableId,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-md w-full my-auto shadow-2xl border border-stone-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-stone-900 text-white p-4 flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-800 text-amber-200 flex items-center justify-center font-bold">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Registrar Cortesia (R$ 0,00)</h3>
              <p className="text-xs text-stone-400">
                {tableNumber ? `Mesa #${tableNumber}` : 'Lançamento sem cobrança ao cliente'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-stone-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Product selection */}
          <div>
            <label className="font-bold text-stone-700 block mb-1">Selecione o Produto</label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full border rounded-xl p-2.5 bg-white font-semibold text-xs"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — Venda: R$ {p.price.toFixed(2)} (Custo: R$ {p.costPrice.toFixed(2)})
                </option>
              ))}
            </select>
          </div>

          {/* Quantity & Reason */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-stone-700 block mb-1">Quantidade</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                className="w-full border rounded-xl p-2.5 font-bold text-xs"
              />
            </div>

            <div>
              <label className="font-bold text-stone-700 block mb-1">Motivo da Cortesia</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as CourtesyReason)}
                className="w-full border rounded-xl p-2.5 bg-white font-semibold text-xs"
              >
                <option value="promocional">Ação Promocional</option>
                <option value="atraso">Compensação por Atraso</option>
                <option value="erro_pedido">Erro no Pedido</option>
                <option value="cliente_especial">Cliente Especial / VIP</option>
                <option value="aniversario">Aniversário</option>
                <option value="gerencia">Cortesia da Gerência</option>
                <option value="degustacao">Degustação</option>
                <option value="outro">Outro Motivo</option>
              </select>
            </div>
          </div>

          {/* Cost vs Retail Value Box */}
          {selectedProduct && (
            <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-amber-800 font-semibold block">Valor de Venda Concedido:</span>
                <strong className="text-amber-950 font-bold text-sm">R$ {(selectedProduct.price * quantity).toFixed(2)}</strong>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-stone-500 font-semibold block">Custo Real do Produto:</span>
                <strong className="text-stone-800 font-bold text-xs">R$ {(selectedProduct.costPrice * quantity).toFixed(2)}</strong>
              </div>
            </div>
          )}

          {/* Customer & Notes */}
          <div>
            <label className="font-semibold text-stone-700 block mb-1">Nome do Cliente (Opcional)</label>
            <input
              type="text"
              placeholder="Ex: Aniversariante João"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full border rounded-xl p-2 text-xs"
            />
          </div>

          <div>
            <label className="font-semibold text-stone-700 block mb-1">Observações</label>
            <input
              type="text"
              placeholder="Ex: Oferecido café por conta da casa"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border rounded-xl p-2 text-xs"
            />
          </div>

          {/* Supervisor Authorization Box */}
          <div className="border-t pt-3 space-y-2 bg-stone-50 p-3 rounded-xl border border-stone-200">
            <div className="flex items-center gap-1.5 font-bold text-stone-800 text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>Autorização de Gerência/Supervisão</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-stone-500 font-semibold block mb-0.5">Autorizado por</label>
                <select
                  value={authorizerId}
                  onChange={(e) => setAuthorizerId(e.target.value)}
                  className="w-full border rounded-xl p-2 bg-white text-xs font-semibold"
                >
                  {users
                    .filter((u) => u.role === 'admin' || u.role === 'gerente')
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role.toUpperCase()})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-stone-500 font-semibold block mb-0.5">PIN do Autorizador</label>
                <input
                  type="password"
                  placeholder="Ex: 1010 ou 2020"
                  value={authPin}
                  onChange={(e) => {
                    setAuthPin(e.target.value);
                    setAuthError('');
                  }}
                  className="w-full border rounded-xl p-2 bg-white font-mono text-xs"
                />
              </div>
            </div>

            {authError && (
              <p className="text-[10px] text-rose-600 font-bold flex items-center gap-1 mt-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{authError}</span>
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-stone-50 p-4 border-t flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-200 text-stone-700 font-bold rounded-xl text-xs hover:bg-stone-300"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmCourtesy}
            className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white font-bold rounded-xl text-xs shadow flex items-center gap-1.5"
          >
            <Gift className="w-4 h-4" />
            <span>Confirmar Cortesia</span>
          </button>
        </div>
      </div>
    </div>
  );
};
