import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Truck, MapPin, Search, CheckCircle2, Clock } from 'lucide-react';
import { hasPermission } from '../../lib/permissions';

export const DeliveryManagement: React.FC = () => {
  const { orders, updateOrderStatus, addToast, currentUser } = useApp();
  const canDispatch = hasPermission(currentUser, 'entregas.despachar');

  const [searchQuery, setSearchQuery] = useState('');

  const deliveryOrders = orders.filter(
    (o) =>
      (o.channel === 'online' || o.channel === 'whatsapp' || o.channel === 'telefone') &&
      o.serviceType === 'entrega' &&
      o.orderStatus !== 'concluido' &&
      o.orderStatus !== 'cancelado'
  );

  const query = searchQuery.trim().toLowerCase();
  const filtered = query
    ? deliveryOrders.filter(
        (o) =>
          o.customer.name.toLowerCase().includes(query) ||
          String(o.orderNumber).includes(query) ||
          (o.customer.address?.neighborhood || '').toLowerCase().includes(query)
      )
    : deliveryOrders;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-stone-900 text-stone-100 p-5 rounded-2xl border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-800 text-white font-bold flex items-center justify-center shadow">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Gestão de Entregas</h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Fila de pedidos de delivery. Ao despachar, o cliente é avisado no WhatsApp que o pedido saiu para entrega.
            </p>
          </div>
        </div>

        <div className="bg-stone-800 px-3 py-1.5 rounded-xl border border-stone-700 text-xs">
          <span className="text-stone-400">Na fila: </span>
          <strong className="text-emerald-400 font-bold">{deliveryOrders.length}</strong>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-xl px-3.5 py-2.5 shadow-sm">
        <Search className="w-4 h-4 text-stone-400 shrink-0" />
        <input
          type="text"
          maxLength={60}
          placeholder="Buscar por cliente, nº do pedido ou bairro..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value.slice(0, 60))}
          className="flex-1 bg-transparent border-0 outline-none text-sm text-stone-800 placeholder:text-stone-400"
        />
      </div>

      {/* Orders List */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-4">
        <h3 className="font-bold text-stone-900 text-sm">Fila de Pedidos para Delivery</h3>

        {filtered.length === 0 ? (
          <p className="text-stone-400 text-xs py-10 text-center font-medium">
            Nenhum pedido de entrega na fila.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((ord) => {
              const dispatched = ord.orderStatus === 'saiu_entrega';
              return (
                <div key={ord.id} className="p-4 bg-stone-50 rounded-2xl border space-y-3">
                  <div className="flex items-start justify-between border-b pb-2">
                    <div>
                      <span className="font-bold text-sm text-stone-900">Pedido #{ord.orderNumber}</span>
                      <p className="text-xs font-semibold text-stone-700">
                        {ord.customer.name} ({ord.customer.phone})
                      </p>
                    </div>
                    <span
                      className={`font-bold text-[10px] px-2 py-0.5 rounded uppercase ${
                        dispatched ? 'bg-emerald-600 text-white' : 'bg-amber-800 text-white'
                      }`}
                    >
                      {ord.orderStatus.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="text-xs text-stone-600 space-y-1">
                    <p className="flex items-center gap-1.5 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-amber-800 shrink-0" />
                      <span>
                        {ord.customer.address
                          ? `${ord.customer.address.street}, ${ord.customer.address.number} - ${ord.customer.address.neighborhood}`
                          : 'Endereço não informado'}
                      </span>
                    </p>
                    {ord.customer.address?.reference && (
                      <p className="text-[11px] text-stone-500 pl-5">Ref.: {ord.customer.address.reference}</p>
                    )}
                    <p className="font-bold text-amber-900">
                      Total: R$ {ord.total.toFixed(2)} ({ord.paymentMethod})
                    </p>
                  </div>

                  <div className="pt-2 border-t">
                    {dispatched ? (
                      <p className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 py-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Despachado — cliente notificado
                      </p>
                    ) : (
                      <button
                        onClick={() => {
                          updateOrderStatus(ord.id, 'saiu_entrega');
                          addToast('success', 'Despachado!', `Pedido #${ord.orderNumber} saiu para entrega.`);
                        }}
                        disabled={!canDispatch}
                        className="w-full bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-2.5 rounded-xl text-xs font-bold shadow flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <Truck className="w-4 h-4" />
                        Despachar para entrega
                      </button>
                    )}
                    {!canDispatch && (
                      <p className="flex items-center justify-center gap-1 text-[10px] text-stone-400 mt-1.5">
                        <Clock className="w-3 h-3" />
                        Sem permissão para despachar
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
