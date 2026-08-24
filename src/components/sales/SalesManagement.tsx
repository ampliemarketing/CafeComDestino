import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Receipt, 
  Search, 
  Filter, 
  Printer, 
  FileText, 
  CheckCircle2, 
  Ban, 
  Eye, 
  X,
  Sparkles
} from 'lucide-react';
import { Order, OrderChannel, OrderStatus } from '../../types';
import { PrintReceiptModal } from '../common/PrintReceiptModal';

export const SalesManagement: React.FC = () => {
  const { orders, issueNfce, updateOrderStatus, addToast } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<string>('todos');
  const [selectedStatus, setSelectedStatus] = useState<string>('todos');

  // Detail Modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Print Modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const filteredOrders = orders.filter((o) => {
    const matchSearch = 
      o.orderNumber.toString().includes(searchQuery) ||
      o.customer.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchChannel = selectedChannel === 'todos' || o.channel === selectedChannel;
    const matchStatus = selectedStatus === 'todos' || o.orderStatus === selectedStatus;

    return matchSearch && matchChannel && matchStatus;
  });

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-stone-900 text-stone-100 p-5 rounded-2xl border border-stone-800 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-800 text-white font-bold flex items-center justify-center shadow">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Gestão de Vendas e Histórico</h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Consulta detalhada de pedidos, reemissão de comprovantes e notas fiscais NFC-e.
            </p>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar por nº do pedido ou cliente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border rounded-xl pl-10 pr-4 py-2 text-xs focus:ring-2 focus:ring-amber-700"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto text-xs font-semibold">
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            className="border rounded-xl p-2 text-stone-700"
          >
            <option value="todos">Todos os Canais</option>
            <option value="online">Pedido Online</option>
            <option value="garcom">App Garçom</option>
            <option value="pdv">PDV Balcão</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="border rounded-xl p-2 text-stone-700"
          >
            <option value="todos">Todos os Status</option>
            <option value="concluido">Concluídos</option>
            <option value="em_preparo">Em Preparo</option>
            <option value="cancelado">Cancelados</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-stone-100 text-stone-600 uppercase font-bold border-b sticky top-0 z-10">
              <tr>
                <th className="p-3.5">Pedido #</th>
                <th className="p-3.5">Canal</th>
                <th className="p-3.5">Cliente</th>
                <th className="p-3.5">Horário</th>
                <th className="p-3.5">Pagamento</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">NFC-e</th>
                <th className="p-3.5 text-right">Total</th>
                <th className="p-3.5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredOrders.map((ord) => (
                <tr key={ord.id} className="hover:bg-stone-50 transition">
                  <td className="p-3.5 font-bold text-stone-900">#{ord.orderNumber}</td>
                  <td className="p-3.5">
                    <span className="bg-stone-100 text-stone-700 font-bold text-[10px] px-2 py-0.5 rounded border uppercase">
                      {ord.channel}
                    </span>
                  </td>
                  <td className="p-3.5 font-semibold text-stone-800">{ord.customer.name}</td>
                  <td className="p-3.5 text-stone-600">{ord.createdAt}</td>
                  <td className="p-3.5 font-bold uppercase text-stone-700">{ord.paymentMethod}</td>
                  <td className="p-3.5">
                    <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                      ord.orderStatus === 'concluido' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {ord.orderStatus}
                    </span>
                  </td>
                  <td className="p-3.5">
                    {ord.fiscalIssued ? (
                      <span className="text-emerald-700 font-bold text-[10px]">Emitida ✅</span>
                    ) : (
                      <button
                        onClick={() => issueNfce(ord.id)}
                        className="text-[10px] bg-amber-800 text-white px-2 py-0.5 rounded font-bold hover:bg-amber-900"
                      >
                        Emitir NFC-e
                      </button>
                    )}
                  </td>
                  <td className="p-3.5 text-right font-bold text-amber-800 text-sm">
                    R$ {ord.total.toFixed(2)}
                  </td>
                  <td className="p-3.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => setSelectedOrder(ord)}
                        className="p-1.5 text-stone-600 hover:text-stone-900 rounded-lg hover:bg-stone-100"
                        title="Ver Detalhes"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedOrder(ord);
                          setIsPrintModalOpen(true);
                        }}
                        className="p-1.5 text-stone-600 hover:text-stone-900 rounded-lg hover:bg-stone-100"
                        title="Reimprimir Comprovante"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && !isPrintModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-stone-200">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-bold text-stone-900 text-base">Pedido #{selectedOrder.orderNumber}</h3>
                <p className="text-xs text-stone-500">Canal: {selectedOrder.channel.toUpperCase()} • {selectedOrder.createdAt}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-1 text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p className="font-bold text-stone-800">Cliente: {selectedOrder.customer.name}</p>
              <p className="text-stone-600">Telefone: {selectedOrder.customer.phone}</p>
              {selectedOrder.customer.address && (
                <p className="text-stone-600">Endereço: {selectedOrder.customer.address.street}, {selectedOrder.customer.address.number}</p>
              )}
            </div>

            <div className="p-3 bg-stone-50 rounded-xl border space-y-1 text-xs">
              <p className="font-bold text-stone-700">Itens do Pedido:</p>
              {selectedOrder.items.map((i, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{i.quantity}x {i.productName}</span>
                  <span className="font-semibold">R$ {(i.unitPrice * i.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center font-bold text-sm text-amber-900 pt-2 border-t">
              <span>Total da Venda:</span>
              <span>R$ {selectedOrder.total.toFixed(2)}</span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setIsPrintModalOpen(true)}
                className="flex-1 bg-stone-800 text-white py-2.5 rounded-xl font-bold text-xs shadow flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Reimprimir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Receipt Modal */}
      {isPrintModalOpen && selectedOrder && (
        <PrintReceiptModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          title="Reimpressão de Venda"
          receiptData={{
            orderNumber: selectedOrder.orderNumber,
            customerName: selectedOrder.customer.name,
            items: selectedOrder.items.map((i) => ({ name: i.productName, quantity: i.quantity, price: i.unitPrice })),
            subtotal: selectedOrder.subtotal,
            discount: selectedOrder.discount,
            total: selectedOrder.total,
            paymentMethod: selectedOrder.paymentMethod,
            nfceKey: selectedOrder.nfceKey,
            type: 'caixa',
          }}
        />
      )}
    </div>
  );
};
