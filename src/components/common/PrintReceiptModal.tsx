import React from 'react';
import { useApp } from '../../context/AppContext';
import { Printer, X, Check } from 'lucide-react';

interface PrintReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  receiptData: {
    orderNumber?: number;
    tableNumber?: number;
    customerName?: string;
    waiterName?: string;
    items: Array<{
      name: string;
      quantity: number;
      price: number;
      notes?: string;
      additions?: Array<{ name: string; price: number }>;
    }>;
    subtotal: number;
    discount?: number;
    deliveryFee?: number;
    total: number;
    paymentMethod?: string;
    nfceKey?: string;
    type: 'caixa' | 'cozinha' | 'pre_conta';
  };
}

export const PrintReceiptModal: React.FC<PrintReceiptModalProps> = ({
  isOpen,
  onClose,
  title = 'Comprovante / Impressão Térmica',
  receiptData,
}) => {
  const { companyProfile, addToast } = useApp();

  if (!isOpen) return null;

  const handlePrint = () => {
    addToast('success', 'Impressão Enviada', `Comprovante impresso com sucesso!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-stone-100 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-stone-300">
        <div className="bg-stone-800 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-amber-400" />
            <h3 className="font-semibold text-sm">{title}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-stone-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Simulated Thermal Ticket Preview */}
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          <div className="bg-white p-6 shadow-md border border-stone-300 font-mono text-xs text-stone-900 mx-auto max-w-[280px]">
            {/* Header */}
            <div className="text-center pb-3 border-b border-dashed border-stone-400">
              <p className="font-bold text-sm tracking-wider uppercase">{companyProfile.tradeName}</p>
              <p className="text-[10px] text-stone-600">CNPJ: {companyProfile.cnpj}</p>
              <p className="text-[10px] text-stone-600">{companyProfile.address.street}, {companyProfile.address.number}</p>
              <p className="text-[10px] text-stone-600">Tel: {companyProfile.phone}</p>
            </div>

            {/* Ticket Type */}
            <div className="text-center py-2 my-2 bg-stone-100 border-y border-stone-300 font-bold uppercase">
              {receiptData.type === 'cozinha' && '*** PEDIDO COZINHA ***'}
              {receiptData.type === 'caixa' && '*** COMPROVANTE DE VENDA ***'}
              {receiptData.type === 'pre_conta' && '*** PRÉ-CONTA / CONFERÊNCIA ***'}
            </div>

            {/* Meta */}
            <div className="space-y-1 pb-3 border-b border-dashed border-stone-400">
              {receiptData.orderNumber && <p>PEDIDO #: <span className="font-bold">{receiptData.orderNumber}</span></p>}
              {receiptData.tableNumber && <p>MESA #: <span className="font-bold text-sm">{receiptData.tableNumber}</span></p>}
              {receiptData.customerName && <p>CLIENTE: {receiptData.customerName}</p>}
              {receiptData.waiterName && <p>ATENDENTE: {receiptData.waiterName}</p>}
              <p>DATA: {new Date().toLocaleString('pt-BR')}</p>
            </div>

            {/* Items */}
            <div className="py-3 border-b border-dashed border-stone-400 space-y-2">
              <div className="flex justify-between font-bold border-b pb-1 text-[10px]">
                <span>QTD ITEM</span>
                <span>TOTAL</span>
              </div>
              {receiptData.items.map((item, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="flex justify-between">
                    <span>{item.quantity}x {item.name}</span>
                    <span className="font-semibold">R$ {(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                  {item.additions && item.additions.map((add, aIdx) => (
                    <p key={aIdx} className="text-[10px] text-stone-600 pl-3">+ {add.name} (R$ {add.price.toFixed(2)})</p>
                  ))}
                  {item.notes && (
                    <p className="text-[10px] text-amber-700 bg-amber-50 p-1 rounded font-sans italic">Obs: {item.notes}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="py-3 border-b border-dashed border-stone-400 space-y-1">
              <div className="flex justify-between">
                <span>SUBTOTAL:</span>
                <span>R$ {receiptData.subtotal.toFixed(2)}</span>
              </div>
              {receiptData.deliveryFee ? (
                <div className="flex justify-between">
                  <span>TAXA ENTREGA:</span>
                  <span>R$ {receiptData.deliveryFee.toFixed(2)}</span>
                </div>
              ) : null}
              {receiptData.discount ? (
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>DESCONTO:</span>
                  <span>- R$ {receiptData.discount.toFixed(2)}</span>
                </div>
              ) : null}
              <div className="flex justify-between font-bold text-sm pt-1 text-stone-900 border-t">
                <span>TOTAL:</span>
                <span>R$ {receiptData.total.toFixed(2)}</span>
              </div>
            </div>

            {receiptData.paymentMethod && (
              <div className="py-2 text-center text-[10px] uppercase font-bold text-stone-700">
                PAGAMENTO: {receiptData.paymentMethod}
              </div>
            )}

            {receiptData.nfceKey && (
              <div className="pt-2 text-center text-[9px] text-stone-500 break-all border-t border-dashed">
                <p className="font-bold text-stone-700">NFC-e EMITIDA COM SUCESSO</p>
                <p>Chave: {receiptData.nfceKey}</p>
              </div>
            )}

            <div className="pt-3 text-center text-[9px] text-stone-400 uppercase">
              {companyProfile.name} - Sistema de Gestão
            </div>
          </div>
        </div>

        <div className="bg-stone-200 p-4 flex items-center justify-end gap-3 border-t border-stone-300">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-stone-700 hover:bg-stone-300 text-xs font-semibold"
          >
            Fechar
          </button>
          <button
            onClick={handlePrint}
            className="px-5 py-2 rounded-xl bg-amber-800 text-white hover:bg-amber-900 text-xs font-semibold flex items-center gap-2 shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Imprimir Agora
          </button>
        </div>
      </div>
    </div>
  );
};
