import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Truck, 
  MapPin, 
  UserCheck, 
  Clock, 
  CheckCircle2, 
  Search, 
  Phone, 
  Navigation,
  Sparkles
} from 'lucide-react';
import { Order } from '../../types';

export const DeliveryManagement: React.FC = () => {
  const { orders, drivers, assignDriverToOrder, updateOrderStatus, addToast } = useApp();

  const [searchQuery, setSearchQuery] = useState('');

  const deliveryOrders = orders.filter(
    (o) => o.channel === 'online' || o.channel === 'whatsapp' || o.channel === 'telefone'
  );

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-stone-900 text-stone-100 p-5 rounded-2xl border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-800 text-white font-bold flex items-center justify-center shadow">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Gestão de Entregas & Entregadores</h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Rastreamento em tempo real de pedidos de delivery, atribuição de motoboys e rotas.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-stone-800 px-3 py-1.5 rounded-xl border border-stone-700 text-xs">
            <span className="text-stone-400">Motoboys Ativos: </span>
            <strong className="text-emerald-400 font-bold">{drivers.filter((d) => d.available).length} disponíveis</strong>
          </div>
        </div>
      </div>

      {/* Driver List Horizontal */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-2">
        <h3 className="font-bold text-stone-900 text-xs uppercase tracking-wider">Equipe de Motoboys / Entregadores</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {drivers.map((d) => (
            <div key={d.id} className="p-3 bg-stone-50 rounded-xl border flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <p className="font-bold text-stone-900">{d.name}</p>
                <p className="text-[10px] text-stone-500">{d.vehicle} ({d.plate}) • {d.phone}</p>
              </div>
              <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                d.available ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {d.available ? 'Disponível' : 'Em Rota'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Orders List */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-4">
        <h3 className="font-bold text-stone-900 text-sm">Fila de Pedidos para Delivery</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {deliveryOrders.map((ord) => (
            <div key={ord.id} className="p-4 bg-stone-50 rounded-2xl border space-y-3">
              <div className="flex items-start justify-between border-b pb-2">
                <div>
                  <span className="font-bold text-sm text-stone-900">Pedido #{ord.orderNumber}</span>
                  <p className="text-xs font-semibold text-stone-700">{ord.customer.name} ({ord.customer.phone})</p>
                </div>
                <span className="bg-amber-800 text-white font-bold text-[10px] px-2 py-0.5 rounded uppercase">
                  {ord.orderStatus}
                </span>
              </div>

              <div className="text-xs text-stone-600 space-y-1">
                <p className="flex items-center gap-1.5 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-amber-800 shrink-0" />
                  <span>
                    {ord.customer.address
                      ? `${ord.customer.address.street}, ${ord.customer.address.number} - ${ord.customer.address.neighborhood}`
                      : 'Endereço Balcão'}
                  </span>
                </p>
                <p className="font-bold text-amber-900">Total: R$ {ord.total.toFixed(2)} ({ord.paymentMethod})</p>
              </div>

              {/* Assign Motoboy & Dispatch */}
              <div className="flex items-center gap-2 pt-2 border-t">
                <select
                  value={ord.driverId || ''}
                  onChange={(e) => assignDriverToOrder(ord.id, e.target.value)}
                  className="flex-1 border rounded-xl p-2 text-xs font-semibold text-stone-800"
                >
                  <option value="">Selecione o Entregador...</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.vehicle})
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => {
                    updateOrderStatus(ord.id, 'saiu_entrega');
                    addToast('success', 'Despachado!', `Pedido #${ord.orderNumber} saiu para entrega.`);
                  }}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-2 rounded-xl text-xs font-bold shadow"
                >
                  Despachar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
