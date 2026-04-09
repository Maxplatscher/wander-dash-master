import { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDispatch } from '@/lib/dispatch-context';
import { cn } from '@/lib/utils';

type ViewMode = 'month' | 'week' | 'day';

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

const demoEvents: Record<string, { label: string; color: string }[]> = {
  '2026-04-09': [
    { label: 'T-001 Max M.', color: 'bg-primary/20 text-primary' },
    { label: 'T-002 Lisa K.', color: 'bg-info/20 text-info' },
  ],
  '2026-04-10': [
    { label: 'T-003 Tom B.', color: 'bg-primary/20 text-primary' },
  ],
  '2026-04-12': [
    { label: 'T-004 Max M.', color: 'bg-warning/20 text-amber-700' },
    { label: 'T-005 Sarah W.', color: 'bg-primary/20 text-primary' },
  ],
  '2026-04-15': [
    { label: 'T-006 Lisa K.', color: 'bg-info/20 text-info' },
  ],
};

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function Kalender() {
  const { navigateTo } = useDispatch();
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [viewDate, setViewDate] = useState(new Date());

  const navigate = useCallback((dir: -1 | 0 | 1) => {
    if (dir === 0) { setViewDate(new Date()); return; }
    setViewDate(prev => {
      const d = new Date(prev);
      if (viewMode === 'month') d.setMonth(d.getMonth() + dir);
      else if (viewMode === 'week') d.setDate(d.getDate() + dir * 7);
      else d.setDate(d.getDate() + dir);
      return d;
    });
  }, [viewMode]);

  const handleEventClick = useCallback((label: string) => {
    navigateTo('tagesleitstelle');
  }, [navigateTo]);

  // Build month grid
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDow = (firstDay.getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = fmt(new Date());

  const cells: { day: number; date: string; current: boolean }[] = [];
  // prev month padding
  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const dt = new Date(year, month - 1, d);
    cells.push({ day: d, date: fmt(dt), current: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, date: fmt(new Date(year, month, d)), current: true });
  }
  // pad to fill last row
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const dt = new Date(year, month + 1, d);
      cells.push({ day: d, date: fmt(dt), current: false });
    }
  }

  return (
    <div id="calendar-container" className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate(0)}>Heute</Button>
          <Button size="sm" variant="outline" onClick={() => navigate(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <h3 className="font-semibold text-foreground ml-2">
            {MONTHS[month]} {year}
          </h3>
        </div>
        <div className="flex gap-1">
          {(['month', 'week', 'day'] as ViewMode[]).map(m => (
            <Button key={m} size="sm" variant={viewMode === m ? 'default' : 'ghost'}
              onClick={() => setViewMode(m)} className="text-xs capitalize">
              {m === 'month' ? 'Monat' : m === 'week' ? 'Woche' : 'Tag'}
            </Button>
          ))}
        </div>
      </div>

      {/* Month view */}
      {viewMode === 'month' && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-7">
            {DAYS.map(d => (
              <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground border-b border-border bg-muted/30">
                {d}
              </div>
            ))}
            {cells.map((cell, i) => {
              const events = demoEvents[cell.date] || [];
              const isToday = cell.date === today;
              return (
                <div key={i} className={cn(
                  "min-h-[90px] p-1.5 border-b border-r border-border text-xs",
                  !cell.current && "bg-muted/20 text-muted-foreground/40"
                )}>
                  <span className={cn(
                    "inline-flex w-6 h-6 items-center justify-center rounded-full text-xs",
                    isToday && "bg-primary text-primary-foreground font-semibold"
                  )}>
                    {cell.day}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {events.map((ev, j) => (
                      <button key={j} onClick={() => handleEventClick(ev.label)}
                        className={cn('block w-full text-left truncate rounded px-1 py-0.5 text-[10px] font-medium', ev.color)}>
                        {ev.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {viewMode === 'week' && (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          <p className="text-sm">Wochenansicht – KW {Math.ceil((viewDate.getDate() + startDow) / 7)}</p>
          <p className="text-xs mt-1">Detailansicht wird geladen...</p>
        </div>
      )}

      {viewMode === 'day' && (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          <p className="text-sm">Tagesansicht – {viewDate.toLocaleDateString('de-DE')}</p>
          <p className="text-xs mt-1">Detailansicht wird geladen...</p>
        </div>
      )}
    </div>
  );
}
