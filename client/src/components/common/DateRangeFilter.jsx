import React from 'react';
import { Calendar } from 'lucide-react';

export default function DateRangeFilter({
  value = '30d',
  onChange,
  className = '',
}) {
  const ranges = [
    { label: '7 days', value: '7d' },
    { label: '30 days', value: '30d' },
    { label: '60 days', value: '60d' },
    { label: '90 days', value: '90d' },
  ];

  return (
    <div className={`inline-flex items-center gap-1 bg-white border border-border p-1 rounded-lg text-xs shadow-sm ${className}`}>
      <span className="px-2 text-slate-400 flex items-center gap-1.5 font-medium">
        <Calendar className="w-3.5 h-3.5" />
      </span>
      {ranges.map((r) => {
        const isActive = value === r.value;
        return (
          <button
            key={r.value}
            type="button"
            onClick={() => onChange && onChange(r.value)}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              isActive
                ? 'bg-brand text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}
