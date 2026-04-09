import { Play, RotateCcw, CheckCircle, Clock, Loader2, Check, GitBranch, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useState } from 'react';

/* ── Planläufe ── */
const runs = [
  { id: 'RUN-042', status: 'abgeschlossen', time: '14:32', duration: '2m 14s', tours: 12, conflicts: 0 },
  { id: 'RUN-041', status: 'abgeschlossen', time: '12:15', duration: '3m 01s', tours: 11, conflicts: 1 },
  { id: 'RUN-040', status: 'fehlgeschlagen', time: '10:00', duration: '0m 42s', tours: 0, conflicts: 0 },
];

const statusIcon: Record<string, React.ReactNode> = {
  abgeschlossen: <CheckCircle className="w-4 h-4 text-emerald-500" />,
  laufend: <Loader2 className="w-4 h-4 text-primary animate-spin" />,
  fehlgeschlagen: <Clock className="w-4 h-4 text-destructive" />,
};

/* ── Versionen ── */
interface PlanVersion {
  id: string;
  label: string;
  created: string;
  tours: number;
  stops: number;
  status: 'aktiv' | 'entwurf' | 'archiviert';
}

const initialVersions: PlanVersion[] = [
  { id: 'v3', label: 'Version 3', created: '09.04.2026 14:32', tours: 12, stops: 78, status: 'aktiv' },
  { id: 'v2', label: 'Version 2 (Szenario B)', created: '09.04.2026 12:15', tours: 11, stops: 72, status: 'entwurf' },
  { id: 'v1', label: 'Version 1 (Initial)', created: '09.04.2026 08:00', tours: 10, stops: 65, status: 'archiviert' },
];

const statusStyle: Record<string, string> = {
  aktiv: 'bg-emerald-50 text-emerald-700',
  entwurf: 'bg-amber-50 text-amber-700',
  archiviert: 'bg-muted text-muted-foreground',
};

export function Kontrollzentrale() {
  const [versions, setVersions] = useState(initialVersions);

  const activate = (id: string) => {
    setVersions(prev => prev.map(v => ({
      ...v,
      status: v.id === id ? 'aktiv' : (v.status === 'aktiv' ? 'archiviert' : v.status),
    })));
    toast.success(`${id} aktiviert`);
  };

  return (
    <div className="space-y-8">
      {/* Planläufe */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={() => toast.info('Planungslauf gestartet...')}>
            <Play className="w-3.5 h-3.5 mr-1.5" /> Planung starten
          </Button>
          <Button size="sm" variant="secondary" onClick={() => toast.info('Replanung läuft...')}>
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Replanung
          </Button>
        </div>

        <div className="rounded-lg border border-border bg-card">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-sm text-card-foreground">Planläufe</h3>
          </div>
          <div className="divide-y divide-border">
            {runs.map(run => (
              <div key={run.id} className="px-4 py-3 flex items-center gap-4">
                {statusIcon[run.status]}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-card-foreground">{run.id}</p>
                  <p className="text-xs text-muted-foreground">{run.time} · {run.duration}</p>
                </div>
                <div className="text-right text-xs">
                  <p className="text-card-foreground">{run.tours} Touren</p>
                  <p className={cn(run.conflicts > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                    {run.conflicts} Konflikte
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Versionen & Freigabe */}
      <section>
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-sm text-card-foreground">Versionen & Freigabe</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Version</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Erstellt</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Touren</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Stops</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {versions.map(v => (
                <tr key={v.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium text-card-foreground">{v.label}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{v.created}</td>
                  <td className="px-4 py-3 text-center text-card-foreground">{v.tours}</td>
                  <td className="px-4 py-3 text-center text-card-foreground">{v.stops}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn('text-xs font-medium px-2 py-1 rounded-full', statusStyle[v.status])}>
                      {v.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost" className="h-7 text-xs">
                        <Eye className="w-3 h-3 mr-1" /> Delta
                      </Button>
                      {v.status !== 'aktiv' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => activate(v.id)}>
                          <Check className="w-3 h-3 mr-1" /> Aktivieren
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}