import React, { useState } from 'react';
import { 
  X, 
  Clock, 
  CheckCircle2, 
  Truck, 
  Utensils, 
  PackageCheck, 
  MapPin, 
  Phone, 
  Copy, 
  MessageCircle, 
  Search, 
  ArrowLeft, 
  AlertCircle,
  QrCode,
  CreditCard,
  Store as StoreIcon,
  ShoppingBag,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Order, OrderStatus } from '../../types';

interface OnlineOrderTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialOrderId?: string | null;
  placedOrderIds: string[];
}

export const OnlineOrderTrackingModal: React.FC<OnlineOrderTrackingModalProps> = ({
  isOpen,
  onClose,
  initialOrderId,
  placedOrderIds,
}) => {
  const { orders, companyProfile, updateOrderStatus, addToast } = useApp();

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(initialOrderId || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPixCopied, setIsPixCopied] = useState(false);

  if (!isOpen) return null;

  // Filter orders created online or matching placedOrderIds / phone / search
  const onlineOrders = orders.filter((o) => {
    // Is in user's saved IDs or match phone/number search
    const isSaved = placedOrderIds.includes(o.id);
    const matchesSearch = searchQuery.trim() !== '' && (
      o.orderNumber.toString().includes(searchQuery.trim()) ||
      o.customer.phone.replace(/\D/g, '').includes(searchQuery.replace(/\D/g, '')) ||
      o.customer.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return isSaved || matchesSearch || o.channel === 'online';
  });

  // Default to initialOrderId or the most recent online order if available
  const activeOrder = orders.find((o) => o.id === selectedOrderId) ||
    (selectedOrderId ? null : (onlineOrders.length > 0 ? onlineOrders[0] : null));

  // Status mapping helper
  const getStatusStepIndex = (status: OrderStatus): number => {
    switch (status) {
      case 'novo':
      case 'aceito':
        return 1;
      case 'em_preparo':
        return 2;
      case 'pronto':
      case 'saiu_entrega':
        return 3;
      case 'concluido':
        return 4;
      case 'cancelado':
        return -1;
      default:
        return 1;
    }
  };

  const currentStep = activeOrder ? getStatusStepIndex(activeOrder.orderStatus) : 0;

  const handleCopyPix = () => {
    setIsPixCopied(true);
    addToast('success', 'Chave Pix Copiada!', 'Cole no app do seu banco para pagar.');
    setTimeout(() => setIsPixCopied(false), 3000);
  };

  const getWhatsAppLink = (order: Order) => {
    const phoneClean = companyProfile.phone.replace(/\D/g, '') || '5511999999999';
    const text = encodeURIComponent(
      `Olá ${companyProfile.tradeName}, gostaria de acompanhar meu Pedido #${order.orderNumber} (${order.customer.name}).`
    );
    return `https://wa.me/55${phoneClean}?text=${text}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="bg-stone-900 text-stone-100 p-4 sm:p-5 flex items-center justify-between border-b border-stone-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-800 text-amber-300 flex items-center justify-center font-bold shadow-md">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <span>Acompanhar Pedido Online</span>
                <span className="text-[10px] bg-amber-700/80 text-amber-200 px-2 py-0.5 rounded-full font-mono">
                  Tempo Real
                </span>
              </h3>
              <p className="text-[11px] text-stone-400">Status ao vivo da cozinha & entrega</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-stone-800 text-stone-300 hover:text-white hover:bg-stone-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Order Selector Bar */}
        <div className="bg-stone-100 p-3 border-b border-stone-200 space-y-2 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              maxLength={40}
              placeholder="Buscar pelo nº do pedido ou WhatsApp..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value.slice(0, 40))}
              className="w-full bg-white border border-stone-300 rounded-xl pl-9 pr-3 py-1.5 text-xs focus:ring-2 focus:ring-amber-800 focus:outline-none"
            />
          </div>

          {/* Quick List Chips of Recent Orders */}
          {onlineOrders.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
              <span className="text-[10px] text-stone-500 font-bold uppercase shrink-0">Seus Pedidos:</span>
              {onlineOrders.map((ord) => {
                const isSelected = activeOrder?.id === ord.id;
                return (
                  <button
                    key={ord.id}
                    onClick={() => setSelectedOrderId(ord.id)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 shrink-0 border ${
                      isSelected
                        ? 'bg-amber-800 text-white border-amber-800 shadow-sm'
                        : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-200'
                    }`}
                  >
                    <span>#{ord.orderNumber}</span>
                    <span className="text-[10px] opacity-80">
                      (R$ {ord.total.toFixed(2)})
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {!activeOrder ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-16 h-16 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <p className="font-bold text-stone-700 text-sm">Nenhum pedido encontrado</p>
              <p className="text-stone-500 max-w-xs mx-auto">
                Digite o número do seu pedido ou o número do WhatsApp cadastrado no campo de busca acima.
              </p>
            </div>
          ) : (
            <>
              {/* Order Top Banner */}
              <div className="bg-gradient-to-r from-stone-900 to-amber-950 text-white p-4 rounded-2xl shadow-md space-y-2 border border-amber-900/40">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-amber-300 uppercase font-mono tracking-wider font-bold">
                      Pedido #{activeOrder.orderNumber} • {activeOrder.serviceType.toUpperCase()}
                    </span>
                    <h4 className="font-bold text-base text-white mt-0.5">
                      {activeOrder.customer.name}
                    </h4>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-stone-400 block">Total do Pedido</span>
                    <span className="text-lg font-black font-mono text-amber-400">
                      R$ {activeOrder.total.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-stone-300 border-t border-amber-800/60 pt-2">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Realizado às: {activeOrder.createdAt}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-emerald-400 uppercase font-mono">
                      {activeOrder.paymentMethod.toUpperCase()} - {activeOrder.paymentStatus.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              {/* LIVE STEP TIMELINE PROGRESS */}
              <div className="bg-stone-50 p-4 sm:p-5 rounded-2xl border border-stone-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-stone-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>Progresso do Atendimento</span>
                  </h5>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full animate-pulse">
                    Atualização Ao Vivo
                  </span>
                </div>

                {activeOrder.orderStatus === 'cancelado' ? (
                  <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl flex items-center gap-3">
                    <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />
                    <div>
                      <p className="font-bold text-sm">Pedido Cancelado</p>
                      <p className="text-[11px] text-rose-700">
                        Este pedido foi cancelado pelo restaurante. Entre em contato via WhatsApp para dúvidas.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Visual Stepper */}
                    <div className="grid grid-cols-4 gap-2 text-center relative pt-2">
                      {/* Stepper Bar Background */}
                      <div className="absolute top-5 left-8 right-8 h-1 bg-stone-200 -z-0" />
                      <div
                        className="absolute top-5 left-8 h-1 bg-emerald-600 transition-all duration-500 -z-0"
                        style={{
                          width:
                            currentStep === 1
                              ? '0%'
                              : currentStep === 2
                              ? '33%'
                              : currentStep === 3
                              ? '66%'
                              : '100%',
                        }}
                      />

                      {/* Step 1 */}
                      <div className="relative z-10 flex flex-col items-center space-y-1">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition ${
                            currentStep >= 1
                              ? 'bg-emerald-600 text-white shadow-md ring-4 ring-emerald-100'
                              : 'bg-stone-200 text-stone-500'
                          }`}
                        >
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <span
                          className={`text-[10px] font-bold ${
                            currentStep >= 1 ? 'text-emerald-900' : 'text-stone-400'
                          }`}
                        >
                          1. Recebido
                        </span>
                      </div>

                      {/* Step 2 */}
                      <div className="relative z-10 flex flex-col items-center space-y-1">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition ${
                            currentStep >= 2
                              ? 'bg-amber-600 text-white shadow-md ring-4 ring-amber-100'
                              : 'bg-stone-200 text-stone-500'
                          }`}
                        >
                          <Utensils className="w-4 h-4" />
                        </div>
                        <span
                          className={`text-[10px] font-bold ${
                            currentStep >= 2 ? 'text-amber-900' : 'text-stone-400'
                          }`}
                        >
                          2. Em Preparo
                        </span>
                      </div>

                      {/* Step 3 */}
                      <div className="relative z-10 flex flex-col items-center space-y-1">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition ${
                            currentStep >= 3
                              ? 'bg-amber-700 text-white shadow-md ring-4 ring-amber-100'
                              : 'bg-stone-200 text-stone-500'
                          }`}
                        >
                          <Truck className="w-4 h-4" />
                        </div>
                        <span
                          className={`text-[10px] font-bold ${
                            currentStep >= 3 ? 'text-amber-950' : 'text-stone-400'
                          }`}
                        >
                          3. Saiu p/ Entrega
                        </span>
                      </div>

                      {/* Step 4 */}
                      <div className="relative z-10 flex flex-col items-center space-y-1">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition ${
                            currentStep >= 4
                              ? 'bg-emerald-700 text-white shadow-md ring-4 ring-emerald-100'
                              : 'bg-stone-200 text-stone-500'
                          }`}
                        >
                          <PackageCheck className="w-5 h-5" />
                        </div>
                        <span
                          className={`text-[10px] font-bold ${
                            currentStep >= 4 ? 'text-emerald-900' : 'text-stone-400'
                          }`}
                        >
                          4. Entregue
                        </span>
                      </div>
                    </div>

                    {/* Active Step Box Explanation */}
                    <div className="bg-white p-3.5 rounded-xl border border-stone-200 space-y-1 text-center shadow-sm">
                      {currentStep === 1 && (
                        <div>
                          <p className="font-bold text-amber-900 text-xs">
                             Pedido Recebido na Cozinha!
                          </p>
                          <p className="text-[11px] text-stone-600 mt-0.5">
                            Seu pedido já foi registrado via Tuna Pagamentos e está aguardando o início do preparo pelos nossos chefs.
                          </p>
                        </div>
                      )}
                      {currentStep === 2 && (
                        <div>
                          <p className="font-bold text-amber-800 text-xs">
                            🍳 Seu pedido está sendo preparado com muito carinho!
                          </p>
                          <p className="text-[11px] text-stone-600 mt-0.5">
                            Tempo estimado de preparo: ~{companyProfile.avgPrepTimeMinutes} minutos.
                          </p>
                        </div>
                      )}
                      {currentStep === 3 && (
                        <div>
                          <p className="font-bold text-amber-900 text-xs">
                            🛵 Pedido Pronto / Saiu para Entrega!
                          </p>
                          <p className="text-[11px] text-stone-600 mt-0.5">
                            {activeOrder.deliveryDriverName
                              ? `Entregador a caminho: ${activeOrder.deliveryDriverName}`
                              : 'Seu pedido está pronto para entrega ou retirada no balcão!'}
                          </p>
                        </div>
                      )}
                      {currentStep === 4 && (
                        <div>
                          <p className="font-bold text-emerald-800 text-xs">
                            🎉 Pedido Concluído / Entregue!
                          </p>
                          <p className="text-[11px] text-stone-600 mt-0.5">
                            Agradecemos a preferência! Bom apetite!
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Pix Payment QR Code & Copia e Cola (If Pix) */}
              {activeOrder.paymentMethod === 'pix' && activeOrder.paymentStatus !== 'pagamento_aprovado' && (
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-emerald-950 font-bold text-xs">
                    <QrCode className="w-4 h-4 text-emerald-700" />
                    <span>Pagamento via Pix Pendente</span>
                  </div>
                  <p className="text-[11px] text-emerald-800">
                    Copie a chave Pix abaixo e pague no seu aplicativo bancário:
                  </p>
                  <div className="bg-white p-2.5 rounded-xl border border-emerald-200 font-mono text-[10px] break-all text-stone-700 select-all">
                    00020126580014br.gov.bcb.pix0136cafecomdestino-pay-1001-sp5204000053039865405115.705802BR5925CAFE COM DESTINO6009SAO PAULO62070503***6304
                  </div>
                  <button
                    onClick={handleCopyPix}
                    className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition shadow"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{isPixCopied ? 'Chave Copiada com Sucesso!' : 'Copiar Código Pix'}</span>
                  </button>
                </div>
              )}

              {/* Order Items Summary */}
              <div className="space-y-3">
                <h5 className="font-bold text-stone-800 text-xs uppercase tracking-wider">
                  Itens do Pedido ({activeOrder.items.length}):
                </h5>

                <div className="bg-white border border-stone-200 rounded-2xl divide-y divide-stone-100 overflow-hidden">
                  {activeOrder.items.map((item, idx) => (
                    <div key={idx} className="p-3 flex items-start justify-between text-xs">
                      <div>
                        <p className="font-bold text-stone-900">
                          {item.quantity}x {item.productName}
                        </p>
                        {item.additions && item.additions.length > 0 && (
                          <div className="pl-2 text-[10px] text-stone-500 space-y-0.5 mt-0.5">
                            {item.additions.map((a) => (
                              <p key={a.id}>+ {a.name} (R$ {a.price.toFixed(2)})</p>
                            ))}
                          </div>
                        )}
                        {item.notes && (
                          <p className="text-[10px] text-amber-800 italic mt-0.5">Obs: {item.notes}</p>
                        )}
                      </div>

                      <span className="font-bold text-stone-900 font-mono">
                        R$ {(item.unitPrice * item.quantity).toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Customer & Address Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200 space-y-1">
                  <p className="font-bold text-stone-800 text-[11px] uppercase tracking-wider">
                    Dados do Cliente:
                  </p>
                  <p className="font-semibold text-stone-900">{activeOrder.customer.name}</p>
                  <p className="text-stone-500 text-[11px]">{activeOrder.customer.phone}</p>
                </div>

                <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200 space-y-1">
                  <p className="font-bold text-stone-800 text-[11px] uppercase tracking-wider">
                    Endereço de Entrega:
                  </p>
                  {activeOrder.customer.address ? (
                    <p className="text-stone-700 text-[11px] leading-tight">
                      {activeOrder.customer.address.street}, {activeOrder.customer.address.number} - {activeOrder.customer.address.neighborhood}
                      {activeOrder.customer.address.complement ? ` (${activeOrder.customer.address.complement})` : ''}
                    </p>
                  ) : (
                    <p className="text-stone-500 italic text-[11px]">Consumo no Local / Retirada no Balcão</p>
                  )}
                </div>
              </div>

              {/* Contact Restaurant WhatsApp Action */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
                <a
                  href={getWhatsAppLink(activeOrder)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:flex-1 py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition shadow-md"
                >
                  <MessageCircle className="w-4 h-4 fill-white" />
                  <span>Dúvidas? Falar no WhatsApp do Restaurante</span>
                </a>

                {/* Simulator Buttons for Demonstration */}
                <div className="flex gap-1 w-full sm:w-auto">
                  {activeOrder.orderStatus === 'novo' && (
                    <button
                      type="button"
                      onClick={() => updateOrderStatus(activeOrder.id, 'em_preparo')}
                      className="px-2.5 py-3 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl font-bold text-[10px] transition shrink-0"
                      title="Simular avanço para Em Preparo"
                    >
                      🍳 Iniciar Preparo
                    </button>
                  )}
                  {activeOrder.orderStatus === 'em_preparo' && (
                    <button
                      type="button"
                      onClick={() => updateOrderStatus(activeOrder.id, 'saiu_entrega', 'Roberto Motoboy')}
                      className="px-2.5 py-3 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl font-bold text-[10px] transition shrink-0"
                      title="Simular avanço para Saiu p/ Entrega"
                    >
                      🛵 Dispatch Entrega
                    </button>
                  )}
                  {activeOrder.orderStatus === 'saiu_entrega' && (
                    <button
                      type="button"
                      onClick={() => updateOrderStatus(activeOrder.id, 'concluido')}
                      className="px-2.5 py-3 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-xl font-bold text-[10px] transition shrink-0"
                      title="Simular avanço para Concluído"
                    >
                      ✅ Concluir
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex justify-between items-center">
          <span className="text-[11px] text-stone-500">
            {companyProfile.tradeName} • Cardápio Online & Pedidos Mobile
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-stone-800 text-white rounded-xl font-bold hover:bg-stone-900 transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
