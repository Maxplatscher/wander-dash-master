import { Check, GitBranch, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useState } from 'react';

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

export function Versionen() {
  const [versions, setVersions] = useState(initialVersions);

  const activate = (id: string) => {
    setVersions(prev => prev.map(v => ({
      ...v,
      status: v.id === id ? 'aktiv' : (v.status === 'aktiv' ? 'archiviert' : v.status),
    })));
    toast.success(`${id} aktiviert`);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card overflow-hidden">
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
    </div>
  );
}
