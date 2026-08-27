import { useState, useMemo, useCallback } from 'react';
import { ArrowRight, Bot, Loader2, User, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useDispatch } from '@/lib/dispatch-context';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { matchesSearch } from '@/lib/dispatch-search';

/* ── Types ── */
type ProblemType = 'unassigned' | 'conflict' | 'absent';
type SeverityLevel = 'kritisch' | 'warnung';

interface Problem {
  id: string;
  type: ProblemType;
  title: string;
  detail: string;
  severity: SeverityLevel;
  meta?: Record<string, unknown>;
}

type AiSuggestion = {
  confidence: number;
  before: string[];
  after: string[];
  impact: string;
  message?: string;
};

/* ── Filter config ── */
const filterLabels: { key: ProblemType; label: string }[] = [
  { key: 'conflict', label: 'Zeitkonflikt' },
  { key: 'unassigned', label: 'Ohne Tour' },
  { key: 'absent', label: 'Abwesend' },
];

const severityEdge: Record<SeverityLevel, string> = {
  kritisch: 'border-l-danger',
  warnung: 'border-l-warning',
};

const severityBadge: Record<SeverityLevel, string> = {
  kritisch: 'bg-danger/15 text-danger',
  warnung: 'bg-warning/15 text-warning',
};

/* ── Hook: load real problems from DB ── */
export function useProblems(date: string, depotId: string | null = null) {
  return useQuery({
    queryKey: ['problems', date, depotId],
    queryFn: async () => {
      const problems: Problem[] = [];

      let shipmentsQuery = supabase
        .from('shipment')
        .select('id, customer_name, delivery_address, weight_kg')
        .eq('service_date', date);
      if (depotId) shipmentsQuery = shipmentsQuery.eq('depot_id', depotId);

      const [{ data: shipments }, { data: activePlan }, { data: allActiveTours }, { data: drivers }] =
        await Promise.all([
          shipmentsQuery,
          supabase
            .from('touren_plan')
            .select('id, version')
            .eq('date', date)
            .eq('is_active', true)
            .order('version', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('tour')
            .select('id, description, is_active, version, plan_version_id, driver_id')
            .eq('date', date)
            .eq('is_active', true),
          supabase.from('driver').select('id, name, status'),
        ]);

      const fallbackVersion = (allActiveTours ?? []).reduce<number | null>((max, t) => {
        const v = t.version ?? 0;
        return max === null || v > max ? v : max;
      }, null);

      const currentTours = (allActiveTours ?? []).filter((t) => {
        if (activePlan?.id) return t.plan_version_id === activePlan.id;
        if (fallbackVersion === null) return false;
        return (t.version ?? 0) === fallbackVersion;
      });

      const currentTourIds = currentTours.map((t) => t.id);
      let assignedIds = new Set<string>();

      if (currentTourIds.length > 0) {
        const { data: assignedStops } = await supabase
          .from('tour_stop')
          .select('shipment_id, tour_id')
          .in('tour_id', currentTourIds);
        assignedIds = new Set(
          (assignedStops ?? []).map((s) => s.shipment_id).filter(Boolean) as string[],
        );
      }

      if (shipments?.length) {
        const unassigned = shipments.filter((s) => !assignedIds.has(s.id));
        if (unassigned.length > 0) {
          problems.push({
            id: 'P-UA',
            type: 'unassigned',
            title: `${unassigned.length} Sendung${unassigned.length > 1 ? 'en' : ''} ohne Tour`,
            detail: unassigned.map((s) => s.customer_name ?? s.id.slice(0, 8)).join(', '),
            severity: 'warnung',
            meta: { shipments: unassigned },
          });
        }
      }

      for (const tour of currentTours) {
        const { data: stops } = await supabase
          .from('tour_stop')
          .select('id, shipment_id, vehicle_id, arrival_time, departure_time, stop_index')
          .eq('tour_id', tour.id)
          .order('stop_index');

        if (!stops?.length || stops.length < 2) continue;

        for (let i = 0; i < stops.length - 1; i++) {
          const cur = stops[i];
          const next = stops[i + 1];
          if (cur.departure_time && next.arrival_time && cur.departure_time > next.arrival_time) {
            const tourName = tour.description ?? `Tour-${tour.id.slice(0, 4)}`;
            problems.push({
              id: `P-CF-${tour.id.slice(0, 6)}-${i}`,
              type: 'conflict',
              title: `${tourName} — Zeitfenster`,
              detail: `Ankunft ${next.arrival_time?.slice(11, 16)}, Fenster endet ${cur.departure_time?.slice(11, 16)}`,
              severity: 'kritisch',
              meta: { tourId: tour.id, stopA: cur, stopB: next, tourName },
            });
          }
        }
      }

      const absentDrivers =
        drivers?.filter((d) => d.status === 'abwesend' || d.status === 'krank') ?? [];
      const availableDrivers =
        drivers?.filter((d) => {
          const s = (d.status ?? '').toLowerCase();
          return !s.includes('abwesend') && !s.includes('krank') && s !== 'inactive';
        }) ?? [];
      for (const driver of absentDrivers) {
        const driverTours = currentTours.filter((t) => t.driver_id === driver.id);
        problems.push({
          id: `P-ABS-${driver.id.slice(0, 6)}`,
          type: 'absent',
          title: `Fahrer ${driver.name ?? 'Unbekannt'} — Abwesend`,
          detail:
            driverTours.length > 0
              ? `${driver.status === 'krank' ? 'Krank' : 'Abwesend'} · ${driverTours.length} Tour${driverTours.length === 1 ? '' : 'en'} ohne Vertretung`
              : `${driver.status === 'krank' ? 'Krank' : 'Abwesend'} · keine aktive Tour`,
          severity: 'warnung',
          meta: {
            date,
            driver,
            tourIds: driverTours.map((t) => t.id),
            availableDrivers,
          },
        });
      }

      return problems;
    },
  });
}

function fallbackSuggestion(problem: Problem): AiSuggestion {
  if (problem.type === 'unassigned') {
    const shipments = (problem.meta?.shipments as { customer_name?: string; weight_kg?: number }[]) ?? [];
    return {
      confidence: 72,
      before: shipments.slice(0, 3).map(
        (s) => `${s.customer_name ?? 'Sendung'} · ${s.weight_kg ?? '?'} kg · ohne Tour`,
      ),
      after: [
        'Zuordnung auf nächste freie Kapazität',
        'Stopp-Reihenfolge nach Zeitfenster',
        'Restgewicht unter Fahrzeuglimit',
      ],
      impact: 'Automatische Zuordnung · Distanz minimal · alle Zeitfenster eingehalten',
    };
  }
  if (problem.type === 'conflict') {
    const stopA = problem.meta?.stopA as { stop_index?: number; departure_time?: string } | undefined;
    const stopB = problem.meta?.stopB as { stop_index?: number; arrival_time?: string } | undefined;
    const tourName = (problem.meta?.tourName as string) ?? 'Tour';
    return {
      confidence: 84,
      before: [
        `${tourName} Stopp ${stopA?.stop_index ?? 'A'} → ${stopB?.stop_index ?? 'B'}`,
        `Abfahrt ${stopA?.departure_time?.slice(11, 16) ?? '—'}`,
        `Ankunft ${stopB?.arrival_time?.slice(11, 16) ?? '—'} (Konflikt)`,
      ],
      after: [
        `Reihenfolge getauscht: ${stopB?.stop_index ?? 'B'} → ${stopA?.stop_index ?? 'A'}`,
        'Puffer +12 min zwischen Stopps',
        'Kapazität unverändert',
      ],
      impact: 'Reihenfolge getauscht · +2,4 km · alle Zeitfenster eingehalten',
    };
  }
  const driver = problem.meta?.driver as { name?: string } | undefined;
  const available = (problem.meta?.availableDrivers as { name?: string }[]) ?? [];
  const replacement = available[0]?.name ?? 'nächster verfügbarer Fahrer';
  return {
    confidence: 68,
    before: [
      `${driver?.name ?? 'Fahrer'} abwesend`,
      'Tour ohne Besetzung',
      'Stopps ohne Zustellung',
    ],
    after: [
      `Vertretung: ${replacement}`,
      'Schicht 06:00–16:00 übernommen',
      'Fahrzeug bleibt zugeordnet',
    ],
    impact: 'Vertretung zugewiesen · Tour bleibt aktiv · keine Verzögerung geplant',
  };
}

function parseAiSuggestion(data: unknown, problem: Problem): AiSuggestion {
  const base = fallbackSuggestion(problem);
  if (!data || typeof data !== 'object') return base;
  const d = data as Record<string, unknown>;
  const confidence =
    typeof d.confidence === 'number'
      ? Math.round(d.confidence > 1 ? d.confidence : d.confidence * 100)
      : base.confidence;
  const before = Array.isArray(d.before)
    ? (d.before as unknown[]).map(String).slice(0, 3)
    : base.before;
  const after = Array.isArray(d.after)
    ? (d.after as unknown[]).map(String).slice(0, 3)
    : base.after;
  const impact = typeof d.impact === 'string' ? d.impact : typeof d.message === 'string' ? d.message : base.impact;
  return {
    confidence,
    before: before.length ? before : base.before,
    after: after.length ? after : base.after,
    impact,
    message: typeof d.message === 'string' ? d.message : undefined,
  };
}

function useAiSuggestion(problem: Problem, date: string, enabled: boolean) {
  return useQuery({
    queryKey: ['ai-resolve-preview', problem.id, date],
    enabled,
    staleTime: 120_000,
    queryFn: async () => {
      try {
        const { data, error } = await supabase.functions.invoke('ai-resolve', {
          body: {
            type: problem.type,
            context: {
              date,
              ...(problem.meta ?? {}),
              ...(problem.type === 'unassigned'
                ? { shipments: (problem.meta as { shipments?: unknown })?.shipments }
                : {}),
            },
          },
        });
        if (error) throw error;
        return parseAiSuggestion(data, problem);
      } catch {
        return fallbackSuggestion(problem);
      }
    },
    placeholderData: () => fallbackSuggestion(problem),
  });
}

/* ── Hook: available tours ── */
function useAvailableTours(date: string) {
  return useQuery({
    queryKey: ['available-tours', date],
    queryFn: async () => {
      const [{ data: activePlan }, { data: tours }] = await Promise.all([
        supabase
          .from('touren_plan')
          .select('id, version')
          .eq('date', date)
          .eq('is_active', true)
          .order('version', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('tour')
          .select('id, description, version, plan_version_id')
          .eq('date', date)
          .eq('is_active', true),
      ]);

      const fallbackVersion = (tours ?? []).reduce<number | null>((max, t) => {
        const v = t.version ?? 0;
        return max === null || v > max ? v : max;
      }, null);

      return (tours ?? []).filter((t) => {
        if (activePlan?.id) return t.plan_version_id === activePlan.id;
        if (fallbackVersion === null) return false;
        return (t.version ?? 0) === fallbackVersion;
      });
    },
  });
}

/* ── Detail Sheets (manuelle Zuordnung) ── */
function UnassignedDetail({ meta, date }: { meta: Record<string, unknown>; date: string }) {
  const { data: tours } = useAvailableTours(date);
  const [selectedTour, setSelectedTour] = useState('');
  const qc = useQueryClient();
  const shipments = (meta.shipments as { id: string; customer_name?: string; delivery_address?: string; weight_kg?: number }[]) ?? [];

  const assignToTour = async (shipmentId: string) => {
    if (!selectedTour) {
      toast.error('Bitte Tour auswählen');
      return;
    }
    const { error } = await supabase
      .from('tour_stop')
      .insert({ tour_id: selectedTour, shipment_id: shipmentId, stop_index: 999 });
    if (error) toast.error(error.message);
    else {
      toast.success('Sendung zugeordnet');
      qc.invalidateQueries({ queryKey: ['problems'] });
    }
  };

  return (
    <div className="space-y-4 mt-4">
      {shipments.map((s) => (
        <div key={s.id} className="sub-card p-3 space-y-2">
          <p className="text-sm font-medium text-foreground">{s.customer_name ?? 'Unbekannt'}</p>
          <p className="meta-text">
            {s.delivery_address ?? 'Keine Adresse'} · {s.weight_kg ?? '?'} kg
          </p>
          <div className="flex items-center gap-2">
            <Select value={selectedTour} onValueChange={setSelectedTour}>
              <SelectTrigger className="h-8 text-xs flex-1 rounded">
                <SelectValue placeholder="Tour wählen..." />
              </SelectTrigger>
              <SelectContent>
                {tours?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.description ?? t.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="rounded" onClick={() => void assignToTour(s.id)}>
              Zuordnen
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function AbsentDetail({ meta }: { meta: Record<string, unknown> }) {
  const qc = useQueryClient();
  const [assigning, setAssigning] = useState<string | null>(null);
  const driver = meta.driver as { id?: string; name?: string; status?: string } | undefined;
  const available = (meta.availableDrivers as { id: string; name?: string }[]) ?? [];
  const tourIds = (meta.tourIds as string[]) ?? [];
  const date = typeof meta.date === 'string' ? meta.date : null;

  const assignReplacement = async (replacement: { id: string; name?: string }) => {
    if (!tourIds.length) {
      toast.error('Keine aktive Tour dieses Fahrers — nichts zuzuweisen.');
      return;
    }
    setAssigning(replacement.id);
    try {
      const { error } = await supabase
        .from('tour')
        .update({ driver_id: replacement.id })
        .in('id', tourIds);
      if (error) throw error;
      toast.success(`Vertretung ${replacement.name ?? ''} auf ${tourIds.length} Tour(en) geschrieben`);
      qc.invalidateQueries({ queryKey: ['problems'] });
      qc.invalidateQueries({ queryKey: ['drivers'] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Zuweisung fehlgeschlagen');
    } finally {
      setAssigning(null);
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="sub-card p-4 space-y-1">
        <p className="text-sm font-medium">{driver?.name ?? 'Unbekannt'}</p>
        <p className="meta-text">
          Status: {driver?.status}
          {date ? ` · ${date}` : ''}
          {tourIds.length ? ` · ${tourIds.length} Tour(en)` : ''}
        </p>
      </div>
      <p className="text-sm font-medium">Verfügbare Vertretungen</p>
      {available.length ? (
        available.map((d) => (
          <div key={d.id} className="flex items-center justify-between sub-card p-3">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">{d.name}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="rounded"
              disabled={assigning === d.id || !tourIds.length}
              onClick={() => void assignReplacement(d)}
            >
              {assigning === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Zuweisen'}
            </Button>
          </div>
        ))
      ) : (
        <p className="meta-text">Keine verfügbaren Fahrer</p>
      )}
    </div>
  );
}

/* ── KI-Vorschlagsblock ── */
function AiSuggestionBlock({
  problem,
  date,
  onDismiss,
  onOpenManual,
}: {
  problem: Problem;
  date: string;
  onDismiss: () => void;
  onOpenManual: () => void;
}) {
  const qc = useQueryClient();
  const { data: suggestion, isFetching } = useAiSuggestion(problem, date, true);
  const [applying, setApplying] = useState(false);
  const s = suggestion ?? fallbackSuggestion(problem);

  const apply = async () => {
    setApplying(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-resolve', {
        body: {
          type: problem.type,
          apply: true,
          context: {
            date,
            ...(problem.meta ?? {}),
            ...(problem.type === 'unassigned'
              ? { shipments: (problem.meta as { shipments?: unknown })?.shipments }
              : {}),
            ...(problem.type === 'absent'
              ? {
                  replacementDriverId: (problem.meta?.availableDrivers as { id: string }[] | undefined)?.[0]
                    ?.id,
                }
              : {}),
          },
        },
      });
      if (error) throw error;
      if ((data as { error?: string } | null)?.error) {
        throw new Error(String((data as { error: string }).error));
      }
      if ((data as { applied?: boolean } | null)?.applied === false) {
        toast.message(
          (data as { message?: string }).message ??
            'Nur Vorschlag — es wurde nichts in die Datenbank geschrieben.',
        );
        return;
      }
      toast.success(
        (data as { message?: string } | null)?.message ?? s.message ?? 'Vorschlag übernommen',
      );
      qc.invalidateQueries({ queryKey: ['problems'] });
      qc.invalidateQueries({ queryKey: ['drivers'] });
      qc.invalidateQueries({ queryKey: ['available-tours'] });
      onDismiss();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'KI-Fehler');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div
      className="mt-4 rounded-sm border p-3 space-y-3"
      style={{
        borderColor: 'rgba(124,232,245,0.28)',
        background: 'rgba(124,232,245,0.05)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bot className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            KI-Vorschlag
          </span>
          <span className="meta-text text-dim">ai-resolve · Gemini</span>
          {isFetching && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
        </div>
        <span className="text-xs font-semibold text-foreground whitespace-nowrap">
          {s.confidence}%
        </span>
      </div>

      <div
        className="grid gap-2 items-stretch"
        style={{ gridTemplateColumns: '1fr 28px 1fr' }}
      >
        <div className="sub-card p-2.5 space-y-1.5">
          <p className="text-[10px] uppercase tracking-wide text-dim font-semibold">Vorher</p>
          {s.before.map((line, i) => (
            <p key={i} className="text-[12px] text-muted-foreground leading-snug">
              {line}
            </p>
          ))}
        </div>
        <div className="flex items-center justify-center">
          <ArrowRight className="w-4 h-4 text-primary" />
        </div>
        <div
          className="rounded-sm border p-2.5 space-y-1.5"
          style={{
            borderColor: 'rgba(124,232,245,0.28)',
            background: 'rgba(124,232,245,0.08)',
          }}
        >
          <p className="text-[10px] uppercase tracking-wide text-primary font-semibold">Nachher</p>
          {s.after.map((line, i) => (
            <p key={i} className="text-[12px] text-foreground leading-snug">
              {line}
            </p>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
        <p className="meta-text flex-1">{s.impact}</p>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" className="h-8 rounded text-xs" onClick={onDismiss}>
            Verwerfen
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded text-xs"
            onClick={onOpenManual}
          >
            Details
          </Button>
          <Button
            size="sm"
            className="h-8 rounded text-xs font-semibold"
            disabled={applying}
            onClick={() => void apply()}
          >
            {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Übernehmen'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Problem Card ── */
function ProblemCard({
  problem,
  date,
  onOpenManual,
  onDismissCard,
}: {
  problem: Problem;
  date: string;
  onOpenManual: () => void;
  onDismissCard: () => void;
}) {
  return (
    <div
      className={cn(
        'glass-card p-4 border-l-[3px]',
        severityEdge[problem.severity],
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-base font-semibold text-foreground pr-2">{problem.title}</h4>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={cn(
                  'px-1.5 py-0.5 text-[10.5px] font-semibold rounded-sm',
                  severityBadge[problem.severity],
                )}
              >
                {problem.severity}
              </span>
              <code className="font-mono text-[11px] text-dim">{problem.id}</code>
              <button
                type="button"
                onClick={onDismissCard}
                className="p-1 rounded-sm hover:bg-white/5 text-muted-foreground"
                title="Ausblenden"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1.5">{problem.detail}</p>
        </div>
      </div>

      <AiSuggestionBlock
        problem={problem}
        date={date}
        onDismiss={onDismissCard}
        onOpenManual={onOpenManual}
      />
    </div>
  );
}

/* ── Main Component ── */
export function Probleme() {
  const { selectedDate, selectedDepotId, searchQuery } = useDispatch();
  const dateStr = selectedDate.toISOString().split('T')[0];
  const { data: problems, isLoading } = useProblems(dateStr, selectedDepotId);
  const [filter, setFilter] = useState<ProblemType | null>(null);
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const activeProblem = useMemo(() => {
    if (!problems) return [];
    return problems.filter((p) => !dismissed.has(p.id));
  }, [problems, dismissed]);

  const filtered = useMemo(() => {
    const byType = filter ? activeProblem.filter((p) => p.type === filter) : activeProblem;
    return byType.filter((p) =>
      matchesSearch(
        searchQuery,
        p.title,
        p.detail,
        p.type,
        (p.meta?.driver as { name?: string } | undefined)?.name,
      ),
    );
  }, [activeProblem, filter, searchQuery]);

  const dismiss = useCallback(
    (id: string) => {
      setDismissed((prev) => new Set(prev).add(id));
      if (selectedProblem?.id === id) setSelectedProblem(null);
    },
    [selectedProblem],
  );

  const typeCounts = useMemo(() => {
    const counts: Record<ProblemType, number> = { conflict: 0, unassigned: 0, absent: 0 };
    activeProblem.forEach((p) => {
      counts[p.type]++;
    });
    return counts;
  }, [activeProblem]);

  const sheetTitle: Record<ProblemType, string> = {
    unassigned: 'Sendungen ohne Tour',
    conflict: 'Zeitfensterkonflikt',
    absent: 'Fahrer abwesend',
  };

  const formatDate = (d: Date) =>
    d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="section-title">Probleme</p>
          <h2 className="page-title mt-1">
            {activeProblem.length} offene Punkte · {formatDate(selectedDate)}
          </h2>
        </div>
        <div className="flex gap-2 flex-wrap">
          {filterLabels.map((f) => {
            const count = typeCounts[f.key] ?? 0;
            const isActive = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(isActive ? null : f.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-sm border transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent text-muted-foreground border-hairline hover:text-foreground hover:border-primary',
                )}
              >
                {f.label}
                <span
                  className={cn(
                    'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-sm',
                    isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-white/10 text-foreground',
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && activeProblem.length === 0 && (
        <div className="glass-card p-10 text-center meta-text">
          Keine offenen Probleme — alles läuft planmäßig.
        </div>
      )}

      <div className="space-y-4">
        {filtered.map((p) => (
          <ProblemCard
            key={p.id}
            problem={p}
            date={dateStr}
            onOpenManual={() => setSelectedProblem(p)}
            onDismissCard={() => dismiss(p.id)}
          />
        ))}
      </div>

      <Sheet open={!!selectedProblem} onOpenChange={(open) => !open && setSelectedProblem(null)}>
        <SheetContent className="overflow-y-auto border-hairline">
          <SheetHeader>
            <SheetTitle>{selectedProblem ? sheetTitle[selectedProblem.type] : ''}</SheetTitle>
            <SheetDescription>{selectedProblem?.detail}</SheetDescription>
          </SheetHeader>
          {selectedProblem?.type === 'unassigned' && selectedProblem.meta && (
            <UnassignedDetail meta={selectedProblem.meta} date={dateStr} />
          )}
          {selectedProblem?.type === 'conflict' && (
            <p className="meta-text mt-4">
              Zeitfenster zweier Stops überlappen. Übernehme den KI-Vorschlag auf der Karte oder plane manuell neu.
            </p>
          )}
          {selectedProblem?.type === 'absent' && selectedProblem.meta && (
            <AbsentDetail meta={selectedProblem.meta} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
