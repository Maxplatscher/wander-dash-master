import { Truck, Phone, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

const drivers = [
  { name: 'Max Müller', initials: 'MM', phone: '+49 171 1234567', vehicle: 'MB Sprinter · B-DI 1001', status: 'aktiv', tours: 3 },
  { name: 'Lisa König', initials: 'LK', phone: '+49 171 2345678', vehicle: 'VW Crafter · B-DI 1002', status: 'aktiv', tours: 2 },
  { name: 'Tom Berger', initials: 'TB', phone: '+49 171 3456789', vehicle: 'MB Sprinter · B-DI 1003', status: 'aktiv', tours: 2 },
  { name: 'Sarah Weber', initials: 'SW', phone: '+49 171 4567890', vehicle: 'Iveco Daily · B-DI 1004', status: 'aktiv', tours: 1 },
  { name: 'Jan Peters', initials: 'JP', phone: '+49 171 5678901', vehicle: '—', status: 'abwesend', tours: 0 },
  { name: 'Anna Richter', initials: 'AR', phone: '+49 171 6789012', vehicle: 'VW Crafter · B-DI 1005', status: 'verfügbar', tours: 0 },
];

const statusColors: Record<string, string> = {
  aktiv: 'bg-emerald-50 text-emerald-700',
  abwesend: 'bg-red-50 text-red-600',
  verfügbar: 'bg-primary/10 text-primary',
};

export function Fahrer() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {drivers.map(d => (
          <div key={d.name} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                {d.initials}
              </div>
              <div>
                <p className="font-medium text-sm text-card-foreground">{d.name}</p>
                <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', statusColors[d.status])}>
                  {d.status}
                </span>
              </div>
            </div>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Phone className="w-3 h-3" /> {d.phone}
              </div>
              <div className="flex items-center gap-2">
                <Truck className="w-3 h-3" /> {d.vehicle}
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-3 h-3" /> {d.tours} Touren heute
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
