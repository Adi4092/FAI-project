import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function KpiCard({
  title,
  value,
  change,
  changeType = 'increase', // 'increase' | 'decrease' | 'neutral'
  changeLabel = 'from last month',
  icon: Icon,
  iconColor = 'text-brand',
  iconBg = 'bg-brand/10',
  className = '',
}) {
  const isPositive = changeType === 'increase';
  const isNegative = changeType === 'decrease';

  return (
    <div className={`card-base p-5 flex flex-col justify-between ${className}`}>
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{value}</div>
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-full ${iconBg} ${iconColor} flex items-center justify-center`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      {change !== undefined && change !== null && (
        <div className="flex items-center gap-1.5 mt-3 text-xs">
          {isPositive ? (
            <span className="text-status-success font-semibold flex items-center gap-0.5">
              <TrendingUp className="w-3.5 h-3.5" />
              {change > 0 ? `+${change}%` : `${change}%`}
            </span>
          ) : isNegative ? (
            <span className="text-status-critical font-semibold flex items-center gap-0.5">
              <TrendingDown className="w-3.5 h-3.5" />
              {change > 0 ? `-${change}%` : `${change}%`}
            </span>
          ) : (
            <span className="text-slate-500 font-medium">{change}%</span>
          )}
          <span className="text-slate-400">{changeLabel}</span>
        </div>
      )}
    </div>
  );
}
