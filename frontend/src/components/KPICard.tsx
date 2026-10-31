import React from 'react';
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    positive: boolean;
  };
  highlight?: boolean;
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  highlight = false,
}) => {
  return (
    <div
      className={`relative overflow-hidden p-5 rounded-xl border transition-all duration-200 ${
        highlight
          ? 'bg-gradient-to-br from-brand-600 to-brand-800 text-white border-brand-500 shadow-md shadow-brand-500/10'
          : 'bg-white dark:bg-charcoal-900 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md'
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-xs font-semibold tracking-wider uppercase ${highlight ? 'text-brand-100' : 'text-slate-500 dark:text-slate-400'}`}>
            {title}
          </p>
          <h3 className={`mt-2 text-2xl font-bold font-mono tabular-nums tracking-tight ${highlight ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
            {value}
          </h3>
          {(subtitle || trend) && (
            <div className="mt-2 flex items-center gap-2 text-xs">
              {trend && (
                <span
                  className={`font-semibold px-1.5 py-0.5 rounded ${
                    highlight
                      ? 'bg-white/20 text-white'
                      : trend.positive
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                  }`}
                >
                  {trend.positive ? '↑' : '↓'} {trend.value}
                </span>
              )}
              {subtitle && (
                <span className={highlight ? 'text-brand-100' : 'text-slate-500 dark:text-slate-400'}>
                  {subtitle}
                </span>
              )}
            </div>
          )}
        </div>
        <div
          className={`p-3 rounded-lg ${
            highlight
              ? 'bg-white/10 text-white'
              : 'bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400'
          }`}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};
