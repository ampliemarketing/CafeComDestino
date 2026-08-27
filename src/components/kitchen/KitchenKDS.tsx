import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ChefHat,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Send,
  Flame,
  BellRing,
  Utensils,
  Truck,
  Check,
  X,
  Volume2,
  ChevronDown
} from 'lucide-react';
import { OrderStatus } from '../../types';
import { hasPermission } from '../../lib/permissions';

export const KitchenKDS: React.FC = () => {
  const { orders, updateOrderStatus, addToast, currentUser } = useApp();
  const canAdvance = hasPermission(currentUser, 'kitchen.avancar_status');
  const canCallSupport = hasPermission(currentUser, 'kitchen.chamar_apoio');
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());

  const togglePin = (orderId: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const columns: { status: OrderStatus; title: string; color: string }[] = [
    { status: 'novo', title: 'Novos Recebidos', color: 'border-blue-500 bg-blue-50 text-blue-950' },
    { status: 'aceito', title: 'Aceitos na Fila', color: 'border-amber-500 bg-amber-50 text-amber-950' },
    { status: 'em_preparo', title: 'Em Preparo', color: 'border-orange-500 bg-orange-50 text-orange-950' },
    { status: 'pronto', title: 'Prontos para Expedição', color: 'border-emerald-500 bg-emerald-50 text-emerald-950' },
  ];

  const handleAdvanceStatus = (orderId: string, currentStatus: OrderStatus) => {
    let nextStatus: OrderStatus = 'aceito';
    if (currentStatus === 'novo') nextStatus = 'aceito';
    else if (currentStatus === 'aceito') nextStatus = 'em_preparo';
    else if (currentStatus === 'em_preparo') nextStatus = 'pronto';
    else if (currentStatus === 'pronto') nextStatus = 'concluido';

    updateOrderStatus(orderId, nextStatus);
    addToast('success', 'Pedido Atualizado', `Status alterado para ${nextStatus.toUpperCase()}`);
  };

  const notifyWaiterHelp = (orderNumber: number) => {
    addToast('warning', 'Alerta da Cozinha', `Cozinha solicitou apoio no Pedido #${orderNumber}`);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto min-h-screen bg-[#F6F1EA]">
      {/* Header Banner */}
      <div className="bg-stone-900 text-stone-100 p-5 rounded-2xl border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-700 text-white font-bold flex items-center justify-center shadow">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">KDS • Painel da Cozinha</h2>
              <span className="text-[10px] bg-amber-900 text-amber-300 font-bold px-2 py-0.5 rounded border border-amber-800">
                Monitor em Tempo Real
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              Gestão visual de comandas, tempos de preparo e notificações ao garçom.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-stone-800 px-3 py-1.5 rounded-xl border border-stone-700 text-xs text-stone-300 flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-emerald-400" />
            <span>Alerta Sonoro Ativo</span>
          </div>
        </div>
      </div>

      {/* KDS Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
        {columns.map((col) => {
          const colOrders = orders.filter((o) => o.orderStatus === col.status);

          return (
            <div key={col.status} className="bg-stone-200/80 p-3 rounded-2xl border border-stone-300 space-y-3 min-h-[600px]">
              {/* Column Header */}
              <div className={`p-3 rounded-xl border font-bold text-xs flex items-center justify-between ${col.color}`}>
                <span>{col.title}</span>
                <span className="bg-stone-900 text-white text-[11px] px-2 py-0.5 rounded-full font-bold">
                  {colOrders.length}
                </span>
              </div>

              {/* Order Cards List */}
              <div className="space-y-3">
                {colOrders.length === 0 ? (
                  <p className="text-stone-400 text-xs py-8 text-center font-medium">Nenhum pedido nesta etapa</p>
                ) : (
                  colOrders.map((ord) => {
                    const isDelayed = ord.orderStatus === 'em_preparo'; // Highlight delayed prep
                    const isPinned = pinnedIds.has(ord.id);

                    return (
                      <div
                        key={ord.id}
                        className={`group bg-white rounded-2xl border-2 shadow-sm transition ${
                          isDelayed ? 'border-amber-600 bg-amber-50/20' : 'border-stone-200 hover:border-stone-400'
                        }`}
                      >
                        {/* Summary bar — always visible; click pins the card open */}
                        <div
                          onClick={() => togglePin(ord.id)}
                          className="p-4 flex items-start justify-between gap-2 cursor-pointer select-none"
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-base text-stone-900">#{ord.orderNumber}</span>
                              <span className="text-[10px] bg-stone-100 text-stone-700 font-bold px-1.5 py-0.5 rounded border uppercase">
                                {ord.channel}
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-stone-700 mt-0.5">
                              {ord.tableNumber ? `Mesa #${ord.tableNumber}` : ord.customer.name}
                            </p>
                          </div>
                          <div className="text-right flex flex-col items-end gap-1 shrink-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-stone-600 flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-amber-700" />
                                <span>{ord.createdAt}</span>
                              </span>
                              <ChevronDown
                                className={`w-4 h-4 text-stone-400 transition-transform duration-300 ${
                                  isPinned ? 'rotate-180 text-amber-700' : 'group-hover:rotate-180'
                                }`}
                              />
                            </div>
                            {isDelayed && (
                              <span className="text-[9px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded border border-rose-300">
                                ATENÇÃO DE PREPARO
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Expandable detail — opens on hover, stays open when pinned */}
                        <div
                          className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                            isPinned ? 'grid-rows-[1fr]' : 'grid-rows-[0fr] group-hover:grid-rows-[1fr]'
                          }`}
                        >
                          <div className="overflow-hidden">
                            <div className="px-4 pb-4 pt-3 border-t space-y-3">
                              {/* Order Items List */}
                              <div className="space-y-2 text-xs">
                                {ord.items.map((item, idx) => (
                                  <div key={idx} className="bg-stone-50 p-2 rounded-xl border border-stone-200 space-y-1">
                                    <div className="flex justify-between font-bold text-stone-900">
                                      <span>{item.quantity}x {item.productName}</span>
                                    </div>
                                    {item.additions && item.additions.map((a) => (
                                      <p key={a.id} className="text-[10px] text-stone-500 pl-2">+ {a.name}</p>
                                    ))}
                                    {item.notes && (
                                      <p className="text-[10px] text-rose-700 bg-rose-50 p-1 rounded font-bold border border-rose-200">
                                        ⚠️ OBS: {item.notes}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>

                              {ord.notes && (
                                <p className="text-[10px] text-amber-800 italic bg-amber-50 p-1.5 rounded border border-amber-200">
                                  Obs do Pedido: {ord.notes}
                                </p>
                              )}

                              {/* Kitchen Action Buttons */}
                              <div className="pt-2 border-t flex flex-col gap-1.5">
                                {canAdvance && (
                                <button
                                  onClick={() => handleAdvanceStatus(ord.id, ord.orderStatus)}
                                  className="w-full bg-amber-800 hover:bg-amber-900 text-white py-2 rounded-xl text-xs font-bold shadow flex items-center justify-center gap-1.5"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                  <span>
                                    {ord.orderStatus === 'novo' && 'Aceitar Pedido'}
                                    {ord.orderStatus === 'aceito' && 'Iniciar Preparo'}
                                    {ord.orderStatus === 'em_preparo' && 'Marcar como PRONTO!'}
                                    {ord.orderStatus === 'pronto' && 'Concluir Expedição'}
                                  </span>
                                </button>
                                )}

                                {canCallSupport && (
                                <button
                                  onClick={() => notifyWaiterHelp(ord.orderNumber)}
                                  className="w-full bg-stone-100 hover:bg-stone-200 text-stone-700 py-1.5 rounded-xl text-[11px] font-semibold border border-stone-300 flex items-center justify-center gap-1"
                                >
                                  <BellRing className="w-3.5 h-3.5 text-amber-700" />
                                  <span>Chamar Garçom / Suporte</span>
                                </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
