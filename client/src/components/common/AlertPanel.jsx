import React from 'react';
import { AlertTriangle, AlertCircle, Info, CheckCircle2, X } from 'lucide-react';

export default function AlertPanel({
  title,
  message,
  variant = 'warning', // 'critical' | 'warning' | 'info' | 'success'
  onClose,
  children,
  className = '',
}) {
  const styles = {
    critical: {
      container: 'bg-[#FEF2F2] border-[#FEE2E2] text-[#991B1B]',
      icon: AlertCircle,
      iconColor: 'text-[#DC2626]',
    },
    warning: {
      container: 'bg-[#FFFBEB] border-[#FEF3C7] text-[#92400E]',
      icon: AlertTriangle,
      iconColor: 'text-[#D97706]',
    },
    info: {
      container: 'bg-[#EFF6FF] border-[#DBEAFE] text-[#1E40AF]',
      icon: Info,
      iconColor: 'text-[#2563EB]',
    },
    success: {
      container: 'bg-[#F0FDF4] border-[#DCFCE7] text-[#166534]',
      icon: CheckCircle2,
      iconColor: 'text-[#16A34A]',
    },
  };

  const current = styles[variant] || styles.warning;
  const IconComponent = current.icon;

  return (
    <div className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${current.container} ${className}`}>
      <IconComponent className={`w-5 h-5 flex-shrink-0 mt-0.5 ${current.iconColor}`} />
      <div className="flex-1 text-xs">
        {title && <h4 className="font-semibold text-sm mb-1">{title}</h4>}
        {message && <p className="opacity-90 leading-relaxed">{message}</p>}
        {children && <div className="mt-2">{children}</div>}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 transition-colors p-1"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
