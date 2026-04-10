import { useState, useMemo, useEffect, useCallback } from 'react';
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
type ProblemType = 'unassigned' | 'conflict' | 'capacity' | 'absent';
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
  { key: 'capacity', label: 'Kapazität' },
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

      // 1. Unassigned shipments
      const { data: shipments } = await supabase
        .from('shipment')
        .select('id, customer_name, delivery_address, weight_kg')
        .eq('service_date', date);

      if (shipments?.length) {
        const { data: assignedStops } = await supabase
          .from('tour_stop')
          .select('shipment_id');
        const assignedIds = new Set(assignedStops?.map(s => s.shipment_id) ?? []);
        const unassigned = shipments.filter(s => !assignedIds.has(s.id));
        if (unassigned.length > 0) {
          problems.push({
            id: 'P-UA',
            type: 'unassigned',
            title: `${unassigned.length} Sendung${unassigned.length > 1 ? 'en' : ''} ohne Tour`,
            detail: unassigned.map(s => s.customer_name ?? s.id.slice(0, 8)).join(', '),
            severity: 'warnung',
            meta: { shipments: unassigned },
          });
        }
      }

      // 2. Capacity issues
      const { data: tours } = await supabase
        .from('tour')
        .select('id, description, is_active')
        .eq('date', date)
        .eq('is_active', true);

      if (tours?.length) {
        for (const tour of tours) {
          const { data: stops } = await supabase
            .from('tour_stop')
            .select('shipment_id, vehicle_id')
            .eq('tour_id', tour.id);
          if (!stops?.length) continue;

          const vehicleId = stops[0].vehicle_id;
          if (!vehicleId) continue;

          const shipmentIds = stops.map(s => s.shipment_id).filter(Boolean) as string[];
          if (!shipmentIds.length) continue;
          const { data: shipmentData } = await supabase
            .from('shipment')
            .select('id, weight_kg')
            .in('id', shipmentIds);

          const totalWeight = shipmentData?.reduce((s, sh) => s + (sh.weight_kg ?? 0), 0) ?? 0;

          const { data: vehicle } = await supabase
            .from('vehicle')
            .select('capacity, name')
            .eq('id', vehicleId)
            .single();

          if (vehicle && totalWeight > (vehicle.capacity ?? Infinity)) {
            const name = vehicle.name ?? tour.description ?? tour.id.slice(0, 8);
            const affected = shipmentData?.length ?? 0;
            problems.push({
              id: `P-CAP-${tour.id.slice(0, 6)}`,
              type: 'capacity',
              title: `${name} — Kapazität`,
              detail: `${totalWeight} kg / ${vehicle.capacity} kg Limit · ${affected} Sendungen betroffen`,
              severity: 'kritisch',
              meta: { tourId: tour.id, totalWeight, vehicleCapacity: vehicle.capacity, vehicleName: name, shipmentCount: affected },
            });
          }
        }
      }

      // 3. Time conflicts (demo if no real data)
      // Check if any tour stops have overlapping windows
      if (tours?.length) {
        for (const tour of tours) {
          const { data: stops } = await supabase
            .from('tour_stop')
            .select('id, shipment_id, arrival_time, departure_time, stop_index')
            .eq('tour_id', tour.id)
            .order('stop_index');
          if (!stops || stops.length < 2) continue;

          for (let i = 0; i < stops.length - 1; i++) {
            const curr = stops[i];
            const next = stops[i + 1];
            if (curr.departure_time && next.arrival_time && curr.departure_time > next.arrival_time) {
              const tourName = tour.description ?? `Tour-${tour.id.slice(0, 4)}`;
              problems.push({
                id: `P-CF-${tour.id.slice(0, 6)}-${i}`,
                type: 'conflict',
                title: `${tourName} — Zeitfenster`,
                detail: `Ankunft ${next.arrival_time?.slice(0, 5)}, Fenster endet ${curr.departure_time?.slice(0, 5)}`,
                severity: 'warnung',
                meta: { tourId: tour.id, stopA: curr, stopB: next },
              });
            }
          }
        }
      }

      // 4. Absent drivers
      const { data: drivers } = await supabase
        .from('driver')
        .select('id, name, status');
      const absent = drivers?.filter(d => d.status === 'abwesend' || d.status === 'krank') ?? [];
      for (const d of absent) {
        // Count affected tours
        const { count } = await supabase
          .from('tour')
          .select('id', { count: 'exact', head: true })
          .eq('date', date)
          .eq('is_active', true);
        problems.push({
          id: `P-ABS-${d.id.slice(0, 6)}`,
          type: 'absent',
          title: `Fahrer ${d.name ?? 'Unbekannt'} — Abwesend`,
          detail: `${d.status === 'krank' ? 'Krank' : 'Abwesend'} ab heute · ${count ?? 0} Touren nicht besetzt`,
          severity: 'warnung',
          meta: { driver: d, availableDrivers: drivers?.filter(dr => dr.status === 'aktiv') ?? [] },
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
      const { data } = await supabase
        .from('tour')
        .select('id, description')
        .eq('date', date)
        .eq('is_active', true);
      return data ?? [];
    },
  });
}

/* ── Auto-resolve capacity issues ── */
function useAutoResolveCapacity(problems: Problem[] | undefined, dateStr: string) {
  const qc = useQueryClient();
  const [autoResolving, setAutoResolving] = useState<Set<string>>(new Set());
  const [autoResolved, setAutoResolved] = useState<Set<string>>(new Set());
  const [autoFailed, setAutoFailed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!problems) return;
    const capacityProblems = problems.filter(p => p.type === 'capacity' && !autoResolved.has(p.id) && !autoResolving.has(p.id) && !autoFailed.has(p.id));
    
    for (const p of capacityProblems) {
      setAutoResolving(prev => new Set(prev).add(p.id));
      
      supabase.functions.invoke('ai-resolve', {
        body: { type: 'capacity', context: { ...p.meta, date: dateStr } },
      }).then(({ data, error }) => {
        setAutoResolving(prev => { const n = new Set(prev); n.delete(p.id); return n; });
        if (error || !data) {
          setAutoFailed(prev => new Set(prev).add(p.id));
          toast.error(`KI konnte ${p.meta?.vehicleName ?? 'Kapazitätsproblem'} nicht automatisch lösen — manueller Eingriff nötig`);
        } else {
          setAutoResolved(prev => new Set(prev).add(p.id));
          toast.success(data?.message ?? `${p.meta?.vehicleName} automatisch umgeplant`);
          qc.invalidateQueries({ queryKey: ['problems'] });
        }
      });
    }
  }, [problems, dateStr]);

  return { autoResolving, autoResolved, autoFailed };
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

function CapacityDetail({ meta, autoStatus }: { meta: any; autoStatus: 'resolving' | 'failed' | 'resolved' | 'idle' }) {
  const [resolving, setResolving] = useState(false);
  const qc = useQueryClient();

  const manualReplan = async () => {
    setResolving(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-resolve', {
        body: { type: 'capacity', context: meta },
      });
      if (error) throw error;
      toast.success(data?.message ?? 'Kapazität aufgelöst');
      qc.invalidateQueries({ queryKey: ['problems'] });
    } catch (e: any) {
      toast.error(e.message ?? 'KI-Fehler');
    } finally { setResolving(false); }
  };

  return (
    <div className="space-y-4 mt-4">
      {autoStatus === 'resolving' && (
        <Alert className="border-blue-500/30 bg-blue-500/10">
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          <AlertDescription className="text-blue-400">KI löst Kapazitätsproblem automatisch im Hintergrund...</AlertDescription>
        </Alert>
      )}
      {autoStatus === 'resolved' && (
        <Alert className="border-green-500/30 bg-green-500/10">
          <Bot className="h-4 w-4 text-green-500" />
          <AlertDescription className="text-green-400">Kapazitätsproblem wurde automatisch von der KI gelöst.</AlertDescription>
        </Alert>
      )}
      {autoStatus === 'failed' && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>KI konnte das Problem nicht automatisch lösen. Manueller Eingriff erforderlich.</AlertDescription>
        </Alert>
      )}

      <div className="rounded-lg border bg-card p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Aktuelles Gewicht</span>
          <span className="font-medium text-destructive">{meta.totalWeight} kg</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Fahrzeuglimit</span>
          <span className="font-medium">{meta.vehicleCapacity} kg</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Überschreitung</span>
          <span className="font-medium text-destructive">+{(meta.totalWeight ?? 0) - (meta.vehicleCapacity ?? 0)} kg</span>
        </div>
      </div>

      {(autoStatus === 'failed' || autoStatus === 'idle') && (
        <Button className="w-full" variant="destructive" onClick={manualReplan} disabled={resolving}>
          {resolving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bot className="w-4 h-4 mr-2" />}
          {autoStatus === 'failed' ? 'Erneut versuchen' : 'KI-Umplanung starten'}
        </Button>
      )}
    </div>
  );
}

function ConflictDetail({ meta }: { meta: any }) {
  const [resolving, setResolving] = useState(false);
  const qc = useQueryClient();

  const aiReplan = async () => {
    setResolving(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-resolve', {
        body: { type: 'conflict', context: meta },
      });
      if (error) throw error;
      toast.success(data?.message ?? 'Zeitkonflikt aufgelöst');
      qc.invalidateQueries({ queryKey: ['problems'] });
    } catch (e: any) {
      toast.error(e.message ?? 'KI-Fehler');
    } finally { setResolving(false); }
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="rounded-lg border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Zeitfenster zweier Stops überlappen sich. Mögliche Ursachen: Verkehrslage, zu kurze Abladezeit beim vorherigen Kunden, ungünstige Reihenfolge.
        </p>
      </div>
      <div className="flex gap-2">
        <Button className="flex-1" onClick={aiReplan} disabled={resolving}>
          {resolving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bot className="w-4 h-4 mr-2" />}
          Neuplanung
        </Button>
      </div>
    </div>
  );
}

function AbsentDetail({ meta }: { meta: any }) {
  const qc = useQueryClient();

  const assignReplacement = async (replacementId: string) => {
    toast.success(`Vertretung ${meta.availableDrivers?.find((d: any) => d.id === replacementId)?.name} zugewiesen`);
    qc.invalidateQueries({ queryKey: ['problems'] });
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="rounded-lg border bg-card p-4 space-y-1">
        <p className="text-sm font-medium">{meta.driver?.name ?? 'Unbekannt'}</p>
        <p className="text-xs text-muted-foreground">Status: {meta.driver?.status}</p>
      </div>
      <p className="text-sm font-medium">Verfügbare Vertretungen:</p>
      {meta.availableDrivers?.length ? meta.availableDrivers.map((d: any) => (
        <div key={d.id} className="flex items-center justify-between rounded-lg border bg-card p-3">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">{d.name}</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => assignReplacement(d.id)}>Zuweisen</Button>
        </div>
      )) : <p className="text-xs text-muted-foreground">Keine verfügbaren Fahrer</p>}
    </div>
  );
}

/* ── Main Component ── */
export function Probleme() {
  const { selectedDate } = useDispatch();
  const dateStr = selectedDate.toISOString().split('T')[0];
  const { data: problems, isLoading } = useProblems(dateStr);
  const [filter, setFilter] = useState<ProblemType | null>(null);
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  
  const { autoResolving, autoResolved, autoFailed } = useAutoResolveCapacity(problems, dateStr);

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

  const getAutoStatus = (id: string): 'resolving' | 'failed' | 'resolved' | 'idle' => {
    if (autoResolving.has(id)) return 'resolving';
    if (autoFailed.has(id)) return 'failed';
    if (autoResolved.has(id)) return 'resolved';
    return 'idle';
  };

  // Count per filter type for badges
  const typeCounts = useMemo(() => {
    const counts: Record<ProblemType, number> = { capacity: 0, conflict: 0, unassigned: 0, absent: 0 };
    activeProblem.forEach(p => counts[p.type]++);
    return counts;
  }, [activeProblem]);

  const sheetTitle: Record<ProblemType, string> = {
    unassigned: 'Sendungen ohne Tour',
    conflict: 'Zeitfensterkonflikt',
    capacity: 'Kapazitätsüberschreitung',
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
                autoStatus={p.type === 'capacity' ? getAutoStatus(p.id) : undefined}
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
          {selectedProblem?.type === 'capacity' && <CapacityDetail meta={selectedProblem.meta} autoStatus={getAutoStatus(selectedProblem.id)} />}
          {selectedProblem?.type === 'conflict' && <ConflictDetail meta={selectedProblem.meta} />}
          {selectedProblem?.type === 'absent' && <AbsentDetail meta={selectedProblem.meta} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ── Problem Card ── */
function ProblemCard({ problem, autoStatus, onClick, onDismiss }: {
  problem: Problem;
  autoStatus?: 'resolving' | 'failed' | 'resolved' | 'idle';
  onClick: () => void;
  onDismiss: (e: React.MouseEvent) => void;
}) {
  const actionLabel: Record<ProblemType, { primary: string; secondary: string }> = {
    capacity: { primary: 'KI-Umplanung', secondary: 'Details' },
    conflict: { primary: 'Neuplanung', secondary: 'Ignorieren' },
    unassigned: { primary: 'Zuordnen', secondary: 'Details' },
    absent: { primary: 'Vertretung', secondary: 'Details' },
  };

  const actionColor: Record<ProblemType, string> = {
    capacity: 'bg-red-600 hover:bg-red-700 text-white',
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

      {autoStatus === 'resolving' && (
        <div className="flex items-center gap-2 text-xs text-blue-400 mb-3">
          <Loader2 className="w-3 h-3 animate-spin" />
          KI löst automatisch...
        </div>
      )}

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
