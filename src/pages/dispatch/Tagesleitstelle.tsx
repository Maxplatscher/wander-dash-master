import { Route, Truck, Users, AlertTriangle, PackageX, UserX } from 'lucide-react';
import { KpiCard } from '@/components/dispatch/KpiCard';
import { KpiDetailDialog } from '@/components/dispatch/KpiDetailDialog';
import { WeatherWidget } from '@/components/dispatch/WeatherWidget';
import { OrdersCalendar } from '@/components/dispatch/OrdersCalendar';
import { LiveMap } from '@/components/dispatch/LiveMap';
import { useDispatch } from '@/lib/dispatch-context';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

function useKpis(date: string) {
  return useQuery({
    queryKey: ['kpis', date],
    queryFn: async () => {
      const [tours, vehicles, drivers, shipments] = await Promise.all([
        supabase.from('tour').select('id, is_active').eq('date', date),
        supabase.from('vehicle').select('id'),
        supabase.from('driver').select('id, status'),
        supabase.from('shipment').select('id').eq('service_date', date),
      ]);

      const activeTours = tours.data?.filter(t => t.is_active) ?? [];
      const tourIds = activeTours.map(t => t.id);

      let assignedIds: string[] = [];
      if (tourIds.length > 0) {
        const { data: stops } = await supabase
          .from('tour_stop')
          .select('shipment_id')
          .in('tour_id', tourIds);
        assignedIds = (stops ?? []).map(s => s.shipment_id).filter(Boolean) as string[];
      }

      const totalShipments = shipments.data?.length ?? 0;
      const unassigned = Math.max(0, totalShipments - assignedIds.length);
      const activeDrivers = drivers.data?.filter(d => d.status === 'active').length ?? 0;
      const absentDrivers = (drivers.data?.length ?? 0) - activeDrivers;

      return {
        activeTours: activeTours.length,
        totalTours: tours.data?.length ?? 0,
        vehiclesInUse: tourIds.length,
        totalVehicles: vehicles.data?.length ?? 0,
        activeDrivers,
        absentDrivers,
        unassigned,
        problems: unassigned, // real open issues only
        totalShipments,
      };
    },
  });
}

export function Tagesleitstelle() {
  const { selectedDate } = useDispatch();
  const dateStr = selectedDate.toISOString().split('T')[0];
  const { data: kpis } = useKpis(dateStr);
  const [detailType, setDetailType] = useState<'activeTours' | 'vehicles' | 'drivers' | 'unassigned' | 'conflicts' | null>(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[calc(100vh-7rem)] min-h-[640px]">
      {/* Top-Left: Wetter */}
      <div className="lg:col-span-5 lg:row-span-1 glass-card p-0 overflow-hidden">
        <WeatherWidget />
      </div>

      {/* Top-Right: Today's Highlight */}
      <div className="lg:col-span-7 glass-card p-5 flex flex-col">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Today's Highlight</h2>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <KpiCard
            icon={Route}
            label="Aktive Touren"
            value={kpis?.activeTours ?? 0}
            subtitle={`${kpis?.totalTours ?? 0} gesamt`}
            variant="default"
            pulse={(kpis?.activeTours ?? 0) > 0}
            onClick={() => setDetailType('activeTours')}
          />
          <KpiCard
            icon={Truck}
            label="Fahrzeuge im Einsatz"
            value={kpis?.vehiclesInUse ?? 0}
            subtitle={`von ${kpis?.totalVehicles ?? 0}`}
            variant="success"
            onClick={() => setDetailType('vehicles')}
          />
          <KpiCard
            icon={Users}
            label="Fahrer im Einsatz"
            value={kpis?.activeDrivers ?? 0}
            subtitle="aktiv"
            variant="default"
            onClick={() => setDetailType('drivers')}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <CompactKpi
            icon={PackageX}
            label="Unzugewiesen"
            value={kpis?.unassigned ?? 0}
            tone={(kpis?.unassigned ?? 0) > 0 ? 'warning' : 'default'}
            onClick={() => setDetailType('unassigned')}
          />
          <CompactKpi
            icon={AlertTriangle}
            label="Probleme"
            value={kpis?.problems ?? 0}
            tone={(kpis?.problems ?? 0) > 0 ? 'destructive' : 'default'}
            onClick={() => setDetailType('unassigned')}
          />
          <CompactKpi
            icon={UserX}
            label="Abwesende Fahrer"
            value={kpis?.absentDrivers ?? 0}
            tone={(kpis?.absentDrivers ?? 0) > 0 ? 'warning' : 'default'}
            onClick={() => setDetailType('drivers')}
          />
        </div>
      </div>

      {/* Bottom-Left: Auftrags-Kalender */}
      <div className="lg:col-span-5 glass-card p-5 min-h-[360px]">
        <OrdersCalendar />
      </div>

      {/* Bottom-Right: Google Maps */}
      <div className="lg:col-span-7 glass-card p-0 overflow-hidden min-h-[360px]">
        <LiveMap fill />
      </div>

      <KpiDetailDialog
        open={detailType !== null}
        onOpenChange={(open) => { if (!open) setDetailType(null); }}
        type={detailType ?? 'activeTours'}
        date={dateStr}
      />
    </div>
  );
}

function CompactKpi({
  icon: Icon,
  label,
  value,
  tone,
  onClick,
}: {
  icon: any;
  label: string;
  value: number;
  tone: 'default' | 'warning' | 'destructive';
  onClick?: () => void;
}) {
  const toneClass = tone === 'destructive'
    ? 'text-red-400 bg-red-500/10'
    : tone === 'warning'
      ? 'text-amber-400 bg-amber-500/10'
      : 'text-muted-foreground bg-white/5';
  return (
    <button
      onClick={onClick}
      className="rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition p-3 flex items-center gap-3 text-left"
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${toneClass}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{label}</p>
        <p className="text-xl font-bold text-foreground leading-tight">{value}</p>
      </div>
    </button>
  );
}
