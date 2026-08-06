import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDispatch } from '@/lib/dispatch-context';
import { ChevronLeft, ChevronRight, Loader2, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

type ViewMode = '1d' | '7d' | 'month' | 'year';

function fmt(d: Date) {
  return d.toISOString().split('T')[0];
}

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Mon=0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function useShipmentsRange(from: Date, to: Date, depotId: string | null) {
  return useQuery({
    queryKey: ['shipments-range', fmt(from), fmt(to), depotId],
    queryFn: async () => {
      let query = supabase
        .from('shipment')
        .select('id, name, customer_name, delivery_address, service_date')
        .gte('service_date', fmt(from))
        .lte('service_date', fmt(to))
        .order('service_date');
      if (depotId) query = query.eq('depot_id', depotId);
      const { data } = await query;
      return data ?? [];
    },
  });
}

export function OrdersCalendar() {
  const { selectedDate, setSelectedDate, selectedDepotId } = useDispatch();
  const [view, setView] = useState<ViewMode>('7d');
  const [anchor, setAnchor] = useState(new Date());

  const range = useMemo(() => {
    if (view === '1d') return { from: anchor, to: anchor };
    if (view === '7d') {
      const from = startOfWeek(anchor);
      const to = new Date(from);
      to.setDate(from.getDate() + 6);
      return { from, to };
    }
    if (view === 'month') return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
    return { from: new Date(anchor.getFullYear(), 0, 1), to: new Date(anchor.getFullYear(), 11, 31) };
  }, [view, anchor]);

  const { data: shipments, isLoading } = useShipmentsRange(range.from, range.to, selectedDepotId);

  const grouped = useMemo(() => {
    const m = new Map<string, typeof shipments>();
    (shipments ?? []).forEach(s => {
      if (!s.service_date) return;
      const arr = m.get(s.service_date) ?? [];
      arr.push(s);
      m.set(s.service_date, arr);
    });
    return m;
  }, [shipments]);

  const shift = (dir: 1 | -1) => {
    const d = new Date(anchor);
    if (view === '1d') d.setDate(d.getDate() + dir);
    else if (view === '7d') d.setDate(d.getDate() + 7 * dir);
    else if (view === 'month') d.setMonth(d.getMonth() + dir);
    else d.setFullYear(d.getFullYear() + dir);
    setAnchor(d);
  };

  const title = useMemo(() => {
    if (view === '1d') return anchor.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    if (view === '7d') {
      const f = startOfWeek(anchor);
      const t = new Date(f); t.setDate(f.getDate() + 6);
      return `${f.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })} – ${t.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    }
    if (view === 'month') return anchor.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    return String(anchor.getFullYear());
  }, [view, anchor]);

  const tabs: { id: ViewMode; label: string }[] = [
    { id: '1d', label: '1 Tag' },
    { id: '7d', label: '7 Tage' },
    { id: 'month', label: 'Monat' },
    { id: 'year', label: 'Jahr' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Aufträge</h3>
        <div className="flex items-center gap-1 rounded-full bg-white/5 p-1 backdrop-blur-md">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setView(t.id)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-full transition-all',
                view === t.id ? 'bg-white/15 text-foreground shadow' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Nav */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => shift(-1)} className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-medium text-foreground capitalize">{title}</span>
        <button onClick={() => shift(1)} className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : view === '1d' ? (
          <DayList items={grouped.get(fmt(anchor)) ?? []} />
        ) : view === '7d' ? (
          <WeekView from={startOfWeek(anchor)} grouped={grouped} onPick={(d) => { setSelectedDate(d); setAnchor(d); setView('1d'); }} />
        ) : view === 'month' ? (
          <MonthView anchor={anchor} grouped={grouped} onPick={(d) => { setSelectedDate(d); setAnchor(d); setView('1d'); }} />
        ) : (
          <YearView year={anchor.getFullYear()} grouped={grouped} onPick={(m) => { setAnchor(new Date(anchor.getFullYear(), m, 1)); setView('month'); }} />
        )}
      </div>
    </div>
  );
}

function DayList({ items }: { items: any[] }) {
  if (items.length === 0) {
    return <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
      <Package className="w-8 h-8 opacity-40" />
      <p className="text-sm">Keine Aufträge an diesem Tag</p>
    </div>;
  }
  return (
    <div className="space-y-2">
      {items.map(s => (
        <div key={s.id} className="rounded-xl bg-white/[0.04] border border-white/5 px-3 py-2.5 hover:bg-white/[0.07] transition">
          <p className="text-sm font-medium text-foreground truncate">{s.name || s.customer_name || 'Auftrag'}</p>
          {s.delivery_address && <p className="text-xs text-muted-foreground truncate mt-0.5">{s.delivery_address}</p>}
        </div>
      ))}
    </div>
  );
}

function WeekView({ from, grouped, onPick }: { from: Date; grouped: Map<string, any[]>; onPick: (d: Date) => void }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(from); d.setDate(from.getDate() + i); return d;
  });
  const today = fmt(new Date());
  return (
    <div className="grid grid-cols-7 gap-2 h-full">
      {days.map(d => {
        const key = fmt(d);
        const items = grouped.get(key) ?? [];
        const isToday = key === today;
        return (
          <button
            key={key}
            onClick={() => onPick(d)}
            className={cn(
              'flex flex-col rounded-xl border p-2 text-left transition hover:bg-white/[0.07]',
              isToday ? 'bg-primary/10 border-primary/40' : 'bg-white/[0.03] border-white/5',
            )}
          >
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {d.toLocaleDateString('de-DE', { weekday: 'short' })}
            </span>
            <span className="text-lg font-semibold text-foreground">{d.getDate()}</span>
            <div className="mt-auto">
              {items.length > 0 ? (
                <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                  {items.length}
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground/60">—</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function MonthView({ anchor, grouped, onPick }: { anchor: Date; grouped: Map<string, any[]>; onPick: (d: Date) => void }) {
  const first = startOfMonth(anchor);
  const last = endOfMonth(anchor);
  const startPad = (first.getDay() + 6) % 7;
  const cells: (Date | null)[] = Array(startPad).fill(null);
  for (let i = 1; i <= last.getDate(); i++) cells.push(new Date(anchor.getFullYear(), anchor.getMonth(), i));
  const today = fmt(new Date());
  const weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekdays.map(w => <div key={w} className="text-[10px] text-center text-muted-foreground uppercase tracking-wide">{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const key = fmt(d);
          const count = grouped.get(key)?.length ?? 0;
          const isToday = key === today;
          return (
            <button
              key={i}
              onClick={() => onPick(d)}
              className={cn(
                'aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition',
                isToday ? 'bg-primary/15 border border-primary/40 text-foreground' :
                count > 0 ? 'bg-primary/10 hover:bg-primary/20 text-foreground' : 'hover:bg-white/5 text-muted-foreground',
              )}
            >
              <span className="font-medium">{d.getDate()}</span>
              {count > 0 && <span className="w-1 h-1 rounded-full bg-primary mt-0.5" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function YearView({ year, grouped, onPick }: { year: number; grouped: Map<string, any[]>; onPick: (m: number) => void }) {
  const months = Array.from({ length: 12 }, (_, m) => {
    let total = 0;
    for (const [key, items] of grouped) {
      if (key.startsWith(`${year}-${String(m + 1).padStart(2, '0')}`)) total += items.length;
    }
    return { m, total };
  });
  return (
    <div className="grid grid-cols-3 gap-2">
      {months.map(({ m, total }) => {
        const name = new Date(year, m, 1).toLocaleDateString('de-DE', { month: 'short' });
        return (
          <button
            key={m}
            onClick={() => onPick(m)}
            className="rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 p-3 text-left transition"
          >
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{name}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{total}</p>
            <p className="text-[10px] text-muted-foreground">Aufträge</p>
          </button>
        );
      })}
    </div>
  );
}
