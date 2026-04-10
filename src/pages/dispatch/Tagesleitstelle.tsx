import { Route, Truck, Users, AlertTriangle, PackageX, Play, RefreshCw, MoreHorizontal, Zap, Loader2, ArrowRight, Clock, CheckCircle2 } from 'lucide-react';
import { KpiCard } from '@/components/dispatch/KpiCard';
import { KpiDetailDialog } from '@/components/dispatch/KpiDetailDialog';
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

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Guten Morgen';
  if (h < 18) return 'Guten Tag';
  return 'Guten Abend';
}

const activityItems = [
  { icon: CheckCircle2, text: 'System bereit', time: 'Jetzt', color: 'text-emerald-500' },
  { icon: Clock, text: 'Tagesplanung verfügbar', time: 'Heute', color: 'text-primary' },
  { icon: Zap, text: 'Demo-Daten können geladen werden', time: '', color: 'text-amber-500' },
];

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
    { icon: Route, label: 'Aktive Touren', value: kpis?.activeTours ?? 0, subtitle: `${kpis?.totalTours ?? 0} gesamt`, variant: 'default' as const, pulse: (kpis?.activeTours ?? 0) > 0 },
    { icon: Truck, label: 'Fahrzeuge im Einsatz', value: kpis?.vehiclesInUse ?? 0, subtitle: `von ${kpis?.totalVehicles ?? 0} verfügbar`, variant: 'success' as const },
    { icon: Users, label: 'Fahrer im Einsatz', value: kpis?.activeDrivers ?? 0, subtitle: `${kpis?.absentDrivers ?? 0} abwesend`, variant: 'default' as const },
    { icon: PackageX, label: 'Unzugewiesen', value: kpis?.unassigned ?? 0, subtitle: 'Sendungen ohne Tour', variant: (kpis?.unassigned ?? 0) > 0 ? 'warning' as const : 'default' as const },
    { icon: AlertTriangle, label: 'Konflikte', value: kpis?.conflicts ?? 0, subtitle: 'Zeitfenster / Kapazität', variant: (kpis?.conflicts ?? 0) > 0 ? 'destructive' as const : 'default' as const },
  ];

  const quickLinks = [
    { onClick: () => navigateTo('probleme'), icon: AlertTriangle, iconColor: 'bg-red-500/10 text-red-500', title: 'Offene Probleme', desc: `${kpis?.unassigned ?? 0} unzugewiesene Sendungen` },
    { onClick: () => navigateTo('kontrollzentrale'), icon: Route, iconColor: 'bg-primary/10 text-primary', title: 'Planversionen', desc: `${kpis?.totalTours ?? 0} Touren geplant` },
    { onClick: () => navigateTo('fahrer'), icon: Users, iconColor: 'bg-primary/10 text-primary', title: 'Fahrer & Fahrzeuge', desc: `${kpis?.activeDrivers ?? 0} aktiv · ${kpis?.absentDrivers ?? 0} abwesend` },
  ];

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

      {/* Hero Summary */}
      <div className="rounded-xl bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground shadow-lg">
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-primary-foreground/80 animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-wider opacity-80">
            {(kpis?.activeTours ?? 0) > 0 ? 'System aktiv' : 'Bereit'}
          </span>
        </div>
        <h3 className="text-lg font-bold mb-1">Tageszusammenfassung</h3>
        <p className="text-sm opacity-90 mb-5">
          {isLoading ? 'Lade...' : `${kpis?.activeTours ?? 0} Touren aktiv · ${kpis?.totalShipments ?? 0} Sendungen · ${kpis?.unassigned ?? 0} offen`}
        </p>
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

      {/* Quick Links + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Quick Links */}
        {quickLinks.map((link) => (
          <button key={link.title} onClick={link.onClick} className="group rounded-xl border border-border bg-card p-5 text-left hover:border-primary/40 hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${link.iconColor}`}>
                  <link.icon className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-semibold text-sm text-card-foreground">{link.title}</span>
                  <p className="text-xs text-muted-foreground mt-0.5">{link.desc}</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200" />
            </div>
          </button>
        ))}
      </div>

      {/* Activity Timeline */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-semibold text-card-foreground mb-4 text-sm">Letzte Aktivitäten</h3>
        <div className="space-y-3">
          {activityItems.map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg bg-muted flex items-center justify-center ${item.color}`}>
                <item.icon className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-card-foreground">{item.text}</p>
              </div>
              {item.time && <span className="text-xs text-muted-foreground">{item.time}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
