import { Route, Truck, Users, AlertTriangle, PackageX, Play, RefreshCw, MoreHorizontal, Zap } from 'lucide-react';
import { KpiCard } from '@/components/dispatch/KpiCard';
import { Button } from '@/components/ui/button';
import { useDispatch } from '@/lib/dispatch-context';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

const kpis = [
  { icon: Route, label: 'Aktive Touren', value: 12, subtitle: '3 abgeschlossen', variant: 'default' as const },
  { icon: Truck, label: 'Fahrzeuge im Einsatz', value: 8, subtitle: 'von 10 verfügbar', variant: 'success' as const },
  { icon: Users, label: 'Fahrer im Einsatz', value: 9, subtitle: '1 abwesend', variant: 'default' as const },
  { icon: PackageX, label: 'Unassigned', value: 3, subtitle: 'Sendungen ohne Tour', variant: 'warning' as const },
  { icon: AlertTriangle, label: 'Konflikte', value: 2, subtitle: 'Zeitfenster / Kapazität', variant: 'destructive' as const },
];

export function Tagesleitstelle() {
  const { navigateTo } = useDispatch();

  const handleDemo = () => {
    toast.success('Demo-Daten geladen', { description: 'Szenario "Normalbetrieb" aktiv' });
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map(kpi => <KpiCard key={kpi.label} {...kpi} />)}
      </div>

      {/* Actions */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="font-semibold text-card-foreground mb-1">Tageszusammenfassung</h3>
        <p className="text-sm text-muted-foreground mb-4">
          12 Touren geplant · 78 Stops · 3 Sendungen offen · 2 Konflikte
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => navigateTo('operative-lage')}>
            <Play className="w-3.5 h-3.5 mr-1.5" /> Plan öffnen
          </Button>
          <Button size="sm" variant="secondary" onClick={() => {
            toast.info('Neuplanung gestartet...');
            navigateTo('kontrollzentrale');
          }}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Neu planen
          </Button>
          <Button size="sm" variant="outline" onClick={handleDemo}>
            <Zap className="w-3.5 h-3.5 mr-1.5" /> One-Click Demo
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => toast.info('Szenario A geladen')}>Szenario A (stabil)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info('Szenario B geladen')}>Szenario B (Problem)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info('QA-Prüfung läuft...')}>QA-Prüfungen</DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info('System-Check OK')}>System-Check</DropdownMenuItem>
              <DropdownMenuItem onClick={() => location.reload()}>Neu laden</DropdownMenuItem>
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
          <p className="text-xs text-muted-foreground">3 unbearbeitete Probleme, 2 Konflikte</p>
        </button>
        <button onClick={() => navigateTo('versionen')} className="rounded-lg border border-border bg-card p-4 text-left hover:border-primary/40 transition-colors">
          <div className="flex items-center gap-2 mb-1">
            <Route className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm text-card-foreground">Planversionen</span>
          </div>
          <p className="text-xs text-muted-foreground">Version 3 aktiv · 2 Entwürfe</p>
        </button>
        <button onClick={() => navigateTo('fahrer')} className="rounded-lg border border-border bg-card p-4 text-left hover:border-primary/40 transition-colors">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm text-card-foreground">Fahrer & Fahrzeuge</span>
          </div>
          <p className="text-xs text-muted-foreground">9 aktiv · 1 abwesend</p>
        </button>
      </div>
    </div>
  );
}
