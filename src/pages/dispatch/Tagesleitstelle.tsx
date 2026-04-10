import { Route, Truck, Users, AlertTriangle, PackageX, Play, RefreshCw, MoreHorizontal, Zap, Loader2, Car, Clock } from 'lucide-react';
import { KpiCard } from '@/components/dispatch/KpiCard';
import { KpiDetailDialog } from '@/components/dispatch/KpiDetailDialog';
import { WeatherWidget } from '@/components/dispatch/WeatherWidget';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useDispatch } from '@/lib/dispatch-context';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';

/* ── KPIs ── */
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
        conflicts: 0,
        totalShipments,
      };
    },
  });
}

/* ── Driver Summary ── */
function useDriverSummary(date: string) {
  return useQuery({
    queryKey: ['driver-summary', date],
    queryFn: async () => {
      const { data: drivers } = await supabase.from('driver').select('id, name, status');
      const { data: tours } = await supabase.from('tour').select('id, is_active').eq('date', date);
      const tourIds = (tours ?? []).map(t => t.id);

      let stops: any[] = [];
      if (tourIds.length > 0) {
        const { data } = await supabase
          .from('tour_stop')
          .select('tour_id, vehicle_id, driver_completed')
          .in('tour_id', tourIds);
        stops = data ?? [];
      }

      // Group stops by vehicle_id as a proxy for driver assignment
      const { data: vehicles } = await supabase.from('vehicle').select('id, name');
      const vehicleMap = new Map((vehicles ?? []).map(v => [v.id, v.name]));

      return (drivers ?? []).map(driver => {
        // In this schema, drivers don't have direct tour assignment,
        // so we show overall tour stats per driver
        const activeTourIds = (tours ?? []).filter(t => t.is_active).map(t => t.id);
        const driverStops = stops.filter(s => activeTourIds.includes(s.tour_id));
        const completed = driverStops.filter(s => s.driver_completed).length;
        const total = driverStops.length;

        return {
          id: driver.id,
          name: driver.name ?? 'Unbenannt',
          status: driver.status ?? 'unknown',
          completedStops: completed,
          totalStops: total,
          openStops: total - completed,
        };
      });
    },
  });
}

/* ── Traffic hints (simulated) ── */
const trafficHints = [
  { road: 'A9', text: 'Stau zwischen München-Nord und Garching, +15 Min', severity: 'warning' as const },
  { road: 'B2', text: 'Baustelle Höhe Dachau, einspurig, leichte Verzögerungen', severity: 'info' as const },
  { road: 'A99', text: 'Freie Fahrt auf dem Autobahnring', severity: 'ok' as const },
  { road: 'A8', text: 'Unfall bei Augsburg-West, rechter Fahrstreifen gesperrt', severity: 'warning' as const },
  { road: 'B304', text: 'Wasserrohrbruch in Markt Schwaben, Umleitung eingerichtet', severity: 'warning' as const },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Guten Morgen';
  if (h < 18) return 'Guten Tag';
  return 'Guten Abend';
}

export function Tagesleitstelle() {
  const { navigateTo, selectedDate } = useDispatch();
  const dateStr = selectedDate.toISOString().split('T')[0];
  const { data: kpis, isLoading, refetch } = useKpis(dateStr);
  const { data: driverSummary } = useDriverSummary(dateStr);
  const [planning, setPlanning] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [detailType, setDetailType] = useState<'activeTours' | 'vehicles' | 'drivers' | 'unassigned' | 'conflicts' | null>(null);
  const [trafficTime, setTrafficTime] = useState(new Date());

  // Refresh traffic timestamp every 2 minutes
  useEffect(() => {
    const interval = setInterval(() => setTrafficTime(new Date()), 120_000);
    return () => clearInterval(interval);
  }, []);

  const handleDemo = async (scenario = 'A') => {
    setDemoLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('demo-setup', { body: { scenario } });
      if (error) throw error;
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

  const hasProblems = (kpis?.unassigned ?? 0) > 0 || (kpis?.conflicts ?? 0) > 0;
  const statusText = isLoading
    ? 'Lade Daten...'
    : hasProblems
      ? `${kpis?.unassigned ?? 0} offene Sendungen · ${kpis?.conflicts ?? 0} Konflikte`
      : 'Alles im grünen Bereich';

  const kpiCards = [
    { icon: Route, label: 'Aktive Touren', value: kpis?.activeTours ?? 0, subtitle: `${kpis?.totalTours ?? 0} gesamt`, variant: 'default' as const, pulse: (kpis?.activeTours ?? 0) > 0, onClick: () => setDetailType('activeTours') },
    { icon: Truck, label: 'Fahrzeuge im Einsatz', value: kpis?.vehiclesInUse ?? 0, subtitle: `von ${kpis?.totalVehicles ?? 0} verfügbar`, variant: 'success' as const, onClick: () => setDetailType('vehicles') },
    { icon: Users, label: 'Fahrer im Einsatz', value: kpis?.activeDrivers ?? 0, subtitle: `${kpis?.absentDrivers ?? 0} abwesend`, variant: 'default' as const, onClick: () => setDetailType('drivers') },
    { icon: PackageX, label: 'Unzugewiesen', value: kpis?.unassigned ?? 0, subtitle: 'Sendungen ohne Tour', variant: (kpis?.unassigned ?? 0) > 0 ? 'warning' as const : 'default' as const, onClick: () => setDetailType('unassigned') },
    { icon: AlertTriangle, label: 'Konflikte', value: kpis?.conflicts ?? 0, subtitle: 'Zeitfenster / Kapazität', variant: (kpis?.conflicts ?? 0) > 0 ? 'destructive' as const : 'default' as const, onClick: () => setDetailType('conflicts') },
  ];

  const absentDrivers = driverSummary?.filter(d => d.status !== 'active') ?? [];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-extrabold text-card-foreground tracking-tight">
          {getGreeting()} 👋
        </h1>
        <div className="flex items-center gap-2 mt-1">
          <span className={`inline-flex h-2 w-2 rounded-full ${hasProblems ? 'bg-amber-500' : 'bg-emerald-500'}`} />
          <p className="text-sm text-muted-foreground">{statusText}</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {kpiCards.map((kpi, i) => (
          <div key={kpi.label} className="animate-fade-in" style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'backwards' }}>
            <KpiCard {...kpi} />
          </div>
        ))}
      </div>

      {/* Personnel Absence Alert */}
      {absentDrivers.length > 0 && (
        <Alert className="border-amber-500/50 bg-amber-500/10 animate-fade-in">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-700 dark:text-amber-400 font-medium">
            ⚠️ {absentDrivers.length} Fahrer abwesend: {absentDrivers.map(d => d.name).join(', ')}
          </AlertDescription>
        </Alert>
      )}

      {/* Hero Summary */}
      <div className="rounded-xl bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground shadow-lg">
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-primary-foreground/80 animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-wider opacity-80">
            {(kpis?.activeTours ?? 0) > 0 ? 'System aktiv' : 'Bereit'}
          </span>
        </div>
        <h3 className="text-lg font-bold mb-1">Tageszusammenfassung</h3>
        <p className="text-sm opacity-90 mb-4">
          {isLoading ? 'Lade...' : `${kpis?.activeTours ?? 0} Touren aktiv · ${kpis?.totalShipments ?? 0} Sendungen · ${kpis?.unassigned ?? 0} offen`}
        </p>

        {/* Driver Overview */}
        {driverSummary && driverSummary.length > 0 && (
          <div className="mb-4 bg-primary-foreground/10 rounded-lg p-3 backdrop-blur-sm">
            <h4 className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-2">Fahrer-Übersicht</h4>
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {driverSummary.map(driver => (
                <div key={driver.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex h-1.5 w-1.5 rounded-full ${driver.status === 'active' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    <span className="font-medium">{driver.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge className="bg-emerald-500/20 text-emerald-200 border-0 text-[10px] px-1.5 py-0">
                      ✓ {driver.completedStops}
                    </Badge>
                    <Badge className="bg-primary-foreground/20 text-primary-foreground border-0 text-[10px] px-1.5 py-0">
                      ▶ {driver.totalStops - driver.completedStops - driver.openStops}
                    </Badge>
                    <Badge className="bg-amber-500/20 text-amber-200 border-0 text-[10px] px-1.5 py-0">
                      ○ {driver.openStops}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-semibold" onClick={() => navigateTo('operative-lage')}>
            <Play className="w-3.5 h-3.5 mr-1.5" /> Plan öffnen
          </Button>
          <Button size="sm" variant="secondary" className="bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30 hover:bg-primary-foreground/30 font-semibold" onClick={handlePlan} disabled={planning}>
            {planning ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
            Neu planen
          </Button>
          <Button size="sm" variant="secondary" className="bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30 hover:bg-primary-foreground/30 font-semibold" onClick={() => handleDemo('A')} disabled={demoLoading}>
            {demoLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 mr-1.5" />}
            One-Click Demo
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="secondary" className="bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30 hover:bg-primary-foreground/30">
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

      {/* Traffic Hints */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Car className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-card-foreground text-sm">Verkehrshinweise</h3>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>Aktualisiert {trafficTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
        <div className="space-y-2">
          {trafficHints.map((hint, i) => (
            <div key={i} className="flex items-start gap-3 text-sm">
              <span className={`inline-flex shrink-0 mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold ${
                hint.severity === 'warning' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                hint.severity === 'ok' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                'bg-blue-500/10 text-blue-600 dark:text-blue-400'
              }`}>
                {hint.road}
              </span>
              <span className="text-muted-foreground">{hint.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Weather Widget */}
      <WeatherWidget />

      {/* KPI Detail Dialog */}
      <KpiDetailDialog
        open={detailType !== null}
        onOpenChange={(open) => { if (!open) setDetailType(null); }}
        type={detailType ?? 'activeTours'}
        date={dateStr}
      />
    </div>
  );
}
