import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Loader2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDispatch } from '@/lib/dispatch-context';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { formatTime } from '@/lib/format-time';
import { geocodeThenPlanTour, planTourSuccessMessage } from '@/lib/start-planning';
import { matchesSearch } from '@/lib/dispatch-search';

type ViewMode = 'month' | 'week' | 'day';

type ShipmentRow = {
  id: string;
  name: string | null;
  customer_name: string | null;
  delivery_address: string | null;
  service_date: string | null;
  weight_kg: number | null;
  window_start: string | null;
  window_end: string | null;
};

type TourRow = {
  id: string;
  date: string | null;
  description: string | null;
  is_active: boolean | null;
};

type DriverRow = {
  id: string;
  name: string | null;
  status: string | null;
  shift_start: string | null;
  shift_end: string | null;
  assigned_vehicle_id: string | null;
};

type VehicleRow = {
  id: string;
  name: string | null;
  capacity: number | null;
};

type StopRow = {
  tour_id: string;
  shipment_id: string | null;
  vehicle_id: string | null;
  driver_completed: boolean | null;
  arrival_time: string | null;
  departure_time: string | null;
};

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function isoWeekNumber(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function formatShift(raw: string | null | undefined): string {
  return raw ? raw.slice(0, 5) : '—';
}

function isWeekend(dateStr: string): boolean {
  const d = new Date(`${dateStr}T12:00:00`);
  const day = d.getDay();
  return day === 0 || day === 6;
}

function isAbsent(status: string | null | undefined): boolean {
  const s = (status ?? '').toLowerCase();
  return s.includes('abwesend') || s.includes('krank') || s === 'inactive';
}

function statusBadge(status: string | null | undefined) {
  if (isAbsent(status)) return { label: 'abwesend', className: 'bg-danger/15 text-danger' };
  const s = (status ?? '').toLowerCase();
  if (s === 'active' || s === 'aktiv') return { label: 'aktiv', className: 'bg-success/15 text-success' };
  return { label: 'verfügbar', className: 'bg-primary/15 text-primary' };
}

function useCalendarRange(from: Date, to: Date, depotId: string | null) {
  return useQuery({
    queryKey: ['shipments-range', fmt(from), fmt(to), depotId],
    queryFn: async () => {
      let shipQ = supabase
        .from('shipment')
        .select('id, name, customer_name, delivery_address, service_date, weight_kg, window_start, window_end')
        .gte('service_date', fmt(from))
        .lte('service_date', fmt(to))
        .order('service_date');
      if (depotId) shipQ = shipQ.eq('depot_id', depotId);

      const [shipRes, tourRes, driverRes, vehicleRes] = await Promise.all([
        shipQ,
        supabase
          .from('tour')
          .select('id, date, description, is_active')
          .gte('date', fmt(from))
          .lte('date', fmt(to)),
        supabase.from('driver').select('id, name, status, shift_start, shift_end, assigned_vehicle_id'),
        supabase.from('vehicle').select('id, name, capacity'),
      ]);

      const tours = (tourRes.data ?? []) as TourRow[];
      const tourIds = tours.map((t) => t.id);
      let stops: StopRow[] = [];
      if (tourIds.length > 0) {
        const { data } = await supabase
          .from('tour_stop')
          .select('tour_id, shipment_id, vehicle_id, driver_completed, arrival_time, departure_time')
          .in('tour_id', tourIds);
        stops = (data ?? []) as StopRow[];
      }

      return {
        shipments: (shipRes.data ?? []) as ShipmentRow[],
        tours,
        stops,
        drivers: (driverRes.data ?? []) as DriverRow[],
        vehicles: (vehicleRes.data ?? []) as VehicleRow[],
      };
    },
  });
}

export function Kalender() {
  const { selectedDepotId, selectedDate, setSelectedDate, refreshAll, searchQuery } = useDispatch();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [viewDate, setViewDate] = useState(() => new Date(selectedDate));
  const [selectedDay, setSelectedDay] = useState(() => fmt(selectedDate));
  const [planLoading, setPlanLoading] = useState(false);

  const range = useMemo(() => {
    if (viewMode === 'day') {
      const d = new Date(viewDate);
      d.setHours(12, 0, 0, 0);
      return { from: d, to: d };
    }
    if (viewMode === 'week') {
      const from = startOfWeek(viewDate);
      const to = new Date(from);
      to.setDate(from.getDate() + 6);
      return { from, to };
    }
    return { from: startOfMonth(viewDate), to: endOfMonth(viewDate) };
  }, [viewMode, viewDate]);

  const { data, isLoading } = useCalendarRange(range.from, range.to, selectedDepotId);

  const vehicleMap = useMemo(
    () => new Map((data?.vehicles ?? []).map((v) => [v.id, v])),
    [data?.vehicles],
  );

  const assignedByDate = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const tourById = new Map((data?.tours ?? []).map((t) => [t.id, t]));
    for (const stop of data?.stops ?? []) {
      if (!stop.shipment_id) continue;
      const tour = tourById.get(stop.tour_id);
      if (!tour?.date) continue;
      const set = map.get(tour.date) ?? new Set();
      set.add(stop.shipment_id);
      map.set(tour.date, set);
    }
    return map;
  }, [data?.tours, data?.stops]);

  const shipmentsByDate = useMemo(() => {
    const m = new Map<string, ShipmentRow[]>();
    for (const s of data?.shipments ?? []) {
      if (!s.service_date) continue;
      const arr = m.get(s.service_date) ?? [];
      arr.push(s);
      m.set(s.service_date, arr);
    }
    return m;
  }, [data?.shipments]);

  const toursByDate = useMemo(() => {
    const m = new Map<string, TourRow[]>();
    for (const t of data?.tours ?? []) {
      if (!t.date) continue;
      const arr = m.get(t.date) ?? [];
      arr.push(t);
      m.set(t.date, arr);
    }
    return m;
  }, [data?.tours]);

  const dayStats = useCallback(
    (dateStr: string) => {
      const shipments = shipmentsByDate.get(dateStr) ?? [];
      const tours = toursByDate.get(dateStr) ?? [];
      const assigned = assignedByDate.get(dateStr) ?? new Set();
      const assignedCount = shipments.filter((s) => assigned.has(s.id)).length;
      const unassigned = Math.max(0, shipments.length - assignedCount);
      const util =
        shipments.length > 0 ? Math.round((assignedCount / shipments.length) * 100) : 0;
      return {
        tours: tours.length,
        shipments: shipments.length,
        unassigned,
        util,
      };
    },
    [shipmentsByDate, toursByDate, assignedByDate],
  );

  const findTourForDriver = useCallback(
    (driver: DriverRow, dateStr: string): { tour: TourRow; stops: StopRow[] } | null => {
      const dayTours = toursByDate.get(dateStr) ?? [];
      for (const tour of dayTours) {
        const stops = (data?.stops ?? []).filter((s) => s.tour_id === tour.id);
        if (driver.assigned_vehicle_id && stops.some((s) => s.vehicle_id === driver.assigned_vehicle_id)) {
          return { tour, stops };
        }
        if (
          driver.name &&
          tour.description &&
          tour.description.toLowerCase().includes(driver.name.toLowerCase().split(' ')[0] ?? '')
        ) {
          return { tour, stops };
        }
      }
      return null;
    },
    [toursByDate, data?.stops],
  );

  const navigate = useCallback(
    (dir: -1 | 0 | 1) => {
      if (dir === 0) {
        const today = new Date();
        setViewDate(today);
        setSelectedDay(fmt(today));
        setSelectedDate(today);
        return;
      }
      setViewDate((prev) => {
        const d = new Date(prev);
        if (viewMode === 'month') d.setMonth(d.getMonth() + dir);
        else if (viewMode === 'week') d.setDate(d.getDate() + dir * 7);
        else {
          d.setDate(d.getDate() + dir);
          setSelectedDay(fmt(d));
          setSelectedDate(new Date(d));
        }
        return d;
      });
    },
    [viewMode, setSelectedDate],
  );

  const pickDay = (dateStr: string) => {
    setSelectedDay(dateStr);
    setSelectedDate(new Date(`${dateStr}T12:00:00`));
  };

  const startPlanning = async (dateStr: string) => {
    setPlanLoading(true);
    try {
      const result = await geocodeThenPlanTour({
        date: dateStr,
        depotId: selectedDepotId,
      });
      toast.success(planTourSuccessMessage(result));
      if (result.geocodeWarning) {
        toast.warning(`Geokodierung unvollständig: ${result.geocodeWarning}`);
      }
      refreshAll();
      queryClient.invalidateQueries({ queryKey: ['shipments-range'] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Planung fehlgeschlagen');
    } finally {
      setPlanLoading(false);
    }
  };

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const today = fmt(new Date());

  const monthCells = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const startDow = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: { day: number; date: string; current: boolean }[] = [];
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = startDow - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      cells.push({ day: d, date: fmt(new Date(year, month - 1, d)), current: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, date: fmt(new Date(year, month, d)), current: true });
    }
    const remaining = 7 - (cells.length % 7);
    if (remaining < 7) {
      for (let d = 1; d <= remaining; d++) {
        cells.push({ day: d, date: fmt(new Date(year, month + 1, d)), current: false });
      }
    }
    return cells;
  }, [year, month]);

  const selectedShipments = shipmentsByDate.get(selectedDay) ?? [];
  const selectedAssigned = assignedByDate.get(selectedDay) ?? new Set();
  const unassignedSelected = selectedShipments.filter(
    (s) =>
      !selectedAssigned.has(s.id) &&
      matchesSearch(searchQuery, s.name, s.customer_name, s.delivery_address),
  );
  const selectedStats = dayStats(selectedDay);

  const driverDayRows = useMemo(() => {
    return (data?.drivers ?? []).map((driver) => {
      const match = findTourForDriver(driver, selectedDay);
      const stops = match?.stops ?? [];
      const weight = stops.reduce((sum, st) => {
        const sh = selectedShipments.find((s) => s.id === st.shipment_id);
        return sum + (sh?.weight_kg ?? 0);
      }, 0);
      const vehicle =
        (driver.assigned_vehicle_id && vehicleMap.get(driver.assigned_vehicle_id)) ||
        (stops.find((s) => s.vehicle_id)?.vehicle_id
          ? vehicleMap.get(stops.find((s) => s.vehicle_id)!.vehicle_id!)
          : null);
      const capacity = vehicle?.capacity ?? 0;
      const util = capacity > 0 ? Math.min(100, Math.round((weight / capacity) * 100)) : 0;
      const done = stops.filter((s) => s.driver_completed).length;
      return {
        driver,
        tour: match?.tour ?? null,
        vehicle,
        weight,
        capacity,
        util,
        stopsDone: done,
        stopsTotal: stops.length,
      };
    });
  }, [data?.drivers, findTourForDriver, selectedDay, selectedShipments, vehicleMap]);

  const weekDays = useMemo(() => {
    const from = startOfWeek(viewDate);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(from);
      d.setDate(from.getDate() + i);
      return d;
    });
  }, [viewDate]);

  const weekUnassigned = useMemo(() => {
    const rows: ShipmentRow[] = [];
    for (const d of weekDays) {
      const key = fmt(d);
      const assigned = assignedByDate.get(key) ?? new Set();
      for (const s of shipmentsByDate.get(key) ?? []) {
        if (!assigned.has(s.id)) {
          if (matchesSearch(searchQuery, s.name, s.customer_name, s.delivery_address)) {
            rows.push(s);
          }
        }
      }
    }
    return rows;
  }, [weekDays, assignedByDate, shipmentsByDate, searchQuery]);

  const dayKey = viewMode === 'day' ? fmt(viewDate) : selectedDay;
  const dayKeyStats = dayStats(dayKey);
  const dayKeyShipments = shipmentsByDate.get(dayKey) ?? [];
  const dayKeyAssigned = assignedByDate.get(dayKey) ?? new Set();
  const dayKeyUnassigned = dayKeyShipments.filter(
    (s) =>
      !dayKeyAssigned.has(s.id) &&
      matchesSearch(searchQuery, s.name, s.customer_name, s.delivery_address),
  );
  const dayKeyAssignedList = dayKeyShipments.filter(
    (s) =>
      dayKeyAssigned.has(s.id) &&
      matchesSearch(searchQuery, s.name, s.customer_name, s.delivery_address),
  );

  const title =
    viewMode === 'month'
      ? `${MONTHS[month]} ${year}`
      : viewMode === 'week'
        ? `KW ${isoWeekNumber(viewDate)} · ${weekDays[0].toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })} – ${weekDays[6].toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}`
        : viewDate.toLocaleDateString('de-DE', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          });

  const switchView = (mode: ViewMode) => {
    setViewMode(mode);
    if (mode === 'day') {
      const key = selectedDay || fmt(viewDate);
      setViewDate(new Date(`${key}T12:00:00`));
      setSelectedDay(key);
      setSelectedDate(new Date(`${key}T12:00:00`));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-8 w-8 p-0 rounded" onClick={() => navigate(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" className="h-8 rounded text-xs" onClick={() => navigate(0)}>
            Heute
          </Button>
          <Button size="sm" variant="outline" className="h-8 w-8 p-0 rounded" onClick={() => navigate(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <h2 className="page-title text-lg ml-1 capitalize">{title}</h2>
        </div>
        <div className="flex rounded border border-hairline p-0.5 bg-background/40">
          {([
            { id: 'day' as const, label: 'Tag' },
            { id: 'week' as const, label: 'Woche' },
            { id: 'month' as const, label: 'Monat' },
          ]).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => switchView(m.id)}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold rounded-sm transition-colors',
                viewMode === m.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="glass-card flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : viewMode === 'month' ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-8 glass-card overflow-hidden">
            <div className="grid grid-cols-7 border-b border-hairline">
              {DAYS.map((d) => (
                <div key={d} className="px-2 py-2 text-center text-[10.5px] font-semibold uppercase tracking-wider text-dim">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {monthCells.map((cell, i) => {
                const stats = dayStats(cell.date);
                const isToday = cell.date === today;
                const isSelected = cell.date === selectedDay;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => pickDay(cell.date)}
                    className={cn(
                      'min-h-[96px] p-2 text-left border-b border-r border-hairline transition-colors',
                      !cell.current && 'opacity-40',
                      isSelected && 'ring-1 ring-inset ring-primary',
                      isToday && !isSelected && 'bg-primary/5',
                      'hover:bg-white/[0.03]',
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={cn(
                          'inline-flex h-6 min-w-6 px-1 items-center justify-center text-xs font-semibold rounded-sm',
                          isToday && 'bg-primary text-primary-foreground',
                          !isToday && 'text-foreground',
                        )}
                      >
                        {cell.day}
                      </span>
                      {stats.unassigned > 0 && (
                        <span className="w-1.5 h-1.5 rounded-sm bg-warning" title="Unzugeordnete Sendungen" />
                      )}
                    </div>
                    {stats.shipments > 0 || stats.tours > 0 ? (
                      <div className="mt-1.5 space-y-1">
                        <p className="text-[10.5px] text-muted-foreground leading-tight">
                          {stats.tours} Touren · {stats.shipments} Sdg.
                        </p>
                        <div className="progress-track">
                          <div className="progress-fill" style={{ width: `${stats.util}%` }} />
                        </div>
                        <p className="text-[10px] font-semibold text-foreground whitespace-nowrap">{stats.util}%</p>
                      </div>
                    ) : (
                      <p className="meta-text mt-2 text-dim">—</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="xl:col-span-4 space-y-4">
            <div className="glass-card p-4 space-y-3">
              <div>
                <p className="section-title">Tagesdetail</p>
                <p className="card-title mt-1">
                  {new Date(`${selectedDay}T12:00:00`).toLocaleDateString('de-DE', {
                    weekday: 'long',
                    day: '2-digit',
                    month: 'long',
                  })}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Touren', value: selectedStats.tours },
                  { label: 'Sendungen', value: selectedStats.shipments },
                  { label: 'Offen', value: selectedStats.unassigned },
                ].map((k) => (
                  <div key={k.label} className="sub-card p-2.5 text-center">
                    <p className="text-[10px] uppercase tracking-wide text-dim">{k.label}</p>
                    <p className="text-xl font-semibold text-foreground whitespace-nowrap mt-0.5">{k.value}</p>
                  </div>
                ))}
              </div>
              <Button
                className="w-full rounded font-semibold"
                disabled={planLoading}
                onClick={() => void startPlanning(selectedDay)}
              >
                {planLoading ? 'Plant…' : 'Planung starten'}
              </Button>
            </div>

            <div className="glass-card p-4 space-y-3">
              <p className="card-title">Fahrer-Auslastung</p>
              {driverDayRows.length === 0 ? (
                <p className="meta-text">Keine Fahrer.</p>
              ) : (
                driverDayRows.slice(0, 8).map(({ driver, vehicle, weight, capacity, util, stopsDone, stopsTotal, tour }) => (
                  <div key={driver.id} className="sub-card p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{driver.name}</p>
                      <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-sm', statusBadge(driver.status).className)}>
                        {statusBadge(driver.status).label}
                      </span>
                    </div>
                    <p className="meta-text truncate">
                      {vehicle?.name ?? '—'} · {stopsDone}/{stopsTotal} Stopps
                      {tour ? ` · ${tour.description ?? tour.id.slice(0, 8)}` : ''}
                    </p>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${util}%` }} />
                    </div>
                    <p className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {weight} / {capacity || '—'} kg · {util}%
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="glass-card p-4 space-y-3">
              <p className="card-title">Nicht disponiert</p>
              {unassignedSelected.length === 0 ? (
                <div className="flex flex-col items-center py-4 text-muted-foreground gap-2">
                  <Package className="w-6 h-6 opacity-40" />
                  <p className="meta-text">Alle Sendungen zugeordnet</p>
                </div>
              ) : (
                unassignedSelected.slice(0, 10).map((s) => (
                  <div key={s.id} className="sub-card p-2.5">
                    <p className="text-sm font-medium text-foreground truncate">
                      {s.name || s.customer_name || 'Sendung'}
                    </p>
                    <p className="meta-text truncate">{s.delivery_address || '—'}</p>
                    <p className="meta-text text-dim whitespace-nowrap">
                      {s.weight_kg ?? '—'} kg · {formatTime(s.window_start)}–{formatTime(s.window_end)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : viewMode === 'week' ? (
        <div className="space-y-4">
          <div className="glass-card overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-left">
              <thead>
                <tr className="border-b border-hairline">
                  <th className="p-3 text-[10.5px] uppercase tracking-wider text-dim font-semibold w-[200px]">
                    Fahrer
                  </th>
                  {weekDays.map((d) => (
                    <th key={fmt(d)} className="p-3 text-[10.5px] uppercase tracking-wider text-dim font-semibold">
                      <div>{DAYS[(d.getDay() + 6) % 7]}</div>
                      <div className="text-foreground normal-case tracking-normal text-xs font-semibold mt-0.5">
                        {d.getDate()}.
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.drivers ?? []).map((driver) => {
                  const badge = statusBadge(driver.status);
                  const vehicle = driver.assigned_vehicle_id
                    ? vehicleMap.get(driver.assigned_vehicle_id)
                    : null;
                  return (
                    <tr key={driver.id} className="border-b border-white/[0.04]">
                      <td className="p-3 align-top">
                        <p className="text-sm font-semibold text-foreground">{driver.name}</p>
                        <p className="meta-text truncate">{vehicle?.name ?? '—'}</p>
                        <p className="meta-text text-dim">
                          {formatShift(driver.shift_start)}–{formatShift(driver.shift_end)}
                          {vehicle?.capacity != null ? ` · ${vehicle.capacity} kg` : ''}
                        </p>
                        <span className={cn('inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-sm', badge.className)}>
                          {badge.label}
                        </span>
                      </td>
                      {weekDays.map((d) => {
                        const dateStr = fmt(d);
                        const match = findTourForDriver(driver, dateStr);
                        if (match) {
                          const weight = match.stops.reduce((sum, st) => {
                            const sh = (shipmentsByDate.get(dateStr) ?? []).find((s) => s.id === st.shipment_id);
                            return sum + (sh?.weight_kg ?? 0);
                          }, 0);
                          const capacity = vehicle?.capacity ?? 0;
                          const util = capacity > 0 ? Math.min(100, Math.round((weight / capacity) * 100)) : 0;
                          const arrivals = match.stops.map((s) => s.arrival_time).filter(Boolean) as string[];
                          const deps = match.stops.map((s) => s.departure_time).filter(Boolean) as string[];
                          const windowLabel =
                            arrivals.length || deps.length
                              ? `${formatTime(arrivals[0] ?? null)}–${formatTime(deps[deps.length - 1] ?? arrivals[arrivals.length - 1] ?? null)}`
                              : '—';
                          return (
                            <td key={dateStr} className="p-2 align-top">
                              <div className="sub-card p-2 space-y-1 h-full">
                                <p className="text-[11px] font-mono text-primary truncate">
                                  {match.tour.description ?? match.tour.id.slice(0, 8)}
                                </p>
                                <p className="meta-text">{match.stops.length} Stopps</p>
                                <p className="meta-text text-dim">{windowLabel}</p>
                                <div className="progress-track">
                                  <div className="progress-fill" style={{ width: `${util}%` }} />
                                </div>
                                <p className="text-[10px] font-semibold text-foreground">{util}%</p>
                              </div>
                            </td>
                          );
                        }
                        let label = 'frei';
                        if (isWeekend(dateStr)) label = 'Wochenende';
                        else if (isAbsent(driver.status)) label = 'abwesend';
                        else label = 'verfügbar';
                        return (
                          <td key={dateStr} className="p-2 align-top">
                            <div className="h-full min-h-[72px] border border-dashed border-hairline rounded-sm flex items-center justify-center px-2">
                              <span className="meta-text text-dim">{label}</span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {(data?.drivers ?? []).length === 0 && (
              <p className="meta-text text-center py-10">Keine Fahrer vorhanden.</p>
            )}
          </div>

          <div className="glass-card p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="card-title">Pool nicht disponierter Sendungen</p>
                <p className="meta-text mt-0.5">{weekUnassigned.length} Sendungen in dieser Woche</p>
              </div>
              <Button
                className="rounded font-semibold"
                disabled={planLoading || weekUnassigned.length === 0}
                onClick={() => void startPlanning(fmt(viewDate))}
              >
                {planLoading ? 'Zuordnen…' : 'Automatisch zuordnen'}
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left">
                <thead>
                  <tr className="border-b border-hairline">
                    {['Sendung', 'Kunde', 'Lieferadresse', 'Zeitfenster', 'Gewicht', 'Termin'].map((h) => (
                      <th key={h} className="py-2 pr-3 text-[10.5px] uppercase tracking-wider text-dim font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weekUnassigned.map((s) => (
                    <tr key={s.id} className="border-b border-white/[0.04]">
                      <td className="py-2.5 pr-3 font-mono text-xs text-primary">{s.id.slice(0, 8)}</td>
                      <td className="py-2.5 pr-3 text-sm text-foreground">{s.customer_name || '—'}</td>
                      <td className="py-2.5 pr-3 text-sm text-muted-foreground truncate max-w-[200px]">
                        {s.delivery_address || '—'}
                      </td>
                      <td className="py-2.5 pr-3 meta-text whitespace-nowrap">
                        {formatTime(s.window_start)}–{formatTime(s.window_end)}
                      </td>
                      <td className="py-2.5 pr-3 text-sm whitespace-nowrap">{s.weight_kg ?? '—'} kg</td>
                      <td className="py-2.5 pr-3 meta-text whitespace-nowrap">{s.service_date}</td>
                    </tr>
                  ))}
                  {weekUnassigned.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center meta-text">
                        Keine offenen Sendungen in dieser Woche.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {[
              { label: 'Touren', value: dayKeyStats.tours },
              { label: 'Sendungen', value: dayKeyStats.shipments },
              { label: 'Offen', value: dayKeyStats.unassigned },
              { label: 'Auslastung', value: `${dayKeyStats.util}%` },
            ].map((k) => (
              <div key={k.label} className="glass-card p-4 text-center">
                <p className="text-[10px] uppercase tracking-wide text-dim">{k.label}</p>
                <p className="text-2xl font-semibold text-foreground whitespace-nowrap mt-1">{k.value}</p>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <Button
              className="rounded font-semibold"
              disabled={planLoading}
              onClick={() => void startPlanning(dayKey)}
            >
              {planLoading ? 'Plant…' : 'Planung starten'}
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="glass-card p-4 space-y-3">
              <p className="card-title">Fahrer & Touren</p>
              {driverDayRows.length === 0 ? (
                <p className="meta-text">Keine Fahrer.</p>
              ) : (
                driverDayRows.map(({ driver, vehicle, weight, capacity, util, stopsDone, stopsTotal, tour }) => (
                  <div key={driver.id} className="sub-card p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{driver.name}</p>
                      <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-sm', statusBadge(driver.status).className)}>
                        {statusBadge(driver.status).label}
                      </span>
                    </div>
                    <p className="meta-text truncate">
                      {vehicle?.name ?? '—'} · {stopsDone}/{stopsTotal} Stopps
                      {tour ? ` · ${tour.description ?? tour.id.slice(0, 8)}` : ' · keine Tour'}
                    </p>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${util}%` }} />
                    </div>
                    <p className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {weight} / {capacity || '—'} kg · {util}%
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-4">
              <div className="glass-card p-4 space-y-3">
                <p className="card-title">Zugeordnet ({dayKeyAssignedList.length})</p>
                {dayKeyAssignedList.length === 0 ? (
                  <p className="meta-text">Keine zugeordneten Sendungen.</p>
                ) : (
                  dayKeyAssignedList.map((s) => (
                    <div key={s.id} className="sub-card p-2.5">
                      <p className="text-sm font-medium text-foreground truncate">
                        {s.name || s.customer_name || 'Sendung'}
                      </p>
                      <p className="meta-text truncate">{s.delivery_address || '—'}</p>
                      <p className="meta-text text-dim whitespace-nowrap">
                        {s.weight_kg ?? '—'} kg · {formatTime(s.window_start)}–{formatTime(s.window_end)}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <div className="glass-card p-4 space-y-3">
                <p className="card-title">Nicht disponiert ({dayKeyUnassigned.length})</p>
                {dayKeyUnassigned.length === 0 ? (
                  <div className="flex flex-col items-center py-4 text-muted-foreground gap-2">
                    <Package className="w-6 h-6 opacity-40" />
                    <p className="meta-text">Alle Sendungen zugeordnet</p>
                  </div>
                ) : (
                  dayKeyUnassigned.map((s) => (
                    <div key={s.id} className="sub-card p-2.5">
                      <p className="text-sm font-medium text-foreground truncate">
                        {s.name || s.customer_name || 'Sendung'}
                      </p>
                      <p className="meta-text truncate">{s.delivery_address || '—'}</p>
                      <p className="meta-text text-dim whitespace-nowrap">
                        {s.weight_kg ?? '—'} kg · {formatTime(s.window_start)}–{formatTime(s.window_end)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
