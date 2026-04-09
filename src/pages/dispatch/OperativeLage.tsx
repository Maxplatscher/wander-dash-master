import { Activity, MapPin, Clock, Fuel, User } from 'lucide-react';
import { KpiCard } from '@/components/dispatch/KpiCard';
import { cn } from '@/lib/utils';

const snapshot = [
  { icon: Activity, label: 'Status', value: 'LIVE', variant: 'success' as const },
  { icon: MapPin, label: 'Stops heute', value: 78, subtitle: '42 erledigt' },
  { icon: Clock, label: 'Ø Verzögerung', value: '4 min', variant: 'warning' as const },
  { icon: Fuel, label: 'Ø Auslastung', value: '82%', variant: 'success' as const },
];

const drivers = [
  { name: 'Max M.', initials: 'MM', load: 92, tours: 3, status: 'aktiv' },
  { name: 'Lisa K.', initials: 'LK', load: 78, tours: 2, status: 'aktiv' },
  { name: 'Tom B.', initials: 'TB', load: 65, tours: 2, status: 'aktiv' },
  { name: 'Sarah W.', initials: 'SW', load: 45, tours: 1, status: 'aktiv' },
  { name: 'Jan P.', initials: 'JP', load: 0, tours: 0, status: 'abwesend' },
];

const tours = [
  { id: 'T-001', driver: 'Max M.', stops: 12, done: 8, status: 'unterwegs' },
  { id: 'T-002', driver: 'Lisa K.', stops: 9, done: 5, status: 'unterwegs' },
  { id: 'T-003', driver: 'Tom B.', stops: 7, done: 7, status: 'abgeschlossen' },
  { id: 'T-004', driver: 'Max M.', stops: 10, done: 2, status: 'geplant' },
  { id: 'T-005', driver: 'Sarah W.', stops: 6, done: 0, status: 'geplant' },
];

const statusColor: Record<string, string> = {
  unterwegs: 'bg-primary/10 text-primary',
  abgeschlossen: 'bg-emerald-50 text-emerald-600',
  geplant: 'bg-muted text-muted-foreground',
};

export function OperativeLage() {
  return (
    <div className="space-y-6">
      {/* Snapshot KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {snapshot.map(s => <KpiCard key={s.label} {...s} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Drivers */}
        <div className="space-y-3">
          <h3 className="font-semibold text-foreground text-sm">Fahrer-Auslastung</h3>
          <div className="space-y-2">
            {drivers.map(d => (
              <div key={d.name} className="rounded-lg border border-border bg-card p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                  {d.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-card-foreground truncate">{d.name}</p>
                  <p className="text-xs text-muted-foreground">{d.tours} Touren · {d.status}</p>
                </div>
                <div className="relative w-10 h-10 shrink-0">
                  <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15" fill="none"
                      stroke={d.load > 80 ? 'hsl(var(--primary))' : d.load > 50 ? 'hsl(var(--warning))' : 'hsl(var(--muted-foreground))'}
                      strokeWidth="3" strokeDasharray={`${d.load * 0.94} 100`} strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-card-foreground">
                    {d.load}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tours */}
        <div className="space-y-3">
          <h3 className="font-semibold text-foreground text-sm">Heutige Touren</h3>
          <div className="space-y-2">
            {tours.map(t => (
              <div key={t.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-card-foreground">{t.id}</span>
                  <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', statusColor[t.status])}>
                    {t.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  <User className="w-3 h-3 inline mr-1" />{t.driver} · {t.done}/{t.stops} Stops
                </p>
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${(t.done / t.stops) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Map placeholder */}
        <div className="space-y-3">
          <h3 className="font-semibold text-foreground text-sm">Live-Karte & Route</h3>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="aspect-[4/3] bg-muted flex items-center justify-center relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-info/5" />
              <div className="text-center z-10">
                <MapPin className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Kartenansicht</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Stops · Verkehr · Wetter</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
