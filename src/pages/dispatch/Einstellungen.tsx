import { Settings, Monitor, Building, Wrench } from 'lucide-react';

const sections = [
  { icon: Monitor, label: 'UI-Einstellungen', desc: 'Theme, Sprache, Layout-Präferenzen' },
  { icon: Building, label: 'Betriebskonfiguration', desc: 'Mandant, Zeitfenster, Kapazitätsregeln' },
  { icon: Wrench, label: 'System', desc: 'API-Endpoints, Cache, Logging' },
  { icon: Settings, label: 'Benutzer & Rollen', desc: 'Zugänge, Berechtigungen, Audit-Log' },
];

export function Einstellungen() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {sections.map(s => (
        <div key={s.label} className="rounded-lg border border-border bg-card p-5 hover:border-primary/30 transition-colors cursor-pointer">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center">
              <s.icon className="w-4 h-4 text-accent-foreground" />
            </div>
            <h3 className="font-semibold text-sm text-card-foreground">{s.label}</h3>
          </div>
          <p className="text-xs text-muted-foreground">{s.desc}</p>
        </div>
      ))}
    </div>
  );
}
