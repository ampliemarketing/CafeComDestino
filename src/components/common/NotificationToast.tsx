import React, { useEffect } from 'react';
import { useApp, Toast } from '../../context/AppContext';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

const TOAST_DURATION_MS = 3000;

const ToastItem: React.FC<{ toast: Toast; onClose: () => void }> = ({ toast, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, TOAST_DURATION_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id]);

  let bgClass = 'bg-white border-l-4 border-amber-600 text-stone-800';
  let IconComponent = Info;
  let iconColor = 'text-amber-600';

  if (toast.type === 'success') {
    bgClass = 'bg-white border-l-4 border-emerald-600 text-stone-800';
    IconComponent = CheckCircle2;
    iconColor = 'text-emerald-600';
  } else if (toast.type === 'error') {
    bgClass = 'bg-white border-l-4 border-rose-600 text-stone-800';
    IconComponent = XCircle;
    iconColor = 'text-rose-600';
  } else if (toast.type === 'warning') {
    bgClass = 'bg-white border-l-4 border-amber-500 text-stone-800';
    IconComponent = AlertTriangle;
    iconColor = 'text-amber-500';
  }

  return (
    <div
      className={`pointer-events-auto p-4 rounded-xl shadow-lg border border-stone-200 flex items-start justify-between gap-3 transition-all duration-200 ${bgClass}`}
    >
      <div className="flex items-start gap-3">
        <IconComponent className={`w-5 h-5 shrink-0 mt-0.5 ${iconColor}`} />
        <div>
          <p className="font-semibold text-sm">{toast.title}</p>
          {toast.message && <p className="text-xs text-stone-600 mt-0.5">{toast.message}</p>}
          <span className="text-[10px] text-stone-400 mt-1 block">{toast.timestamp}</span>
        </div>
      </div>
      <button onClick={onClose} className="text-stone-400 hover:text-stone-600 p-1 rounded-lg">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export const NotificationToast: React.FC = () => {
  const { toasts, removeToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-16 md:bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};
