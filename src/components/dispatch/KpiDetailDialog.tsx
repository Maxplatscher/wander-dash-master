import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LucideIcon, Route, Truck, Users, PackageX, AlertTriangle, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type KpiType = 'activeTours' | 'vehicles' | 'drivers' | 'unassigned' | 'conflicts';

interface KpiDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: KpiType;
  date: string;
}

const config: Record<KpiType, { title: string; icon: LucideIcon; color: string }> = {
  activeTours: { title: 'Aktive Touren', icon: Route, color: 'text-primary' },
  vehicles: { title: 'Fahrzeuge im Einsatz', icon: Truck, color: 'text-emerald-500' },
  drivers: { title: 'Fahrer im Einsatz', icon: Users, color: 'text-primary' },
  unassigned: { title: 'Unzugewiesene Sendungen', icon: PackageX, color: 'text-amber-500' },
  conflicts: { title: 'Konflikte', icon: AlertTriangle, color: 'text-red-500' },
};

function useKpiDetail(type: KpiType, date: string, open: boolean) {
  return useQuery({
    queryKey: ['kpi-detail', type, date],
    enabled: open,
    queryFn: async () => {
      switch (type) {
        case 'activeTours': {
          const { data } = await supabase
            .from('tour')
            .select('id, description, is_active, total_cost, version')
            .eq('date', date)
            .eq('is_active', true);
          return (data ?? []).map(t => ({
            id: t.id,
            primary: t.description || `Tour v${t.version ?? '?'}`,
            secondary: t.total_cost != null ? `Kosten: ${t.total_cost.toFixed(0)}` : 'Keine Kosten',
            badge: 'Aktiv',
            badgeVariant: 'default' as const,
          }));
        }
        case 'vehicles': {
          const { data: tours } = await supabase
            .from('tour')
            .select('id')
            .eq('date', date)
            .eq('is_active', true);
          const tourIds = (tours ?? []).map(t => t.id);
          if (tourIds.length === 0) return [];
          const { data: stops } = await supabase
            .from('tour_stop')
            .select('vehicle_id')
            .in('tour_id', tourIds);
          const vehicleIds = [...new Set((stops ?? []).map(s => s.vehicle_id).filter(Boolean))];
          if (vehicleIds.length === 0) return [];
          const { data: vehicles } = await supabase
            .from('vehicle')
            .select('id, name, capacity')
            .in('id', vehicleIds as string[]);
          return (vehicles ?? []).map(v => ({
            id: v.id,
            primary: v.name || 'Fahrzeug',
            secondary: v.capacity != null ? `Kapazität: ${v.capacity}` : '',
            badge: 'Im Einsatz',
            badgeVariant: 'default' as const,
          }));
        }
        case 'drivers': {
          const { data } = await supabase.from('driver').select('id, name, status, phone');
          const active = (data ?? []).filter(d => d.status === 'active');
          const inactive = (data ?? []).filter(d => d.status !== 'active');
          return [
            ...active.map(d => ({
              id: d.id,
              primary: d.name || 'Fahrer',
              secondary: d.phone || '',
              badge: 'Aktiv',
              badgeVariant: 'default' as const,
            })),
            ...inactive.map(d => ({
              id: d.id,
              primary: d.name || 'Fahrer',
              secondary: d.phone || '',
              badge: d.status || 'Abwesend',
              badgeVariant: 'secondary' as const,
            })),
          ];
        }
        case 'unassigned': {
          const { data: tours } = await supabase
            .from('tour')
            .select('id')
            .eq('date', date)
            .eq('is_active', true);
          const tourIds = (tours ?? []).map(t => t.id);
          let assignedIds: string[] = [];
          if (tourIds.length > 0) {
            const { data: stops } = await supabase
              .from('tour_stop')
              .select('shipment_id')
              .in('tour_id', tourIds);
            assignedIds = (stops ?? []).map(s => s.shipment_id).filter(Boolean) as string[];
          }
          const { data: shipments } = await supabase
            .from('shipment')
            .select('id, name, customer_name, delivery_address')
            .eq('service_date', date);
          const unassigned = (shipments ?? []).filter(s => !assignedIds.includes(s.id));
          return unassigned.map(s => ({
            id: s.id,
            primary: s.name || s.customer_name || 'Sendung',
            secondary: s.delivery_address || '',
            badge: 'Offen',
            badgeVariant: 'outline' as const,
          }));
        }
        case 'conflicts': {
          return [];
        }
      }
    },
  });
}

export function KpiDetailDialog({ open, onOpenChange, type, date }: KpiDetailDialogProps) {
  const { data: items, isLoading } = useKpiDetail(type, date, open);
  const cfg = config[type];
  const Icon = cfg.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={cn('w-5 h-5', cfg.color)} />
            {cfg.title}
            {items && <Badge variant="secondary" className="ml-auto">{items.length}</Badge>}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !items || items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {type === 'conflicts' ? 'Keine Konflikte vorhanden' : 'Keine Einträge vorhanden'}
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3 hover:bg-muted/60 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-card-foreground truncate">{item.primary}</p>
                    {item.secondary && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{item.secondary}</p>
                    )}
                  </div>
                  <Badge variant={item.badgeVariant} className="ml-3 shrink-0">
                    {item.badge}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
