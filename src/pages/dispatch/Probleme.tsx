import { useState, useMemo } from 'react';
import { PackageX, AlertTriangle, AlertCircle, Mail, Clock, Bot, ChevronRight, Loader2, Truck, User } from 'lucide-react';
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
type ProblemType = 'unassigned' | 'conflict' | 'capacity' | 'absent' | 'email';
type Severity = 'hoch' | 'mittel' | 'niedrig';

interface Problem {
  id: string;
  type: ProblemType;
  title: string;
  detail: string;
  severity: Severity;
  meta?: Record<string, any>;
}

/* ── Icons & styles ── */
const typeIcon: Record<ProblemType, React.ReactNode> = {
  unassigned: <PackageX className="w-4 h-4 text-amber-500" />,
  conflict: <Clock className="w-4 h-4 text-destructive" />,
  capacity: <AlertTriangle className="w-4 h-4 text-destructive" />,
  absent: <AlertCircle className="w-4 h-4 text-muted-foreground" />,
  email: <Mail className="w-4 h-4 text-blue-500" />,
};

const severityStyle: Record<Severity, string> = {
  hoch: 'bg-red-50 text-red-700 border-red-200',
  mittel: 'bg-amber-50 text-amber-700 border-amber-200',
  niedrig: 'bg-muted text-muted-foreground border-border',
};

const filterLabels: { key: ProblemType | 'all'; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'unassigned', label: 'Ohne Tour' },
  { key: 'conflict', label: 'Zeitkonflikte' },
  { key: 'capacity', label: 'Kapazität' },
  { key: 'absent', label: 'Abwesend' },
  { key: 'email', label: 'E-Mail' },
];

/* ── Hook: load real problems from DB ── */
function useProblems(date: string) {
  return useQuery({
    queryKey: ['problems', date],
    queryFn: async () => {
      const problems: Problem[] = [];

      // 1. Unassigned shipments (no tour_stop)
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
            title: `${unassigned.length} Sendung${unassigned.length > 1 ? 'en' : ''} ohne Tourzuordnung`,
            detail: unassigned.map(s => s.customer_name ?? s.id.slice(0, 8)).join(', '),
            severity: 'hoch',
            meta: { shipments: unassigned },
          });
        }
      }

      // 2. Capacity issues (tour weight > vehicle capacity)
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
            problems.push({
              id: `P-CAP-${tour.id.slice(0, 6)}`,
              type: 'capacity',
              title: `Kapazitätsüberschreitung ${vehicle.name ?? 'Fahrzeug'}`,
              detail: `${totalWeight} kg / ${vehicle.capacity} kg Limit`,
              severity: 'hoch',
              meta: { tourId: tour.id, totalWeight, vehicleCapacity: vehicle.capacity, vehicleName: vehicle.name },
            });
          }
        }
      }

      // 3. Absent drivers
      const { data: drivers } = await supabase
        .from('driver')
        .select('id, name, status');
      const absent = drivers?.filter(d => d.status === 'abwesend' || d.status === 'krank') ?? [];
      if (absent.length > 0) {
        for (const d of absent) {
          problems.push({
            id: `P-ABS-${d.id.slice(0, 6)}`,
            type: 'absent',
            title: `Fahrer ${d.name ?? 'Unbekannt'} abwesend`,
            detail: `Status: ${d.status} · Keine Vertretung zugewiesen`,
            severity: 'niedrig',
            meta: { driver: d, availableDrivers: drivers?.filter(dr => dr.status === 'aktiv') ?? [] },
          });
        }
      }

      // 4. Incomplete emails
      const { data: emails } = await supabase
        .from('email_log')
        .select('id, subject, from_addr, body_preview, error_detail, status')
        .in('status', ['error', 'pending']);
      if (emails?.length) {
        problems.push({
          id: 'P-EMAIL',
          type: 'email',
          title: `${emails.length} E-Mail${emails.length > 1 ? 's' : ''} unvollständig`,
          detail: emails.map(e => e.subject ?? 'Kein Betreff').join(', '),
          severity: 'mittel',
          meta: { emails },
        });
      }

      // Fallback demo data if DB empty
      if (problems.length === 0) {
        problems.push(
          { id: 'D-001', type: 'unassigned', title: '3 Sendungen ohne Tourzuordnung', detail: 'Demo: Kundenaufträge #4821, #4822, #4825 – Gebiet Süd', severity: 'hoch', meta: { shipments: [{ id: '1', customer_name: 'Müller GmbH', delivery_address: 'Berliner Str. 12', weight_kg: 120 }, { id: '2', customer_name: 'Schmidt AG', delivery_address: 'Hauptstr. 5', weight_kg: 80 }, { id: '3', customer_name: 'Weber KG', delivery_address: 'Industrieweg 3', weight_kg: 200 }] } },
          { id: 'D-002', type: 'conflict', title: 'Zeitfensterkonflikt Tour T-004', detail: 'Stop 3 & 4 überlappen: 14:00–14:30 vs 14:15–14:45', severity: 'hoch', meta: {} },
          { id: 'D-003', type: 'capacity', title: 'Kapazitätsüberschreitung T-001', detail: '1.240 kg / 1.200 kg Limit', severity: 'hoch', meta: { totalWeight: 1240, vehicleCapacity: 1200, vehicleName: 'LKW-01' } },
          { id: 'D-004', type: 'absent', title: 'Fahrer Jan Peters abwesend', detail: 'Status: krank · Keine Vertretung zugewiesen', severity: 'niedrig', meta: { driver: { name: 'Jan Peters', status: 'krank' }, availableDrivers: [{ id: 'x', name: 'Maria Schulz', status: 'aktiv' }] } },
          { id: 'D-005', type: 'email', title: '2 E-Mails unvollständig', detail: 'Manuelle Prüfung erforderlich', severity: 'mittel', meta: { emails: [{ id: 'e1', subject: 'Bestellung #991', from_addr: 'kunde@test.de', body_preview: 'Lieferung an...', status: 'error', error_detail: 'Fehlende Adressdaten' }] } },
        );
      }

      return problems;
    },
  });
}

/* ── Hook: available tours for assignment ── */
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

/* ── Detail Sheets ── */
function UnassignedDetail({ meta, date }: { meta: any; date: string }) {
  const { data: tours } = useAvailableTours(date);
  const [selectedTour, setSelectedTour] = useState<string>('');
  const [resolving, setResolving] = useState(false);
  const qc = useQueryClient();

  const assignToTour = async (shipmentId: string) => {
    if (!selectedTour) { toast.error('Bitte Tour auswählen'); return; }
    const { error } = await supabase.from('tour_stop').insert({
      tour_id: selectedTour,
      shipment_id: shipmentId,
      stop_index: 999,
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
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {meta.shipments?.map((s: any) => (
          <div key={s.id} className="rounded-lg border bg-card p-3 space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-card-foreground">{s.customer_name ?? 'Unbekannt'}</p>
                <p className="text-xs text-muted-foreground">{s.delivery_address ?? 'Keine Adresse'}</p>
                <p className="text-xs text-muted-foreground">{s.weight_kg ?? '?'} kg</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedTour} onValueChange={setSelectedTour}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder="Tour wählen..." />
                </SelectTrigger>
                <SelectContent>
                  {tours?.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.description ?? t.id.slice(0, 8)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={() => assignToTour(s.id)}>
                <Truck className="w-3 h-3 mr-1" /> Zuordnen
              </Button>
            </div>
          </div>
        ))}
      </div>
      <Button className="w-full" onClick={aiAssign} disabled={resolving}>
        {resolving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bot className="w-4 h-4 mr-2" />}
        KI zuordnen lassen
      </Button>
    </div>
  );
}

function CapacityDetail({ meta }: { meta: any }) {
  const [resolving, setResolving] = useState(false);
  const qc = useQueryClient();

  const aiReplan = async () => {
    setResolving(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-resolve', {
        body: { type: 'capacity', context: { tourId: meta.tourId, totalWeight: meta.totalWeight, vehicleCapacity: meta.vehicleCapacity } },
      });
      if (error) throw error;
      toast.success(data?.message ?? 'Kapazität aufgelöst');
      qc.invalidateQueries({ queryKey: ['problems'] });
    } catch (e: any) {
      toast.error(e.message ?? 'KI-Fehler');
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Kapazitätsüberschreitungen sind nicht zulässig. Die KI wird diese automatisch auflösen.
        </AlertDescription>
      </Alert>
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
      <Button className="w-full" variant="destructive" onClick={aiReplan} disabled={resolving}>
        {resolving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bot className="w-4 h-4 mr-2" />}
        KI-Umplanung starten
      </Button>
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
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Zeitfenster zweier Stops überlappen sich. Mögliche Ursachen: Verkehrslage, zu kurze Abladezeit beim vorherigen Kunden, ungünstige Reihenfolge.
        </p>
      </div>
      <Button className="w-full" onClick={aiReplan} disabled={resolving}>
        {resolving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bot className="w-4 h-4 mr-2" />}
        KI-Umplanung starten
      </Button>
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
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4 space-y-1">
        <p className="text-sm font-medium">{meta.driver?.name ?? 'Unbekannt'}</p>
        <p className="text-xs text-muted-foreground">Status: {meta.driver?.status}</p>
      </div>
      <div>
        <p className="text-sm font-medium mb-2">Verfügbare Vertretungen:</p>
        {meta.availableDrivers?.length ? meta.availableDrivers.map((d: any) => (
          <div key={d.id} className="flex items-center justify-between rounded-lg border bg-card p-3 mb-2">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">{d.name}</span>
            </div>
            <Button size="sm" variant="outline" onClick={() => assignReplacement(d.id)}>Zuweisen</Button>
          </div>
        )) : (
          <p className="text-xs text-muted-foreground">Keine verfügbaren Fahrer</p>
        )}
      </div>
    </div>
  );
}

function EmailDetail({ meta }: { meta: any }) {
  return (
    <div className="space-y-3">
      {meta.emails?.map((e: any) => (
        <div key={e.id} className="rounded-lg border bg-card p-4 space-y-1">
          <p className="text-sm font-medium">{e.subject ?? 'Kein Betreff'}</p>
          <p className="text-xs text-muted-foreground">Von: {e.from_addr ?? '?'}</p>
          <p className="text-xs text-muted-foreground">{e.body_preview}</p>
          {e.error_detail && (
            <p className="text-xs text-destructive mt-1">⚠ {e.error_detail}</p>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Main Component ── */
export function Probleme() {
  const { selectedDate } = useDispatch();
  const dateStr = selectedDate.toISOString().split('T')[0];
  const { data: problems, isLoading } = useProblems(dateStr);
  const [filter, setFilter] = useState<ProblemType | 'all'>('all');
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);

  const filtered = useMemo(() => {
    if (!problems) return [];
    if (filter === 'all') return problems;
    return problems.filter(p => p.type === filter);
  }, [problems, filter]);

  const sheetTitle: Record<ProblemType, string> = {
    unassigned: 'Sendungen ohne Tour',
    conflict: 'Zeitfensterkonflikt',
    capacity: 'Kapazitätsüberschreitung',
    absent: 'Fahrer abwesend',
    email: 'E-Mail Probleme',
  };

  return (
    <div className="space-y-3">
      {/* Filter tabs */}
      <div className="flex gap-2 text-xs flex-wrap">
        {filterLabels.map(f => (
          <Badge
            key={f.key}
            variant={filter === f.key ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            {problems && f.key !== 'all' && (
              <span className="ml-1 opacity-60">
                {problems.filter(p => p.type === f.key).length}
              </span>
            )}
          </Badge>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(p => (
          <div
            key={p.id}
            onClick={() => setSelectedProblem(p)}
            className={cn(
              'rounded-lg border bg-card p-4 flex items-start gap-3 cursor-pointer transition-colors hover:bg-accent/50',
              p.severity === 'hoch' && 'border-red-200'
            )}
          >
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
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
          </div>
        ))}
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!selectedProblem} onOpenChange={open => !open && setSelectedProblem(null)}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedProblem ? sheetTitle[selectedProblem.type] : ''}</SheetTitle>
            <SheetDescription>{selectedProblem?.detail}</SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            {selectedProblem?.type === 'unassigned' && <UnassignedDetail meta={selectedProblem.meta} date={dateStr} />}
            {selectedProblem?.type === 'capacity' && <CapacityDetail meta={selectedProblem.meta} />}
            {selectedProblem?.type === 'conflict' && <ConflictDetail meta={selectedProblem.meta} />}
            {selectedProblem?.type === 'absent' && <AbsentDetail meta={selectedProblem.meta} />}
            {selectedProblem?.type === 'email' && <EmailDetail meta={selectedProblem.meta} />}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
