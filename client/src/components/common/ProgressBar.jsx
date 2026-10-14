import React from 'react';

export default function ProgressBar({
  value = 0,
  max = 100,
  label,
  valueText,
  color = 'bg-brand', // e.g. 'bg-status-success', 'bg-status-warning', 'bg-brand'
  height = 'h-2.5',
  className = '',
}) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={`w-full ${className}`}>
      {(label || valueText) && (
        <div className="flex justify-between items-center text-xs mb-1.5 font-medium">
          {label && <span className="text-slate-600">{label}</span>}
          {valueText && <span className="text-slate-900 font-semibold">{valueText}</span>}
        </div>
      )}
      <div className={`w-full bg-slate-100 rounded-full overflow-hidden ${height}`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
