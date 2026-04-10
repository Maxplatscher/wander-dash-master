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
    icon: 'bg-primary/10 text-primary',
    border: 'border-l-primary/60',
    glow: 'hover:shadow-primary/5',
  },
  success: {
    icon: 'bg-emerald-500/10 text-emerald-500',
    border: 'border-l-emerald-500/60',
    glow: 'hover:shadow-emerald-500/5',
  },
  warning: {
    icon: 'bg-amber-500/10 text-amber-500',
    border: 'border-l-amber-500/60',
    glow: 'hover:shadow-amber-500/5',
  },
  destructive: {
    icon: 'bg-red-500/10 text-red-500',
    border: 'border-l-destructive/60',
    glow: 'hover:shadow-red-500/5',
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

export function KpiCard({ icon: Icon, label, value, subtitle, variant = 'default', pulse }: KpiCardProps) {
  const styles = variantStyles[variant];
  const isNumber = typeof value === 'number';

  return (
    <div className={cn(
      'rounded-xl border border-border bg-card p-5 flex flex-col gap-3 border-l-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg',
      styles.border,
      styles.glow,
    )}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
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
