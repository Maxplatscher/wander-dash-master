import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { PackageX, AlertTriangle, AlertCircle, Clock, Bot, Loader2, Truck, User, X, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useDispatch } from '@/lib/dispatch-context';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

/* ── Types ── */
type ProblemType = 'unassigned' | 'conflict' | 'absent';
type SeverityLevel = 'kritisch' | 'warnung';

interface Problem {
  id: string;
  type: ProblemType;
  title: string;
  detail: string;
  severity: SeverityLevel;
  meta?: Record<string, any>;
}

/* ── Filter config ── */
const filterLabels: { key: ProblemType | 'all'; label: string }[] = [
  { key: 'conflict', label: 'Zeitkonflikt' },
  { key: 'unassigned', label: 'Ohne Tour' },
  { key: 'absent', label: 'Abwesend' },
];

const borderColor: Record<SeverityLevel, string> = {
  kritisch: 'border-l-red-500',
  warnung: 'border-l-amber-500',
};

const dotColor: Record<SeverityLevel, string> = {
  kritisch: 'bg-red-500',
  warnung: 'bg-amber-500',
};

/* ── Hook: load real problems from DB ── */
function useProblems(date: string) {
  return useQuery({
    queryKey: ['problems', date],
    queryFn: async () => {
      const problems: Problem[] = [];

      const [{ data: shipments }, { data: activePlan }, { data: allActiveTours }, { data: drivers }] = await Promise.all([
        supabase
          .from('shipment')
          .select('id, customer_name, delivery_address, weight_kg')
          .eq('service_date', date),
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
          .select('id, description, is_active, version, plan_version_id')
          .eq('date', date)
          .eq('is_active', true),
        supabase
          .from('driver')
          .select('id, name, status'),
      ]);

      const fallbackVersion = (allActiveTours ?? []).reduce<number | null>((maxVersion, tour) => {
        const version = tour.version ?? 0;
        return maxVersion === null || version > maxVersion ? version : maxVersion;
      }, null);

      const currentTours = (allActiveTours ?? []).filter((tour) => {
        if (activePlan?.id) return tour.plan_version_id === activePlan.id;
        if (fallbackVersion === null) return false;
        return (tour.version ?? 0) === fallbackVersion;
      });

      const currentTourIds = currentTours.map((tour) => tour.id);
      let assignedIds = new Set<string>();

      if (currentTourIds.length > 0) {
        const { data: assignedStops } = await supabase
          .from('tour_stop')
          .select('shipment_id, tour_id')
          .in('tour_id', currentTourIds);

        assignedIds = new Set(
          (assignedStops ?? []).map((stop) => stop.shipment_id).filter(Boolean) as string[]
        );
      }

      if (shipments?.length) {
        const unassigned = shipments.filter((shipment) => !assignedIds.has(shipment.id));
        if (unassigned.length > 0) {
          problems.push({
            id: 'P-UA',
            type: 'unassigned',
            title: `${unassigned.length} Sendung${unassigned.length > 1 ? 'en' : ''} ohne Tour`,
            detail: unassigned.map((shipment) => shipment.customer_name ?? shipment.id.slice(0, 8)).join(', '),
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

        if (!stops?.length) continue;

        if (stops.length >= 2) {
          for (let i = 0; i < stops.length - 1; i++) {
            const currentStop = stops[i];
            const nextStop = stops[i + 1];
            if (currentStop.departure_time && nextStop.arrival_time && currentStop.departure_time > nextStop.arrival_time) {
              const tourName = tour.description ?? `Tour-${tour.id.slice(0, 4)}`;
              problems.push({
                id: `P-CF-${tour.id.slice(0, 6)}-${i}`,
                type: 'conflict',
                title: `${tourName} — Zeitfenster`,
                detail: `Ankunft ${nextStop.arrival_time?.slice(11, 16)}, Fenster endet ${currentStop.departure_time?.slice(11, 16)}`,
                severity: 'warnung',
                meta: { tourId: tour.id, stopA: currentStop, stopB: nextStop },
              });
            }
          }
        }
      }

      const absentDrivers = drivers?.filter((driver) => driver.status === 'abwesend' || driver.status === 'krank') ?? [];
      for (const driver of absentDrivers) {
        problems.push({
          id: `P-ABS-${driver.id.slice(0, 6)}`,
          type: 'absent',
          title: `Fahrer ${driver.name ?? 'Unbekannt'} — Abwesend`,
          detail: `${driver.status === 'krank' ? 'Krank' : 'Abwesend'} ab heute · ${currentTours.length} Touren nicht besetzt`,
          severity: 'warnung',
          meta: { driver, availableDrivers: drivers?.filter((candidate) => candidate.status === 'aktiv') ?? [] },
        });
      }

      return problems;
    },
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

      const fallbackVersion = (tours ?? []).reduce<number | null>((maxVersion, tour) => {
        const version = tour.version ?? 0;
        return maxVersion === null || version > maxVersion ? version : maxVersion;
      }, null);

      return (tours ?? []).filter((tour) => {
        if (activePlan?.id) return tour.plan_version_id === activePlan.id;
        if (fallbackVersion === null) return false;
        return (tour.version ?? 0) === fallbackVersion;
      });
    },
  });
}


/* ── Detail Sheets ── */
function UnassignedDetail({ meta, date }: { meta: any; date: string }) {
  const { data: tours } = useAvailableTours(date);
  const [selectedTour, setSelectedTour] = useState<string>('');
  const [resolving, setResolving] = useState(false);
  const qc = useQueryClient();

  const assignToTour = async (shipmentId: string) => {
    if (!selectedTour) { toast.error('Bitte Tour auswählen'); return; }
    const { error } = await supabase.from('tour_stop').insert({
      tour_id: selectedTour, shipment_id: shipmentId, stop_index: 999,
    });
    if (error) toast.error(error.message);
    else { toast.success('Sendung zugeordnet'); qc.invalidateQueries({ queryKey: ['problems'] }); }
  };

  const aiAssign = async () => {
    setResolving(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-resolve', {
        body: { type: 'unassigned', context: { shipments: meta.shipments, date } },
      });
      if (error) throw error;
      toast.success(data?.message ?? 'KI-Zuordnung abgeschlossen');
      qc.invalidateQueries({ queryKey: ['problems'] });
    } catch (e: any) {
      toast.error(e.message ?? 'KI-Fehler');
    } finally { setResolving(false); }
  };

  return (
    <div className="space-y-4 mt-4">
      {meta.shipments?.map((s: any) => (
        <div key={s.id} className="rounded-lg border bg-card p-3 space-y-2">
          <p className="text-sm font-medium text-card-foreground">{s.customer_name ?? 'Unbekannt'}</p>
          <p className="text-xs text-muted-foreground">{s.delivery_address ?? 'Keine Adresse'} · {s.weight_kg ?? '?'} kg</p>
          <div className="flex items-center gap-2">
            <Select value={selectedTour} onValueChange={setSelectedTour}>
              <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Tour wählen..." /></SelectTrigger>
              <SelectContent>
                {tours?.map(t => <SelectItem key={t.id} value={t.id}>{t.description ?? t.id.slice(0, 8)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => assignToTour(s.id)}>
              <Truck className="w-3 h-3 mr-1" /> Zuordnen
            </Button>
          </div>
        </div>
      ))}
      <Button className="w-full" onClick={aiAssign} disabled={resolving}>
        {resolving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bot className="w-4 h-4 mr-2" />}
        KI zuordnen lassen
      </Button>
    </div>
  );
}



  const activeProblem = useMemo(() => {
    if (!problems) return [];
    return problems.filter(p => !dismissed.has(p.id));
  }, [problems, dismissed]);

  const filtered = useMemo(() => {
    if (!filter) return activeProblem;
    return activeProblem.filter(p => p.type === filter);
  }, [activeProblem, filter]);

  const kritisch = filtered.filter(p => p.severity === 'kritisch');
  const warnung = filtered.filter(p => p.severity === 'warnung');

  const dismiss = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissed(prev => new Set(prev).add(id));
    if (selectedProblem?.id === id) setSelectedProblem(null);
  }, [selectedProblem]);

  // Count per filter type for badges
  const typeCounts = useMemo(() => {
    const counts: Record<ProblemType, number> = { conflict: 0, unassigned: 0, absent: 0 };
    activeProblem.forEach(p => counts[p.type]++);
    return counts;
  }, [activeProblem]);

  const sheetTitle: Record<ProblemType, string> = {
    unassigned: 'Sendungen ohne Tour',
    conflict: 'Zeitfensterkonflikt',
    absent: 'Fahrer abwesend',
  };

  const formatDate = (d: Date) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="space-y-4">
      {/* Header row: filters + date */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          {filterLabels.map(f => {
            const count = typeCounts[f.key as ProblemType] ?? 0;
            const isActive = filter === f.key;
            return (
              <Badge
                key={f.key}
                variant={isActive ? 'default' : 'outline'}
                className={cn(
                  "cursor-pointer px-3 py-1 text-xs gap-1.5 transition-all",
                  isActive && "ring-1 ring-primary/30"
                )}
                onClick={() => setFilter(isActive ? null : f.key as ProblemType)}
              >
                {f.label}
                {count > 0 && (
                  <span className={cn(
                    "inline-flex items-center justify-center rounded-full text-[10px] font-bold min-w-[18px] h-[18px] px-1",
                    isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-destructive text-destructive-foreground"
                  )}>
                    {count}
                  </span>
                )}
              </Badge>
            );
          })}
        </div>
        <span className="text-xs text-muted-foreground">{formatDate(selectedDate)}</span>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && activeProblem.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Keine offenen Probleme — alles läuft planmäßig ✓
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Kritisch column */}
        {kritisch.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={cn("w-2 h-2 rounded-full", dotColor.kritisch)} />
              <span className="text-sm font-medium text-card-foreground">Kritisch ({kritisch.length})</span>
            </div>
            {kritisch.map(p => (
              <ProblemCard
                key={p.id}
                problem={p}
                onClick={() => setSelectedProblem(p)}
                onDismiss={(e) => dismiss(p.id, e)}
              />
            ))}
          </div>
        )}

        {/* Warnung column */}
        {warnung.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={cn("w-2 h-2 rounded-full", dotColor.warnung)} />
              <span className="text-sm font-medium text-card-foreground">Warnung ({warnung.length})</span>
            </div>
            {warnung.map(p => (
              <ProblemCard
                key={p.id}
                problem={p}
                onClick={() => setSelectedProblem(p)}
                onDismiss={(e) => dismiss(p.id, e)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!selectedProblem} onOpenChange={open => !open && setSelectedProblem(null)}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedProblem ? sheetTitle[selectedProblem.type] : ''}</SheetTitle>
            <SheetDescription>{selectedProblem?.detail}</SheetDescription>
          </SheetHeader>
          {selectedProblem?.type === 'unassigned' && <UnassignedDetail meta={selectedProblem.meta} date={dateStr} />}
          {selectedProblem?.type === 'conflict' && <ConflictDetail meta={selectedProblem.meta} />}
          {selectedProblem?.type === 'absent' && <AbsentDetail meta={selectedProblem.meta} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ── Problem Card ── */
function ProblemCard({ problem, onClick, onDismiss }: {
  problem: Problem;
  onClick: () => void;
  onDismiss: (e: React.MouseEvent) => void;
}) {
  const actionLabel: Record<ProblemType, { primary: string; secondary: string }> = {
    conflict: { primary: 'Neuplanung', secondary: 'Ignorieren' },
    unassigned: { primary: 'Zuordnen', secondary: 'Details' },
    absent: { primary: 'Vertretung', secondary: 'Details' },
  };

  const actionColor: Record<ProblemType, string> = {
    conflict: 'bg-amber-600 hover:bg-amber-700 text-white',
    unassigned: 'bg-primary hover:bg-primary/90 text-primary-foreground',
    absent: 'bg-green-600 hover:bg-green-700 text-white',
  };

  return (
    <div
      className={cn(
        "rounded-lg border-l-4 border bg-card p-4 cursor-pointer transition-all hover:bg-accent/30 group relative",
        borderColor[problem.severity],
      )}
      onClick={onClick}
    >
      {/* Dismiss button */}
      <button
        onClick={onDismiss}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted"
        title="Problem ausblenden"
      >
        <X className="w-3 h-3 text-muted-foreground" />
      </button>

      <h4 className="text-sm font-semibold text-card-foreground mb-1 pr-6">{problem.title}</h4>
      <p className="text-xs text-muted-foreground mb-3">{problem.detail}</p>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className={cn("h-7 text-xs px-3", actionColor[problem.type])}
          onClick={(e) => { e.stopPropagation(); onClick(); }}
        >
          {actionLabel[problem.type].primary}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs px-3"
          onClick={(e) => { e.stopPropagation(); onClick(); }}
        >
          {actionLabel[problem.type].secondary}
        </Button>
      </div>
    </div>
  );
}

/* ── Export problem count for sidebar ── */
export { useProblems };
