import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LucideIcon, Route, Truck, Users, PackageX, AlertTriangle, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useDispatch } from '@/lib/dispatch-context';
import { useProblems } from '@/pages/dispatch/Probleme';

type KpiType = 'activeTours' | 'vehicles' | 'drivers' | 'unassigned' | 'conflicts';

interface KpiDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: KpiType;
  date: string;
}

type DetailItem = {
  id: string;
  primary: string;
  secondary: string;
  badge: string;
  tone: 'default' | 'warning' | 'danger' | 'success';
};

const config: Record<KpiType, { title: string; icon: LucideIcon; color: string }> = {
  activeTours: { title: 'Aktive Touren', icon: Route, color: 'text-primary' },
  vehicles: { title: 'Fahrzeuge im Einsatz', icon: Truck, color: 'text-success' },
  drivers: { title: 'Fahrer im Einsatz', icon: Users, color: 'text-primary' },
  unassigned: { title: 'Unzugewiesene Sendungen', icon: PackageX, color: 'text-warning' },
  conflicts: { title: 'Konflikte', icon: AlertTriangle, color: 'text-danger' },
};

const badgeTone: Record<DetailItem['tone'], string> = {
  default: 'bg-primary/15 text-primary',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
  success: 'bg-success/15 text-success',
};

function useKpiDetail(type: KpiType, date: string, open: boolean) {
  return useQuery({
    queryKey: ['kpi-detail', type, date],
    enabled: open && type !== 'conflicts',
    queryFn: async (): Promise<DetailItem[]> => {
      switch (type) {
        case 'activeTours': {
          const { data } = await supabase
            .from('tour')
            .select('id, description, is_active, total_cost, version')
            .eq('date', date)
            .eq('is_active', true);
          return (data ?? []).map((t) => ({
            id: t.id,
            primary: t.description || `Tour v${t.version ?? '?'}`,
            secondary: t.total_cost != null ? `Kosten: ${t.total_cost.toFixed(0)}` : 'Keine Kosten',
            badge: 'Aktiv',
            tone: 'success' as const,
          }));
        }
        case 'vehicles': {
          const { data: tours } = await supabase
            .from('tour')
            .select('id')
            .eq('date', date)
            .eq('is_active', true);
          const tourIds = (tours ?? []).map((t) => t.id);
          if (tourIds.length === 0) return [];
          const { data: stops } = await supabase
            .from('tour_stop')
            .select('vehicle_id')
            .in('tour_id', tourIds);
          const vehicleIds = [...new Set((stops ?? []).map((s) => s.vehicle_id).filter(Boolean))];
          if (vehicleIds.length === 0) return [];
          const { data: vehicles } = await supabase
            .from('vehicle')
            .select('id, name, capacity')
            .in('id', vehicleIds as string[]);
          return (vehicles ?? []).map((v) => ({
            id: v.id,
            primary: v.name || 'Fahrzeug',
            secondary: v.capacity != null ? `Kapazität: ${v.capacity}` : '',
            badge: 'Im Einsatz',
            tone: 'default' as const,
          }));
        }
        case 'drivers': {
          const { data } = await supabase.from('driver').select('id, name, status, phone');
          const active = (data ?? []).filter((d) => d.status === 'active' || d.status === 'aktiv');
          const inactive = (data ?? []).filter((d) => d.status !== 'active' && d.status !== 'aktiv');
          return [
            ...active.map((d) => ({
              id: d.id,
              primary: d.name || 'Fahrer',
              secondary: d.phone || '',
              badge: 'Aktiv',
              tone: 'success' as const,
            })),
            ...inactive.map((d) => ({
              id: d.id,
              primary: d.name || 'Fahrer',
              secondary: d.phone || '',
              badge: d.status || 'Abwesend',
              tone: 'warning' as const,
            })),
          ];
        }
        case 'unassigned': {
          const { data: tours } = await supabase
            .from('tour')
            .select('id')
            .eq('date', date)
            .eq('is_active', true);
          const tourIds = (tours ?? []).map((t) => t.id);
          let assignedIds: string[] = [];
          if (tourIds.length > 0) {
            const { data: stops } = await supabase
              .from('tour_stop')
              .select('shipment_id')
              .in('tour_id', tourIds);
            assignedIds = (stops ?? []).map((s) => s.shipment_id).filter(Boolean) as string[];
          }
          const { data: shipments } = await supabase
            .from('shipment')
            .select('id, name, customer_name, delivery_address')
            .eq('service_date', date);
          const unassigned = (shipments ?? []).filter((s) => !assignedIds.includes(s.id));
          return unassigned.map((s) => ({
            id: s.id,
            primary: s.name || s.customer_name || 'Sendung',
            secondary: s.delivery_address || '',
            badge: 'Offen',
            tone: 'warning' as const,
          }));
        }
        case 'conflicts':
          return [];
      }
    },
  });
}

export function KpiDetailDialog({ open, onOpenChange, type, date }: KpiDetailDialogProps) {
  const { selectedDepotId } = useDispatch();
  const { data: items, isLoading } = useKpiDetail(type, date, open);
  const { data: problems, isLoading: problemsLoading } = useProblems(
    date,
    selectedDepotId,
  );
  const cfg = config[type];
  const Icon = cfg.icon;

  const conflictItems: DetailItem[] =
    type === 'conflicts'
      ? (problems ?? []).map((p) => ({
          id: p.id,
          primary: p.title,
          secondary: p.detail,
          badge: p.severity,
          tone: p.severity === 'kritisch' ? 'danger' : 'warning',
        }))
      : [];

  const list = type === 'conflicts' ? conflictItems : items;
  const loading = type === 'conflicts' ? problemsLoading : isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[70vh] flex flex-col border-hairline bg-panel sm:rounded">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={cn('w-5 h-5', cfg.color)} />
            {cfg.title}
            {list && (
              <span className="ml-auto meta-text text-dim">{list.length}</span>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !list || list.length === 0 ? (
            <div className="text-center py-12 meta-text">
              {type === 'conflicts' ? 'Keine Konflikte vorhanden' : 'Keine Einträge vorhanden'}
            </div>
          ) : (
            <div className="space-y-2">
              {list.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between sub-card px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{item.primary}</p>
                    {item.secondary && (
                      <p className="meta-text truncate mt-0.5">{item.secondary}</p>
                    )}
                  </div>
                  <span
                    className={cn(
                      'ml-3 shrink-0 px-1.5 py-0.5 text-[10.5px] font-semibold rounded-sm',
                      badgeTone[item.tone],
                    )}
                  >
                    {item.badge}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
