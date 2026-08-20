import { useEffect, useState } from 'react';
import { useDispatch } from '@/lib/dispatch-context';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { IntegrationenSektion } from '@/components/settings/IntegrationenSektion';
import { cn } from '@/lib/utils';

type KeyStatus = 'aktiv' | 'zu_pruefen' | 'offen';

type ApiKeyRow = {
  service: string;
  variable: string;
  value: string;
  storage: string;
  status: KeyStatus;
};

function maskValue(raw: string | undefined | null): string {
  if (!raw) return '—';
  if (raw.startsWith('http')) {
    try {
      const u = new URL(raw);
      const host = u.host;
      if (host.length <= 8) return `${u.protocol}//••••`;
      return `${u.protocol}//${host.slice(0, 4)}••••${host.slice(-6)}`;
    } catch {
      return '••••••••••••';
    }
  }
  if (raw.length < 12) return `${raw.slice(0, 2)}••••••••`;
  return `${raw.slice(0, 8)}••••••••••${raw.slice(-5)}`;
}

const STATUS_STYLE: Record<KeyStatus, string> = {
  aktiv: 'bg-success/15 text-success',
  zu_pruefen: 'bg-warning/15 text-warning',
  offen: 'bg-danger/15 text-danger',
};

const STATUS_LABEL: Record<KeyStatus, string> = {
  aktiv: 'aktiv',
  zu_pruefen: 'zu prüfen',
  offen: 'offen',
};

const OPEN_TECH = [
  {
    title: 'Google-Maps-Key im Frontend',
    detail:
      'Code: VITE_GOOGLE_MAPS_API_KEY via .env. GCP: HTTP-Referrer setzen; geleakte Keys rotieren/löschen.',
    phase: 'Phase 9',
    tone: 'success' as const,
  },
  {
    title: 'GRANT SELECT ON users',
    detail: 'Erledigt: Migration 20260805120000 — authenticated darf users lesen (RLS filtert weiter).',
    phase: 'Phase 1',
    tone: 'success' as const,
  },
  {
    title: 'Vault-Verschlüsselung',
    detail: 'Integrations-Credentials nur über Edge Function / Vault — Klartext-Spalten entfernt.',
    phase: 'Phase 3B',
    tone: 'success' as const,
  },
  {
    title: 'Automatische Depot-Auswahl',
    detail:
      'Erledigt: assign-depot (Distance Matrix via GOOGLE_MAPS_API_KEY, sonst Haversine). Braucht Depot-lat/lng + Sendungs-Koordinaten.',
    phase: 'Phase 3A',
    tone: 'success' as const,
  },
  {
    title: 'config.toml Projekt-ID',
    detail: 'Erledigt: project_id = sxqbmxqnwtrgibfryvqf (DC Project).',
    phase: 'Cleanup',
    tone: 'success' as const,
  },
];

export function Einstellungen() {
  const { companyId } = useDispatch();
  const { role } = useAuth();
  const [resolvedCompanyId, setResolvedCompanyId] = useState<string | null>(companyId);
  const [resolvedRole, setResolvedRole] = useState<string>(role ?? '—');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!companyId) {
        const { data } = await supabase.rpc('get_user_company_id');
        if (!cancelled) setResolvedCompanyId((data as string | null) ?? null);
      } else {
        setResolvedCompanyId(companyId);
      }
      const { data: r } = await supabase.rpc('get_my_role');
      if (!cancelled && r) setResolvedRole(String(r));
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const publishable = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  const mapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  const apiKeys: ApiKeyRow[] = [
    {
      service: 'Supabase',
      variable: 'VITE_SUPABASE_URL',
      value: maskValue(supabaseUrl),
      storage: '.env / Vite',
      status: supabaseUrl ? 'aktiv' : 'offen',
    },
    {
      service: 'Supabase',
      variable: 'VITE_SUPABASE_PUBLISHABLE_KEY',
      value: maskValue(publishable),
      storage: '.env / Vite',
      status: publishable ? 'aktiv' : 'offen',
    },
    {
      service: 'Google Maps',
      variable: 'VITE_GOOGLE_MAPS_API_KEY',
      value: maskValue(mapsKey),
      storage: '.env / Vite',
      status: mapsKey ? 'zu_pruefen' : 'offen',
    },
    {
      service: 'Gemini',
      variable: 'GEMINI_API_KEY',
      value: '••••••••••••••••',
      storage: 'Edge Secret (ai-resolve, research-article)',
      status: 'zu_pruefen',
    },
    {
      service: 'Websuche (Artikel)',
      variable: 'Gemini Grounding / SERPER_API_KEY / TAVILY_API_KEY',
      value: 'Gemini-Kontingent prüfen',
      storage: 'Gemini integriert; externe Provider als Edge Secret',
      status: 'zu_pruefen',
    },
    {
      service: 'Supabase',
      variable: 'SUPABASE_SERVICE_ROLE_KEY',
      value: '••••••••••••••••',
      storage: 'Edge Secret',
      status: 'zu_pruefen',
    },
    {
      service: 'Google Distance Matrix',
      variable: 'GOOGLE_MAPS_API_KEY',
      value: '••••••••••••••••',
      storage: 'Edge Secret (assign-depot)',
      status: 'zu_pruefen',
    },
  ];

  const projectRef =
    supabaseUrl?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] ?? 'sxqbmxqnwtrgibfryvqf';

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <p className="section-title">Einstellungen</p>
        <h2 className="page-title mt-1">System & Umgebung</h2>
      </div>

      {/* 1. Umgebung */}
      <div className="glass-card p-5 space-y-3">
        <p className="card-title">Umgebung</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: 'Supabase-Projekt', value: projectRef },
            { label: 'Region', value: 'eu-central-1' },
            { label: 'Company-ID', value: resolvedCompanyId ?? '—' },
            { label: 'Rolle', value: `${resolvedRole} · get_my_role()` },
          ].map((f) => (
            <div key={f.label} className="sub-card p-3">
              <p className="text-[10px] uppercase tracking-wide text-dim font-semibold">{f.label}</p>
              <code className="font-mono text-[12.5px] text-foreground mt-1 block break-all">
                {f.value}
              </code>
            </div>
          ))}
        </div>
      </div>

      {/* 2. API-Schlüssel */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-hairline">
          <p className="card-title">API-Schlüssel</p>
          <p className="meta-text mt-1">Werte immer maskiert — Klartext-Secrets werden nicht gerendert.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-hairline">
                {['Dienst', 'Variable', 'Wert', 'Ablage', 'Status'].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-dim"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {apiKeys.map((row) => (
                <tr key={row.variable} className="border-b border-white/[0.04]">
                  <td className="px-5 py-3 text-sm text-foreground">{row.service}</td>
                  <td className="px-5 py-3">
                    <code className="font-mono text-[11.5px] text-muted-foreground">{row.variable}</code>
                  </td>
                  <td className="px-5 py-3">
                    <code className="font-mono text-[11.5px] text-foreground">{row.value}</code>
                  </td>
                  <td className="px-5 py-3 meta-text">{row.storage}</td>
                  <td className="px-5 py-3">
                    <span
                      className={cn(
                        'inline-block px-1.5 py-0.5 text-[10.5px] font-semibold rounded-sm',
                        STATUS_STYLE[row.status],
                      )}
                    >
                      {STATUS_LABEL[row.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. System-Integrationen */}
      <div className="glass-card p-5 space-y-4">
        <div>
          <p className="card-title">System-Integrationen</p>
          <p className="meta-text mt-1">Fremd-Systeme und Verbindungen — CRUD unverändert.</p>
        </div>
        <IntegrationenSektion companyId={resolvedCompanyId} />
      </div>

      {/* 4. Offene technische Punkte */}
      <div className="glass-card p-5 space-y-3">
        <p className="card-title">Offene technische Punkte</p>
        <div className="space-y-2">
          {OPEN_TECH.map((item) => (
            <div
              key={item.title}
              className={cn(
                'sub-card p-3 border-l-[3px]',
                item.tone === 'danger' && 'border-l-danger',
                item.tone === 'warning' && 'border-l-warning',
                item.tone === 'success' && 'border-l-success',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                <span className="shrink-0 font-mono text-[10.5px] text-dim px-1.5 py-0.5 rounded-sm bg-white/[0.03] border border-hairline">
                  {item.phase}
                </span>
              </div>
              <p className="meta-text mt-1">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
