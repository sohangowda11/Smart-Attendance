import React from 'react';

interface BadgeProps {
  label: string;
  variant?: 'pink' | 'yellow' | 'green' | 'red' | 'gray' | 'blue';
  size?: 'sm' | 'md';
  pulse?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'gray',
  size = 'md',
  pulse = false,
}) => {
  const variantStyles = {
    pink: 'bg-[#FF168B]/15 text-[#FF168B] border-[#FF168B]/40',
    yellow: 'bg-[#EFFF00]/15 text-[#EFFF00] border-[#EFFF00]/40',
    green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    red: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    blue: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    gray: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  };

  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 tracking-wider',
    md: 'text-xs px-2.5 py-1 tracking-wide',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono uppercase font-semibold border rounded-sm ${variantStyles[variant]} ${sizeStyles[size]}`}
    >
      {pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current"></span>
        </span>
      )}
      {label}
    </span>
  );
};

