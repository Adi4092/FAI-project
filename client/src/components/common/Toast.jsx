import React from 'react';
import { useToast } from '../../context/ToastContext';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function Toast() {
  const { toasts, removeToast } = useToast();

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error' || toast.type === 'critical';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between p-3.5 rounded-lg shadow-modal border bg-white transition-all transform animate-in fade-in slide-in-from-bottom-2 duration-200 ${
              isSuccess
                ? 'border-[#DCFCE7] text-[#15803D]'
                : isError
                ? 'border-[#FEE2E2] text-[#B91C1C]'
                : 'border-border text-slate-800'
            }`}
          >
            <div className="flex items-center gap-2.5 text-xs font-medium">
              {isSuccess ? (
                <CheckCircle2 className="w-4 h-4 text-status-success flex-shrink-0" />
              ) : isError ? (
                <AlertCircle className="w-4 h-4 text-status-critical flex-shrink-0" />
              ) : (
                <Info className="w-4 h-4 text-brand flex-shrink-0" />
              )}
              <span>{toast.message}</span>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
