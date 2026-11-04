import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  accent?: 'pink' | 'yellow' | 'white';
  change?: string;
  changePositive?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  accent = 'pink',
  change,
  changePositive,
}) => {
  const accentBorder = {
    pink: 'hover:border-[#FF168B]/50 hover:shadow-pink-glow',
    yellow: 'hover:border-[#EFFF00]/50 hover:shadow-yellow-glow',
    white: 'hover:border-zinc-500',
  }[accent];

  const iconColor = {
    pink: 'text-[#FF168B]',
    yellow: 'text-[#EFFF00]',
    white: 'text-white',
  }[accent];

  return (
    <div
      className={`relative bg-synapse-surface border border-synapse-border p-5 rounded-none transition-all duration-300 group ${accentBorder}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-synapse-secondary font-mono">
            {title}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight font-display text-white">
              {value}
            </span>
            {change && (
              <span
                className={`text-xs font-mono font-medium ${
                  changePositive ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {change}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-1 text-xs text-synapse-muted font-sans">{subtitle}</p>
          )}
        </div>
        <div
          className={`p-2.5 rounded-sm bg-synapse-elevated border border-synapse-border/80 group-hover:scale-110 transition-transform ${iconColor}`}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {/* Editorial corner tick */}
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-synapse-pink/40" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-synapse-pink/40" />
    </div>
  );
};

