import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Loader2,
  CheckCircle2,
  Clock,
  ChefHat,
  Package,
  Truck,
  Home,
  XCircle,
  RefreshCw,
  Search,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

// Página pública de acompanhamento — /acompanhar?t=<token>. Roda fora do
// AppProvider, com a chave anon, e lê só a RPC get_order_tracking (migration
// 0047), que devolve exclusivamente campos seguros (nunca telefone, endereço
// completo ou pagamento). Atualiza sozinha por polling a cada 20s.

const BITTER: React.CSSProperties = { fontFamily: "'Bitter', Georgia, 'Times New Roman', serif" };
const money = (v: number) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;
const POLL_MS = 20000;

interface TrackingItem { name: string; quantity: number }
interface Tracking {
  orderNumber: number;
  orderStatus: 'novo' | 'aceito' | 'em_preparo' | 'pronto' | 'saiu_entrega' | 'concluido' | 'cancelado';
  serviceType: 'entrega' | 'retirada' | 'consumo_local';
  createdAt: string;
  updatedAt: string;
  preparedAt: string | null;
  deliveredAt: string | null;
  customerFirstName: string;
  driverFirstName: string;
  items: TrackingItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  restaurantName: string;
  avgPrepTimeMinutes: number;
}

type Step = { key: string; label: string; icon: React.ComponentType<{ className?: string }> };

const STEPS_DELIVERY: Step[] = [
  { key: 'novo', label: 'Pedido recebido', icon: CheckCircle2 },
  { key: 'aceito', label: 'Confirmado', icon: CheckCircle2 },
  { key: 'em_preparo', label: 'Em preparo', icon: ChefHat },
  { key: 'pronto', label: 'Pronto', icon: Package },
  { key: 'saiu_entrega', label: 'Saiu para entrega', icon: Truck },
  { key: 'concluido', label: 'Entregue', icon: Home },
];

const STEPS_PICKUP: Step[] = [
  { key: 'novo', label: 'Pedido recebido', icon: CheckCircle2 },
  { key: 'aceito', label: 'Confirmado', icon: CheckCircle2 },
  { key: 'em_preparo', label: 'Em preparo', icon: ChefHat },
  { key: 'pronto', label: 'Pronto para retirada', icon: Package },
  { key: 'concluido', label: 'Concluído', icon: Home },
];

const STATUS_LINE: Record<Tracking['orderStatus'], string> = {
  novo: 'Recebemos seu pedido e ele já está na fila da cozinha.',
  aceito: 'Pedido confirmado! Já vai para o preparo.',
  em_preparo: 'Seu pedido está sendo preparado agora. 👨‍🍳',
  pronto: 'Pedido pronto!',
  saiu_entrega: 'Saiu para entrega — já está a caminho! 🛵',
  concluido: 'Pedido finalizado. Bom apetite! ☕',
  cancelado: 'Este pedido foi cancelado.',
};

export const PublicOrderTracking: React.FC = () => {
  const token = React.useMemo(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('t')?.trim() || '';
  }, []);

  const [data, setData] = useState<Tracking | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'notfound' | 'error'>('loading');
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    if (!token) { setStatus('notfound'); return; }
    if (!firstLoad.current) setRefreshing(true);
    const { data: res, error } = await supabase.rpc('get_order_tracking', { p_token: token });
    firstLoad.current = false;
    setRefreshing(false);
    if (error) { setStatus((s) => (s === 'loading' ? 'error' : s)); return; }
    if (!res) { setStatus('notfound'); return; }
    setData(res as Tracking);
    setStatus('ok');
    setLastSync(new Date());
  }, [token]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [load]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#f6efe4] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#9c4a17] animate-spin" />
      </div>
    );
  }

  if (status === 'notfound' || status === 'error') {
    return (
      <div className="min-h-screen bg-[#f6efe4] text-[#241a12] flex items-center justify-center p-6" style={{ fontFamily: 'Karla, system-ui, sans-serif' }}>
        <div className="max-w-sm w-full bg-white border border-[#ece0cd] rounded-3xl p-8 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-[#f0e2cd] text-[#9c4a17] flex items-center justify-center mx-auto">
            <Search className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold" style={BITTER}>Pedido não encontrado</h1>
          <p className="text-sm text-[#7d6c58]">
            {status === 'error'
              ? 'Não foi possível carregar o pedido agora. Tente novamente em instantes.'
              : 'O link de acompanhamento parece inválido ou expirou. Confira se copiou o endereço completo da mensagem.'}
          </p>
          <a href="/pedir" className="inline-block mt-2 text-sm font-bold text-[#9c4a17] underline underline-offset-2">
            Ir para o cardápio
          </a>
        </div>
      </div>
    );
  }

  const t = data!;
  const cancelled = t.orderStatus === 'cancelado';
  const steps = t.serviceType === 'entrega' ? STEPS_DELIVERY : STEPS_PICKUP;
  const currentIdx = cancelled ? -1 : Math.max(0, steps.findIndex((s) => s.key === t.orderStatus));

  return (
    <div className="min-h-screen bg-[#f6efe4] text-[#241a12] pb-16" style={{ fontFamily: 'Karla, system-ui, sans-serif' }}>
      <header className="bg-[linear-gradient(180deg,#241a12_0%,#100a06_100%)] text-[#f6efe4] px-5 pt-7 pb-8 rounded-b-[26px]">
        <div className="max-w-[560px] mx-auto">
          <p className="text-[12px] tracking-[0.14em] text-[#c9b8a2] uppercase">{t.restaurantName}</p>
          <h1 className="text-[26px] font-extrabold mt-1" style={BITTER}>
            Pedido #{t.orderNumber}
          </h1>
          <p className="text-[13.5px] text-[#c9b8a2] mt-1">
            {t.customerFirstName ? `Olá, ${t.customerFirstName}. ` : ''}Feito às {t.createdAt ? new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
          </p>
        </div>
      </header>

      <main className="max-w-[560px] mx-auto px-5 -mt-4 space-y-4">
        {/* Card de status atual */}
        <div className={`rounded-2xl border p-4 ${cancelled ? 'bg-[#fbeaea] border-[#e6b8b8]' : 'bg-white border-[#ece0cd]'}`}>
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cancelled ? 'bg-[#5b2323] text-[#f3c9c9]' : 'bg-[#9c4a17] text-white'}`}>
              {cancelled ? <XCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-[15px]" style={BITTER}>
                {cancelled ? 'Pedido cancelado' : steps[currentIdx]?.label}
              </p>
              <p className="text-[13px] text-[#7d6c58] leading-snug mt-0.5">{STATUS_LINE[t.orderStatus]}</p>
              {!cancelled && t.orderStatus === 'saiu_entrega' && t.driverFirstName && (
                <p className="text-[13px] text-[#241a12] mt-1">Entregador: <strong>{t.driverFirstName}</strong></p>
              )}
              {!cancelled && (t.orderStatus === 'novo' || t.orderStatus === 'aceito' || t.orderStatus === 'em_preparo') && t.avgPrepTimeMinutes > 0 && (
                <p className="text-[12px] text-[#9d8b76] mt-1">Preparo médio ~{t.avgPrepTimeMinutes} min</p>
              )}
            </div>
          </div>
        </div>

        {/* Stepper vertical */}
        {!cancelled && (
          <div className="bg-white border border-[#ece0cd] rounded-2xl p-4">
            <ol className="space-y-0">
              {steps.map((s, i) => {
                const done = i < currentIdx;
                const active = i === currentIdx;
                const Icon = s.icon;
                return (
                  <li key={s.key} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 ${
                        done ? 'bg-emerald-600 border-emerald-600 text-white'
                        : active ? 'bg-[#9c4a17] border-[#9c4a17] text-white'
                        : 'bg-white border-[#e0d2ba] text-[#c9b8a2]'
                      }`}>
                        {done ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                      </div>
                      {i < steps.length - 1 && (
                        <span className={`w-0.5 flex-1 min-h-[26px] ${i < currentIdx ? 'bg-emerald-600' : 'bg-[#e4d7c2]'}`} />
                      )}
                    </div>
                    <div className={`pb-5 pt-1 ${active ? 'font-bold text-[#241a12]' : done ? 'text-[#7d6c58]' : 'text-[#a4907a]'}`}>
                      <p className="text-[14px] leading-none">{s.label}</p>
                      {s.key === 'pronto' && t.preparedAt && i <= currentIdx && (
                        <p className="text-[11px] text-[#9d8b76] mt-1">às {t.preparedAt}</p>
                      )}
                      {s.key === 'concluido' && t.deliveredAt && i <= currentIdx && (
                        <p className="text-[11px] text-[#9d8b76] mt-1">às {t.deliveredAt}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {/* Itens */}
        {t.items.length > 0 && (
          <div className="bg-white border border-[#ece0cd] rounded-2xl p-4">
            <h2 className="text-[12px] font-bold uppercase tracking-wider text-[#9c4a17] mb-2.5">Itens do pedido</h2>
            <ul className="space-y-1.5">
              {t.items.map((it, i) => (
                <li key={i} className="flex justify-between text-[13.5px] text-[#3d3226]">
                  <span>{it.quantity}x {it.name}</span>
                </li>
              ))}
            </ul>
            <div className="border-t border-[#e4d7c2] mt-3 pt-3 space-y-1 text-[13px] text-[#7d6c58]">
              <div className="flex justify-between"><span>Subtotal</span><span>{money(t.subtotal)}</span></div>
              {t.serviceType === 'entrega' && (
                <div className="flex justify-between"><span>Entrega</span><span>{money(t.deliveryFee)}</span></div>
              )}
              <div className="flex justify-between font-bold text-[#241a12] text-[14px]"><span>Total</span><span>{money(t.total)}</span></div>
            </div>
          </div>
        )}

        {/* Rodapé de atualização */}
        <div className="flex items-center justify-between text-[12px] text-[#9d8b76] px-1">
          <span>
            {refreshing ? 'Atualizando…' : lastSync ? `Atualizado às ${lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}
            {' · atualiza sozinho'}
          </span>
          <button onClick={load} className="flex items-center gap-1 font-bold text-[#9c4a17] hover:text-[#6d3110]">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>

        <p className="text-center text-[12px] text-[#a4907a] pt-2">
          Dúvidas sobre o pedido? Fale com o restaurante pelo WhatsApp.
        </p>
      </main>
    </div>
  );
};

export default PublicOrderTracking;
