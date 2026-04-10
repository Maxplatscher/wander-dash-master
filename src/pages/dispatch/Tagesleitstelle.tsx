import { Route, Truck, Users, AlertTriangle, PackageX, Play, RefreshCw, MoreHorizontal, Zap, Loader2 } from 'lucide-react';
import { KpiCard } from '@/components/dispatch/KpiCard';
import { Button } from '@/components/ui/button';
import { useDispatch } from '@/lib/dispatch-context';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
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

      // Get assigned shipment ids
      let assignedIds: string[] = [];
      if (tourIds.length > 0) {
        const { data: stops } = await supabase
          .from('tour_stop')
          .select('shipment_id')
          .in('tour_id', tourIds);
        assignedIds = (stops ?? []).map(s => s.shipment_id).filter(Boolean) as string[];
      }

      const totalShipments = shipments.data?.length ?? 0;
      const unassigned = totalShipments - assignedIds.length;
      const activeDrivers = drivers.data?.filter(d => d.status === 'active').length ?? 0;
      const absentDrivers = (drivers.data?.length ?? 0) - activeDrivers;

      return {
        activeTours: activeTours.length,
        totalTours: tours.data?.length ?? 0,
        vehiclesInUse: tourIds.length,
        totalVehicles: vehicles.data?.length ?? 0,
        activeDrivers,
        absentDrivers,
        unassigned: Math.max(0, unassigned),
        conflicts: 0, // TODO: calculate from time window violations
        totalShipments,
      };
    },
  });
}

export function Tagesleitstelle() {
  const { navigateTo, selectedDate } = useDispatch();
  const dateStr = selectedDate.toISOString().split('T')[0];
  const { data: kpis, isLoading, refetch } = useKpis(dateStr);
  const [planning, setPlanning] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const handleDemo = async (scenario = 'A') => {
    setDemoLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('demo-setup', {
        body: { scenario },
      });
      if (error) throw error;

      // Now run planning
      const { data: planResult, error: planErr } = await supabase.functions.invoke('plan-tour', {
        body: { company_id: data.company_id, date: dateStr, auto_activate: true },
      });
      if (planErr) throw planErr;

      toast.success(`Demo ${scenario} erstellt`, {
        description: `${planResult.tours} Touren mit ${planResult.total_stops} Stops geplant`,
      });
      refetch();
    } catch (e) {
      toast.error('Fehler beim Demo-Setup: ' + (e as Error).message);
    } finally {
      setDemoLoading(false);
    }
  };

  const handlePlan = async () => {
    setPlanning(true);
    try {
      // Get user's company
      const { data: companyId } = await supabase.rpc('get_user_company_id');
      if (!companyId) throw new Error('Kein Mandant zugeordnet');

      const { data, error } = await supabase.functions.invoke('plan-tour', {
        body: { company_id: companyId, date: dateStr, auto_activate: true },
      });
      if (error) throw error;

      toast.success(`Plan v${data.version} erstellt`, {
        description: `${data.tours} Touren, ${data.total_stops} Stops`,
      });
      refetch();
    } catch (e) {
      toast.error('Planungsfehler: ' + (e as Error).message);
    } finally {
      setPlanning(false);
    }
  };

  const kpiCards = [
    { icon: Route, label: 'Aktive Touren', value: kpis?.activeTours ?? 0, subtitle: `${kpis?.totalTours ?? 0} gesamt`, variant: 'default' as const },
    { icon: Truck, label: 'Fahrzeuge im Einsatz', value: kpis?.vehiclesInUse ?? 0, subtitle: `von ${kpis?.totalVehicles ?? 0} verfügbar`, variant: 'success' as const },
    { icon: Users, label: 'Fahrer im Einsatz', value: kpis?.activeDrivers ?? 0, subtitle: `${kpis?.absentDrivers ?? 0} abwesend`, variant: 'default' as const },
    { icon: PackageX, label: 'Unassigned', value: kpis?.unassigned ?? 0, subtitle: 'Sendungen ohne Tour', variant: 'warning' as const },
    { icon: AlertTriangle, label: 'Konflikte', value: kpis?.conflicts ?? 0, subtitle: 'Zeitfenster / Kapazität', variant: 'destructive' as const },
  ];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {kpiCards.map(kpi => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* Actions */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="font-semibold text-card-foreground mb-1">Tageszusammenfassung</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {isLoading ? 'Lade...' : `${kpis?.activeTours ?? 0} Touren aktiv · ${kpis?.totalShipments ?? 0} Sendungen · ${kpis?.unassigned ?? 0} offen · ${kpis?.conflicts ?? 0} Konflikte`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => navigateTo('operative-lage')}>
            <Play className="w-3.5 h-3.5 mr-1.5" /> Plan öffnen
          </Button>
          <Button size="sm" variant="secondary" onClick={handlePlan} disabled={planning}>
            {planning ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
            Neu planen
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleDemo('A')} disabled={demoLoading}>
            {demoLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 mr-1.5" />}
            One-Click Demo
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => handleDemo('A')}>Szenario A (stabil)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDemo('B')}>Szenario B (Problem)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { refetch(); toast.info('Daten aktualisiert'); }}>Daten neu laden</DropdownMenuItem>
              <DropdownMenuItem onClick={() => location.reload()}>Seite neu laden</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button onClick={() => navigateTo('probleme')} className="rounded-lg border border-border bg-card p-4 text-left hover:border-primary/40 transition-colors">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <span className="font-medium text-sm text-card-foreground">Offene Probleme</span>
          </div>
          <p className="text-xs text-muted-foreground">{kpis?.unassigned ?? 0} unzugewiesene Sendungen</p>
        </button>
        <button onClick={() => navigateTo('kontrollzentrale')} className="rounded-lg border border-border bg-card p-4 text-left hover:border-primary/40 transition-colors">
          <div className="flex items-center gap-2 mb-1">
            <Route className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm text-card-foreground">Planversionen</span>
          </div>
          <p className="text-xs text-muted-foreground">{kpis?.totalTours ?? 0} Touren geplant</p>
        </button>
        <button onClick={() => navigateTo('fahrer')} className="rounded-lg border border-border bg-card p-4 text-left hover:border-primary/40 transition-colors">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm text-card-foreground">Fahrer & Fahrzeuge</span>
          </div>
          <p className="text-xs text-muted-foreground">{kpis?.activeDrivers ?? 0} aktiv · {kpis?.absentDrivers ?? 0} abwesend</p>
        </button>
      </div>
    </div>
  );
}
