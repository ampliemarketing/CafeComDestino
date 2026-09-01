import React from 'react';
import { WifiOff } from 'lucide-react';
import { useApp } from '../../context/AppContext';

/**
 * Faixa fixa no topo quando cai a conexão com o servidor (item #10 do
 * checklist de go-live). Antes, uma queda de internet no meio do serviço
 * fazia os lançamentos falharem com um toast e o realtime ficava
 * dessincronizado sem aviso.
 *
 * Ao voltar a conexão, o AppContext re-busca as coleções operacionais
 * (mesas, pedidos, caixa, produtos) — o realtime não reenvia o que passou
 * enquanto esteve fora.
 */
export const ConnectionBanner: React.FC = () => {
  const { connectionOnline } = useApp();

  if (connectionOnline) return null;

  return (
    <div
      role="status"
      className="fixed top-0 inset-x-0 z-[60] bg-rose-700 text-white text-xs sm:text-sm font-semibold px-4 py-2 flex items-center justify-center gap-2 shadow-lg"
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>
        Sem conexão com o servidor — <strong>não lance pedidos até a faixa sumir</strong>. Tentando reconectar…
      </span>
    </div>
  );
};
