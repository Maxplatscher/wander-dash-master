import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';

interface KpiCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subtitle?: string;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
  pulse?: boolean;
  onClick?: () => void;
}

const variantStyles = {
  default: {
    icon: 'bg-gradient-to-br from-primary/15 to-primary-glow/10 text-primary',
    card: 'from-card to-accent/20',
    border: 'border-l-primary/50',
    shadow: 'hover:shadow-[0_8px_25px_-5px_hsl(var(--primary)/0.12)]',
  },
  success: {
    icon: 'bg-gradient-to-br from-emerald-500/15 to-emerald-400/10 text-emerald-500',
    card: 'from-card to-emerald-50/30',
    border: 'border-l-emerald-500/50',
    shadow: 'hover:shadow-[0_8px_25px_-5px_rgba(16,185,129,0.12)]',
  },
  warning: {
    icon: 'bg-gradient-to-br from-amber-500/15 to-amber-400/10 text-amber-500',
    card: 'from-card to-amber-50/30',
    border: 'border-l-amber-500/50',
    shadow: 'hover:shadow-[0_8px_25px_-5px_rgba(245,158,11,0.12)]',
  },
  destructive: {
    icon: 'bg-gradient-to-br from-red-500/15 to-red-400/10 text-red-500',
    card: 'from-card to-red-50/30',
    border: 'border-l-destructive/50',
    shadow: 'hover:shadow-[0_8px_25px_-5px_rgba(239,68,68,0.12)]',
  },
};

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number>();

  useEffect(() => {
    const duration = 600;
    const start = performance.now();
    const from = 0;
    const to = value;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) ref.current = requestAnimationFrame(tick);
    };

    ref.current = requestAnimationFrame(tick);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [value]);

  return <>{display}</>;
}

export function KpiCard({ icon: Icon, label, value, subtitle, variant = 'default', pulse, onClick }: KpiCardProps) {
  const styles = variantStyles[variant];
  const isNumber = typeof value === 'number';

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter') onClick(); } : undefined}
      className={cn(
        'glass-card p-5 flex flex-col gap-3 border-l-4 transition-all duration-300 hover:-translate-y-1',
        styles.border,
        styles.shadow,
        onClick && 'cursor-pointer',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className="relative">
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', styles.icon)}>
            <Icon className="w-5 h-5" />
          </div>
          {pulse && (
            <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
          )}
        </div>
      </div>
      <div>
        <p className="text-3xl font-extrabold text-card-foreground tracking-tight">
          {isNumber ? <AnimatedNumber value={value as number} /> : value}
        </p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}
