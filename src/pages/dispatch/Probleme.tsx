import { PackageX, AlertTriangle, AlertCircle, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface Problem {
  id: string;
  type: 'unassigned' | 'conflict' | 'warning' | 'email';
  title: string;
  detail: string;
  severity: 'hoch' | 'mittel' | 'niedrig';
}

const problems: Problem[] = [
  { id: 'P-001', type: 'unassigned', title: '3 Sendungen ohne Tourzuordnung', detail: 'Kundenaufträge #4821, #4822, #4825 – Gebiet Süd', severity: 'hoch' },
  { id: 'P-002', type: 'conflict', title: 'Zeitfensterkonflikt Tour T-004', detail: 'Stop 3 & 4 überlappen: 14:00–14:30 vs 14:15–14:45', severity: 'hoch' },
  { id: 'P-003', type: 'conflict', title: 'Kapazitätsüberschreitung T-001', detail: 'Gewicht 1.240 kg überschreitet Fahrzeuglimit 1.200 kg', severity: 'mittel' },
  { id: 'P-004', type: 'warning', title: 'Fahrer Jan Peters abwesend', detail: 'Keine Vertretung zugewiesen · 0 Touren geplant', severity: 'niedrig' },
  { id: 'P-005', type: 'email', title: '2 E-Mails unvollständig', detail: 'Manuelle Prüfung erforderlich · fehlende Adressdaten', severity: 'mittel' },
];

const typeIcon: Record<string, React.ReactNode> = {
  unassigned: <PackageX className="w-4 h-4 text-amber-500" />,
  conflict: <AlertTriangle className="w-4 h-4 text-destructive" />,
  warning: <AlertCircle className="w-4 h-4 text-muted-foreground" />,
  email: <Mail className="w-4 h-4 text-info" />,
};

const severityStyle: Record<string, string> = {
  hoch: 'bg-red-50 text-red-700 border-red-200',
  mittel: 'bg-amber-50 text-amber-700 border-amber-200',
  niedrig: 'bg-muted text-muted-foreground border-border',
};

export function Probleme() {
  return (
    <div className="space-y-3">
      {/* Filter tabs */}
      <div className="flex gap-2 text-xs">
        {['Alle', 'Unassigned', 'Konflikte', 'Warnungen', 'E-Mail'].map(tab => (
          <Badge key={tab} variant={tab === 'Alle' ? 'default' : 'outline'} className="cursor-pointer">
            {tab}
          </Badge>
        ))}
      </div>

      <div className="space-y-2">
        {problems.map(p => (
          <div key={p.id} className={cn(
            'rounded-lg border bg-card p-4 flex items-start gap-3',
            p.severity === 'hoch' && 'border-red-200'
          )}>
            <div className="mt-0.5">{typeIcon[p.type]}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-medium text-card-foreground">{p.title}</span>
                <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full border', severityStyle[p.severity])}>
                  {p.severity}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{p.detail}</p>
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0">{p.id}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
