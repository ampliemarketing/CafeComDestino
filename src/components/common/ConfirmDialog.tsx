// Modal genérico que substitui window.confirm()/window.alert() nativos —
// controlado via AppContext (confirmDialog/alertDialog), montado uma única vez
// na raiz do app (ver App.tsx), igual ao NotificationToast.

import React from 'react';
import { useApp } from '../../context/AppContext';
import { AlertTriangle, Info } from 'lucide-react';

const VARIANT_STYLE = {
  danger: { iconBg: 'bg-rose-100 text-rose-700', confirmBtn: 'bg-rose-600 hover:bg-rose-700' },
  warning: { iconBg: 'bg-amber-100 text-amber-700', confirmBtn: 'bg-amber-800 hover:bg-amber-900' },
  info: { iconBg: 'bg-sky-100 text-sky-700', confirmBtn: 'bg-amber-800 hover:bg-amber-900' },
} as const;

export const ConfirmDialog: React.FC = () => {
  const { confirmState, resolveConfirm } = useApp();

  if (!confirmState) return null;

  const { title, message, confirmLabel, cancelLabel, variant, mode } = confirmState;
  const style = VARIANT_STYLE[variant];
  const Icon = variant === 'info' ? Info : AlertTriangle;

  return (
    <div className="fixed inset-0 z-[100] bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-stone-200">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${style.iconBg}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-stone-900 text-sm">{title}</h3>
            <p className="text-xs text-stone-500 mt-1 whitespace-pre-line">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          {mode === 'confirm' && (
            <button
              onClick={() => resolveConfirm(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 border border-stone-200"
            >
              {cancelLabel}
            </button>
          )}
          <button
            onClick={() => resolveConfirm(true)}
            className={`px-4 py-2 rounded-xl text-xs font-bold text-white ${style.confirmBtn}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
