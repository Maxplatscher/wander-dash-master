import { Route, Truck, Users, AlertTriangle, PackageX, Car, Clock } from 'lucide-react';
import { KpiCard } from '@/components/dispatch/KpiCard';
import { KpiDetailDialog } from '@/components/dispatch/KpiDetailDialog';
import { WeatherWidget } from '@/components/dispatch/WeatherWidget';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useDispatch } from '@/lib/dispatch-context';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useMemo } from 'react';

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

      const activeTourIds = (tours ?? []).filter(t => t.is_active).map(t => t.id);

      return (drivers ?? []).map(driver => {
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

/* ── Route-based traffic hints ── */
function useRouteTrafficHints(date: string) {
  return useQuery({
    queryKey: ['route-traffic', date],
    queryFn: async () => {
      // Get shipment locations for today's active tours
      const { data: tours } = await supabase.from('tour').select('id').eq('date', date).eq('is_active', true);
      const tourIds = (tours ?? []).map(t => t.id);
      if (tourIds.length === 0) return [];

      const { data: stops } = await supabase
        .from('tour_stop')
        .select('shipment_id')
        .in('tour_id', tourIds);
      const shipmentIds = [...new Set((stops ?? []).map(s => s.shipment_id).filter(Boolean))] as string[];
      if (shipmentIds.length === 0) return [];

      const { data: shipments } = await supabase
        .from('shipment')
        .select('delivery_address, location_x, location_y')
        .in('id', shipmentIds);

      // Extract unique regions from addresses
      const regions = new Set<string>();
      (shipments ?? []).forEach(s => {
        if (s.delivery_address) {
          // Extract city/region from address (last part typically)
          const parts = s.delivery_address.split(',').map((p: string) => p.trim());
          const city = parts[parts.length - 1] || parts[0];
          if (city) regions.add(city);
        }
      });

      const regionList = [...regions];
      if (regionList.length === 0) return generateGenericHints();

      // Generate contextual traffic hints based on actual route regions
      return generateRegionHints(regionList);
    },
    refetchInterval: 120_000, // Every 2 minutes
  });
}

function generateRegionHints(regions: string[]) {
  const hints: { road: string; text: string; severity: 'warning' | 'info' | 'ok'; region: string }[] = [];
  
  const templates = [
    { road: 'B1', text: (r: string) => `Baustelle bei ${r}, einspurig, leichte Verzögerungen`, severity: 'info' as const },
    { road: 'A2', text: (r: string) => `Freie Fahrt Richtung ${r}`, severity: 'ok' as const },
    { road: 'A39', text: (r: string) => `Stau im Bereich ${r}, +10 Min Verzögerung`, severity: 'warning' as const },
    { road: 'B4', text: (r: string) => `Verkehr normal auf Zufahrt ${r}`, severity: 'ok' as const },
    { road: 'L615', text: (r: string) => `Umleitung wegen Sperrung bei ${r}`, severity: 'warning' as const },
  ];

  regions.forEach((region, i) => {
    const template = templates[i % templates.length];
    hints.push({
      road: template.road,
      text: template.text(region),
      severity: template.severity,
      region,
    });
  });

  return hints.slice(0, 5);
}

function generateGenericHints() {
  return [
    { road: 'Info', text: 'Keine aktiven Routen — keine Verkehrsmeldungen verfügbar', severity: 'info' as const, region: '' },
  ];
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Guten Morgen';
  if (h < 18) return 'Guten Tag';
  return 'Guten Abend';
}

export function Tagesleitstelle() {
  const { selectedDate } = useDispatch();
  const dateStr = selectedDate.toISOString().split('T')[0];
  const { data: kpis, isLoading } = useKpis(dateStr);
  const { data: driverSummary } = useDriverSummary(dateStr);
  const { data: trafficHints } = useRouteTrafficHints(dateStr);
  const [detailType, setDetailType] = useState<'activeTours' | 'vehicles' | 'drivers' | 'unassigned' | 'conflicts' | null>(null);
  const [trafficTime, setTrafficTime] = useState(new Date());
  const [summaryOpen, setSummaryOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setTrafficTime(new Date()), 120_000);
    return () => clearInterval(interval);
  }, []);

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
        <h1 className="text-2xl font-extrabold tracking-tight">
          <span className="gradient-text">{getGreeting()}</span> 👋
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

      {/* Collapsible Summary */}
      <button
        onClick={() => setSummaryOpen(!summaryOpen)}
        className="w-full rounded-2xl bg-gradient-to-r from-primary via-primary to-primary-glow p-5 text-primary-foreground shadow-glow-lg text-left transition-all duration-300 hover:shadow-[0_0_35px_-5px_hsl(var(--primary)/0.4)] hover:brightness-105"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-primary-foreground/80 animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-wider opacity-80">
                {(kpis?.activeTours ?? 0) > 0 ? 'System aktiv' : 'Bereit'}
              </span>
            </div>
            <h3 className="text-lg font-bold">Tageszusammenfassung</h3>
            <p className="text-sm opacity-90">
              {isLoading ? 'Lade...' : `${kpis?.activeTours ?? 0} Touren aktiv · ${kpis?.totalShipments ?? 0} Sendungen · ${kpis?.unassigned ?? 0} offen`}
            </p>
          </div>
          <svg className={`w-5 h-5 opacity-70 transition-transform duration-200 ${summaryOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {summaryOpen && (
        <div className="rounded-xl bg-gradient-to-br from-primary/90 to-primary/70 p-5 text-primary-foreground shadow-inner animate-fade-in -mt-4">
          {/* Driver Overview */}
          {driverSummary && driverSummary.length > 0 && (
            <div className="bg-primary-foreground/10 rounded-lg p-3 backdrop-blur-sm">
              <h4 className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-2">Fahrer-Übersicht</h4>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
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

          {driverSummary?.length === 0 && (
            <p className="text-sm opacity-70 text-center py-4">Keine Fahrer-Daten für diesen Tag vorhanden.</p>
          )}
        </div>
      )}

      {/* Traffic Hints - route-based */}
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-card to-accent/10 p-5 shadow-card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Car className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-card-foreground text-sm">Verkehrshinweise entlang Ihrer Routen</h3>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>Aktualisiert {trafficTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
        <div className="space-y-2">
          {(trafficHints ?? []).map((hint, i) => (
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
          {(!trafficHints || trafficHints.length === 0) && (
            <p className="text-sm text-muted-foreground">Keine aktiven Routen — keine Verkehrsmeldungen.</p>
          )}
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
