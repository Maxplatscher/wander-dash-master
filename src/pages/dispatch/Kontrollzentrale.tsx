import { Play, RotateCcw, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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

export function Kontrollzentrale() {
  return (
    <div className="space-y-6">
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
    </div>
  );
}
