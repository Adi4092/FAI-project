import React from 'react';

export default function Badge({
  children,
  variant = 'neutral', // 'success' | 'warning' | 'critical' | 'info' | 'neutral'
  status, // optional shorthand: 'healthy', 'expiring', 'expired', 'low_stock', etc.
  className = '',
  dot = false,
}) {
  let mappedVariant = variant;

  if (status) {
    const s = String(status).toLowerCase();
    if (['healthy', 'active', 'approved', 'received'].includes(s)) {
      mappedVariant = 'success';
    } else if (['expiring', 'expiring soon', 'warning', 'medium', 'low stock', 'low_stock', 'adjusted', 'partially_received', 'pending'].includes(s)) {
      mappedVariant = 'warning';
    } else if (['expired', 'critical', 'high', 'rejected', 'cancelled', 'stockout'].includes(s)) {
      mappedVariant = 'critical';
    } else if (['info', 'draft', 'dispensed', 'receipt'].includes(s)) {
      mappedVariant = 'info';
    } else {
      mappedVariant = 'neutral';
    }
  }

  const styles = {
    success: 'bg-[#DCFCE7] text-[#15803D]',
    warning: 'bg-[#FEF3C7] text-[#B45309]',
    critical: 'bg-[#FEE2E2] text-[#B91C1C]',
    info: 'bg-[#DBEAFE] text-[#1E40AF]',
    neutral: 'bg-slate-100 text-slate-700',
  };

  const dotColors = {
    success: 'bg-[#16A34A]',
    warning: 'bg-[#F59E0B]',
    critical: 'bg-[#DC2626]',
    info: 'bg-[#1D4ED8]',
    neutral: 'bg-slate-500',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[6px] text-xs font-semibold tracking-wide ${styles[mappedVariant] || styles.neutral} ${className}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[mappedVariant]}`} />}
      {children}
    </span>
  );
}
