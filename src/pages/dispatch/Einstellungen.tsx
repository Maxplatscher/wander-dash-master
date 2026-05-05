import { useState, useEffect } from 'react';
import { Settings, Monitor, Building, Wrench, Palette, Check, ChevronRight, ChevronLeft, PlugZap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { IntegrationenSektion } from '@/components/settings/IntegrationenSektion';

/* ── Theme presets ── */
interface ThemePreset {
  name: string;
  primary: string;
  sidebarBg: string;
  sidebarPrimary: string;
  sidebarAccent: string;
  sidebarBorder: string;
  preview: string; // tailwind-safe color for the dot
}

const themes: ThemePreset[] = [
  {
    name: 'Teal (Standard)',
    primary: '174 62% 38%',
    sidebarBg: '210 25% 14%',
    sidebarPrimary: '174 62% 50%',
    sidebarAccent: '210 20% 20%',
    sidebarBorder: '210 15% 22%',
    preview: '#319795',
  },
  {
    name: 'Blau',
    primary: '217 91% 60%',
    sidebarBg: '222 47% 11%',
    sidebarPrimary: '217 91% 60%',
    sidebarAccent: '222 30% 18%',
    sidebarBorder: '222 25% 20%',
    preview: '#3B82F6',
  },
  {
    name: 'Violett',
    primary: '262 83% 58%',
    sidebarBg: '270 30% 12%',
    sidebarPrimary: '262 83% 58%',
    sidebarAccent: '270 20% 20%',
    sidebarBorder: '270 15% 22%',
    preview: '#8B5CF6',
  },
  {
    name: 'Orange',
    primary: '25 95% 53%',
    sidebarBg: '20 25% 12%',
    sidebarPrimary: '25 95% 53%',
    sidebarAccent: '20 20% 20%',
    sidebarBorder: '20 15% 22%',
    preview: '#F97316',
  },
  {
    name: 'Grün',
    primary: '142 71% 45%',
    sidebarBg: '150 25% 12%',
    sidebarPrimary: '142 71% 45%',
    sidebarAccent: '150 20% 20%',
    sidebarBorder: '150 15% 22%',
    preview: '#22C55E',
  },
  {
    name: 'Rot',
    primary: '0 72% 51%',
    sidebarBg: '0 25% 12%',
    sidebarPrimary: '0 72% 51%',
    sidebarAccent: '0 20% 20%',
    sidebarBorder: '0 15% 22%',
    preview: '#EF4444',
  },
];

function applyTheme(t: ThemePreset) {
  const root = document.documentElement;
  root.style.setProperty('--primary', t.primary);
  root.style.setProperty('--ring', t.primary);
  root.style.setProperty('--accent', t.primary.replace(/\d+%$/, '92%'));
  root.style.setProperty('--accent-foreground', t.primary.replace(/\d+%$/, '25%'));
  root.style.setProperty('--sidebar-background', t.sidebarBg);
  root.style.setProperty('--sidebar-primary', t.sidebarPrimary);
  root.style.setProperty('--sidebar-accent', t.sidebarAccent);
  root.style.setProperty('--sidebar-border', t.sidebarBorder);
  root.style.setProperty('--sidebar-ring', t.sidebarPrimary);
}

function loadSavedTheme(): string {
  return localStorage.getItem('dispatch-theme') ?? 'Teal (Standard)';
}
function saveTheme(name: string) {
  localStorage.setItem('dispatch-theme', name);
}

/* ── Section IDs ── */
type SettingsSection = 'ui' | 'betrieb' | 'system' | 'integrationen' | 'benutzer';

const sectionMeta: { id: SettingsSection; icon: React.ElementType; label: string; desc: string }[] = [
  { id: 'ui', icon: Monitor, label: 'UI-Einstellungen', desc: 'Theme, Sprache, Layout' },
  { id: 'betrieb', icon: Building, label: 'Betriebskonfiguration', desc: 'Mandant, Zeitfenster, Regeln' },
  { id: 'system', icon: Wrench, label: 'System', desc: 'Cache, Logging' },
  { id: 'integrationen', icon: PlugZap, label: 'System-Integrationen', desc: 'Fremd-Systeme und Verbindungen' },
  { id: 'benutzer', icon: Settings, label: 'Benutzer & Rollen', desc: 'Zugänge, Berechtigungen' },
];

/* ── Sub-panels ── */

function UISettings() {
  const [activeTheme, setActiveTheme] = useState(loadSavedTheme);
  const [compactMode, setCompactMode] = useState(() => localStorage.getItem('dispatch-compact') === 'true');
  const [language, setLanguage] = useState(() => localStorage.getItem('dispatch-lang') ?? 'de');

  const handleTheme = (t: ThemePreset) => {
    applyTheme(t);
    setActiveTheme(t.name);
    saveTheme(t.name);
    toast.success(`Theme „${t.name}" aktiviert`);
  };

  useEffect(() => {
    localStorage.setItem('dispatch-compact', String(compactMode));
  }, [compactMode]);

  useEffect(() => {
    localStorage.setItem('dispatch-lang', language);
  }, [language]);

  return (
    <div className="space-y-6">
      {/* Theme picker */}
      <div>
        <h4 className="text-sm font-semibold text-card-foreground flex items-center gap-2 mb-3">
          <Palette className="w-4 h-4" /> Farbschema
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {themes.map(t => (
            <button
              key={t.name}
              onClick={() => handleTheme(t)}
              className={cn(
                'relative rounded-lg border p-4 text-left transition-all hover:shadow-md',
                activeTheme === t.name
                  ? 'border-primary ring-2 ring-primary/30 bg-accent/30'
                  : 'border-border bg-card hover:border-primary/30'
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="w-5 h-5 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: t.preview }} />
                <span className="text-xs font-medium text-card-foreground">{t.name}</span>
              </div>
              {/* mini preview bar */}
              <div className="flex gap-1 mt-2">
                <div className="h-2 flex-1 rounded" style={{ backgroundColor: t.preview }} />
                <div className="h-2 w-6 rounded bg-muted" />
                <div className="h-2 w-4 rounded bg-muted" />
              </div>
              {activeTheme === t.name && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-3 h-3 text-primary-foreground" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Compact mode */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
        <div>
          <Label className="text-sm font-medium">Kompakt-Modus</Label>
          <p className="text-xs text-muted-foreground">Weniger Abstände, mehr Inhalt pro Seite</p>
        </div>
        <Switch checked={compactMode} onCheckedChange={setCompactMode} />
      </div>

      {/* Language */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
        <div>
          <Label className="text-sm font-medium">Sprache</Label>
          <p className="text-xs text-muted-foreground">Anzeigesprache des Dashboards</p>
        </div>
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="de">Deutsch</SelectItem>
            <SelectItem value="en">English</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function BetriebSettings() {
  return (
    <div className="space-y-4">
      {[
        { label: 'Standard-Zeitfenster', desc: 'Liefer-Zeitfenster für neue Sendungen', value: '08:00 – 18:00' },
        { label: 'Max. Stopps pro Tour', desc: 'Obergrenze für die Tourenplanung', value: '25' },
        { label: 'Planungsvorlauf', desc: 'Tage im Voraus für die automatische Planung', value: '1 Tag' },
      ].map(item => (
        <div key={item.label} className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
          <div>
            <p className="text-sm font-medium text-card-foreground">{item.label}</p>
            <p className="text-xs text-muted-foreground">{item.desc}</p>
          </div>
          <span className="text-xs font-mono bg-muted px-2 py-1 rounded text-muted-foreground">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function SystemSettings() {
  return (
    <div className="space-y-4">
      {[
        { label: 'Cache leeren', desc: 'Lokale Daten zurücksetzen', action: 'Cache leeren' },
        { label: 'Logging-Level', desc: 'Aktuell: Info', action: 'Ändern' },
      ].map(item => (
        <div key={item.label} className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
          <div>
            <p className="text-sm font-medium text-card-foreground">{item.label}</p>
            <p className="text-xs text-muted-foreground">{item.desc}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => {
              if (item.label === 'Cache leeren') {
                localStorage.clear();
                toast.success('Cache geleert');
                window.location.reload();
              } else {
                toast.info('Wird in einem zukünftigen Update verfügbar');
              }
            }}
          >
            {item.action}
          </Button>
        </div>
      ))}
    </div>
  );
}

function IntegrationenSettings({ companyId }: { companyId: string | null }) {
  return (
    <section>
      <h2 className="text-lg font-semibold mb-4">System-Integrationen</h2>
      <IntegrationenSektion companyId={companyId} />
    </section>
  );
}

function BenutzerSettings() {
  return (
    <div className="space-y-4 text-sm text-muted-foreground">
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="font-medium text-card-foreground mb-1">Rollen & Berechtigungen</p>
        <p className="text-xs">Admin, Dispatcher und Fahrer – Rollen werden über das Backend verwaltet.</p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="font-medium text-card-foreground mb-1">Audit-Log</p>
        <p className="text-xs">Alle Änderungen werden protokolliert und sind für Admins einsehbar.</p>
      </div>
    </div>
  );
}

/* ── Main ── */

export function Einstellungen() {
  const [active, setActive] = useState<SettingsSection | null>(null);
  const [currentCompanyId, setCurrentCompanyId] = useState<string | null>(null);

  // Apply saved theme on mount
  useEffect(() => {
    const saved = loadSavedTheme();
    const t = themes.find(th => th.name === saved);
    if (t) applyTheme(t);
  }, []);

  useEffect(() => {
    const loadCompanyId = async () => {
      const { data, error } = await supabase.rpc('get_user_company_id');
      if (error) {
        toast.error(`company_id konnte nicht geladen werden: ${error.message}`);
        return;
      }
      setCurrentCompanyId(data ?? null);
    };
    loadCompanyId();
  }, []);

  if (active) {
    const meta = sectionMeta.find(s => s.id === active)!;
    const Panel = {
      ui: UISettings,
      betrieb: BetriebSettings,
      system: SystemSettings,
      integrationen: () => <IntegrationenSettings companyId={currentCompanyId} />,
      benutzer: BenutzerSettings,
    }[active];

    return (
      <div className="space-y-4">
        <button
          onClick={() => setActive(null)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Zurück
        </button>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center">
            <meta.icon className="w-4 h-4 text-accent-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-card-foreground">{meta.label}</h3>
            <p className="text-xs text-muted-foreground">{meta.desc}</p>
          </div>
        </div>
        <Panel />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {sectionMeta.map(s => (
        <button
          key={s.id}
          onClick={() => setActive(s.id)}
          className="rounded-lg border border-border bg-card p-5 hover:border-primary/30 transition-colors cursor-pointer text-left group"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center">
              <s.icon className="w-4 h-4 text-accent-foreground" />
            </div>
            <h3 className="font-semibold text-sm text-card-foreground">{s.label}</h3>
            <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-xs text-muted-foreground">{s.desc}</p>
        </button>
      ))}
    </div>
  );
}
