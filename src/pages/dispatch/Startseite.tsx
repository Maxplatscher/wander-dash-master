import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Route,
  Users,
  PackageX,
  AlertTriangle,
  CheckCircle2,
  Gauge,
  Plus,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
  Sun,
  Umbrella,
} from 'lucide-react';
import { KpiCard } from '@/components/dispatch/KpiCard';
import { KpiDetailDialog } from '@/components/dispatch/KpiDetailDialog';
import { LiveMap } from '@/components/dispatch/LiveMap';
import { DriverDetailDialog } from '@/components/dispatch/DriverDetailDialog';
import { AddDriverDialog } from '@/components/dispatch/AddDriverDialog';
import { useDispatch } from '@/lib/dispatch-context';
import { matchesSearch } from '@/lib/dispatch-search';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useProblems } from '@/pages/dispatch/Probleme';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ViewMode = 'leitstand' | 'zeitstrahl';

type DriverDayRow = {
  name: string;
  status: string;
  currentLocation: string;
  nextStop: string;
  tourId: string | null;
  tourDescription: string;
  completedStops: number;
  totalStops: number;
  totalWeight: number;
  vehicleName: string;
  shiftStart: string;
  shiftEnd: string;
  absentReason: string | null;
};

const TIMELINE_START = 6;
const TIMELINE_END = 18;
const TIMELINE_HOURS = TIMELINE_END - TIMELINE_START;

function useKpis(date: string, depotId: string | null) {
  return useQuery({
    queryKey: ['kpis', date, depotId],
    queryFn: async () => {
      let shipmentsQuery = supabase.from('shipment').select('id').eq('service_date', date);
      if (depotId) shipmentsQuery = shipmentsQuery.eq('depot_id', depotId);

      const [tours, vehicles, drivers, shipments] = await Promise.all([
        supabase.from('tour').select('id, is_active').eq('date', date),
        supabase.from('vehicle').select('id'),
        supabase.from('driver').select('id, status'),
        shipmentsQuery,
      ]);

      const activeTours = tours.data?.filter((t) => t.is_active) ?? [];
      const tourIds = activeTours.map((t) => t.id);

      let assignedIds: string[] = [];
      let completedStops = 0;
      let totalStops = 0;
      if (tourIds.length > 0) {
        const { data: stops } = await supabase
          .from('tour_stop')
          .select('shipment_id, driver_completed')
          .in('tour_id', tourIds);
        assignedIds = (stops ?? []).map((s) => s.shipment_id).filter(Boolean) as string[];
        totalStops = stops?.length ?? 0;
        completedStops = (stops ?? []).filter((s) => s.driver_completed).length;
      }

      const totalShipments = shipments.data?.length ?? 0;
      const shipmentIdSet = new Set((shipments.data ?? []).map((s) => s.id));
      const assignedInScope = assignedIds.filter((id) => shipmentIdSet.has(id)).length;
      const unassigned = Math.max(0, totalShipments - assignedInScope);
      const activeDrivers = drivers.data?.filter((d) => d.status === 'active' || d.status === 'aktiv').length ?? 0;
      const absentDrivers = (drivers.data?.length ?? 0) - activeDrivers;
      const avgUtilization =
        totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;

      return {
        activeTours: activeTours.length,
        totalTours: tours.data?.length ?? 0,
        vehiclesInUse: tourIds.length,
        totalVehicles: vehicles.data?.length ?? 0,
        activeDrivers,
        absentDrivers,
        unassigned,
        problems: unassigned,
        totalShipments,
        completedStops,
        totalStops,
        avgUtilization,
      };
    },
  });
}

function useActiveDriversOnTour(date: string) {
  return useQuery({
    queryKey: ['active-drivers-tour', date],
    queryFn: async () => {
      const { data: drivers } = await supabase
        .from('driver')
        .select('id, name, status, phone, shift_start, shift_end, assigned_vehicle_id');

      const { data: tours } = await supabase
        .from('tour')
        .select('id, description, is_active')
        .eq('date', date)
        .eq('is_active', true);

      const { data: vehicles } = await supabase.from('vehicle').select('id, name, capacity');
      const vehicleMap = new Map((vehicles ?? []).map((v) => [v.id, v]));

      const tourIds = (tours ?? []).map((t) => t.id);
      let stops: {
        tour_id: string;
        shipment_id: string | null;
        stop_index: number | null;
        driver_completed: boolean | null;
        vehicle_id: string | null;
        arrival_time: string | null;
        departure_time: string | null;
      }[] = [];
      if (tourIds.length > 0) {
        const { data } = await supabase
          .from('tour_stop')
          .select('tour_id, shipment_id, stop_index, driver_completed, vehicle_id, arrival_time, departure_time')
          .in('tour_id', tourIds)
          .order('stop_index');
        stops = data ?? [];
      }

      const { data: shipments } = await supabase
        .from('shipment')
        .select('id, customer_name, delivery_address, weight_kg');
      const shipmentMap = new Map((shipments ?? []).map((s) => [s.id, s]));

      const tourRows: DriverDayRow[] = [];
      (tours ?? []).forEach((tour, idx) => {
        const tourStops = stops.filter((s) => s.tour_id === tour.id);
        if (tourStops.length === 0) return;

        const completed = tourStops.filter((s) => s.driver_completed).length;
        const nextStopData = tourStops.find((s) => !s.driver_completed);
        const lastCompleted = [...tourStops].reverse().find((s) => s.driver_completed);
        const currentShipment = lastCompleted?.shipment_id
          ? shipmentMap.get(lastCompleted.shipment_id)
          : null;
        const nextShipment = nextStopData?.shipment_id
          ? shipmentMap.get(nextStopData.shipment_id)
          : null;
        const totalWeight = tourStops.reduce((sum, s) => {
          const sh = s.shipment_id ? shipmentMap.get(s.shipment_id) : null;
          return sum + (sh?.weight_kg ?? 0);
        }, 0);

        const vehicleId = tourStops.find((s) => s.vehicle_id)?.vehicle_id;
        const vehicle = vehicleId ? vehicleMap.get(vehicleId) : null;
        const driver = (drivers ?? [])[idx];

        tourRows.push({
          name: driver?.name ?? tour.description ?? `Tour ${idx + 1}`,
          status: driver?.status ?? 'aktiv',
          currentLocation: currentShipment?.delivery_address ?? 'Depot',
          nextStop: nextShipment?.customer_name ?? 'Keine weiteren Stops',
          tourId: tour.id,
          tourDescription: tour.description ?? `Tour-${tour.id.slice(0, 4)}`,
          completedStops: completed,
          totalStops: tourStops.length,
          totalWeight,
          vehicleName: vehicle?.name ?? '—',
          shiftStart: formatTime(driver?.shift_start) || '06:00',
          shiftEnd: formatTime(driver?.shift_end) || '16:00',
          absentReason: null,
        });
      });

      const onTourNames = new Set(tourRows.map((r) => r.name));
      const idleRows: DriverDayRow[] = (drivers ?? [])
        .filter((d) => d.name && !onTourNames.has(d.name))
        .map((d) => {
          const status = (d.status ?? 'verfügbar').toLowerCase();
          const isAbsent =
            status.includes('abwesend') || status.includes('krank') || status === 'inactive';
          return {
            name: d.name ?? 'Fahrer',
            status: d.status ?? 'verfügbar',
            currentLocation: '—',
            nextStop: '—',
            tourId: null,
            tourDescription: '',
            completedStops: 0,
            totalStops: 0,
            totalWeight: 0,
            vehicleName: d.assigned_vehicle_id
              ? vehicleMap.get(d.assigned_vehicle_id)?.name ?? '—'
              : '—',
            shiftStart: formatTime(d.shift_start) || '06:00',
            shiftEnd: formatTime(d.shift_end) || '16:00',
            absentReason: isAbsent
              ? 'abwesend — krank gemeldet'
              : 'verfügbar — keine Tour disponiert',
          };
        });

      return [...tourRows, ...idleRows];
    },
    refetchInterval: 120_000,
  });
}

function formatTime(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.slice(0, 5);
}

function timeToPercent(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  const minutes = (h - TIMELINE_START) * 60 + (m || 0);
  const total = TIMELINE_HOURS * 60;
  return Math.min(100, Math.max(0, (minutes / total) * 100));
}

function greetingForHour(h: number): string {
  if (h < 11) return 'Guten Morgen';
  if (h < 18) return 'Guten Tag';
  return 'Guten Abend';
}

function firstNameFromUser(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null): string {
  const meta = user?.user_metadata;
  const full = typeof meta?.full_name === 'string' ? meta.full_name.trim() : '';
  if (full) return full.split(/\s+/)[0] ?? 'Disponent';
  const email = user?.email?.split('@')[0] ?? 'Disponent';
  return email.charAt(0).toUpperCase() + email.slice(1);
}

function statusBadge(status: string) {
  const s = status.toLowerCase();
  if (s.includes('abwesend') || s.includes('krank') || s === 'inactive') {
    return { label: 'abwesend', className: 'bg-danger/15 text-danger' };
  }
  if (s === 'active' || s === 'aktiv') {
    return { label: 'aktiv', className: 'bg-success/15 text-success' };
  }
  return { label: 'verfügbar', className: 'bg-primary/15 text-primary' };
}

function weatherIcon(code: number) {
  if (code <= 1) return Sun;
  if (code <= 3) return Cloud;
  if (code <= 48) return CloudFog;
  if (code <= 67) return CloudRain;
  if (code <= 77) return CloudSnow;
  return CloudLightning;
}

function CompactWeather() {
  const { data, isLoading } = useQuery({
    queryKey: ['weather-inline'],
    queryFn: async () => {
      const res = await fetch(
        'https://api.open-meteo.com/v1/forecast?latitude=48.14&longitude=11.58&current_weather=true&hourly=temperature_2m,weathercode,precipitation_probability&timezone=Europe%2FBerlin',
      );
      return res.json();
    },
    refetchInterval: 600_000,
    staleTime: 300_000,
  });

  const current = data?.current_weather;
  const Icon = weatherIcon(current?.weathercode ?? 1);
  const hourly = useMemo(() => {
    const times: string[] = data?.hourly?.time ?? [];
    const temps: number[] = data?.hourly?.temperature_2m ?? [];
    const codes: number[] = data?.hourly?.weathercode ?? [];
    const precipitation: number[] = data?.hourly?.precipitation_probability ?? [];
    const now = Date.now();
    const rows: { label: string; temp: number; code: number; precipitation: number }[] = [];
    for (let i = 0; i < times.length && rows.length < 4; i++) {
      const t = new Date(times[i]).getTime();
      if (t >= now - 30 * 60_000) {
        rows.push({
          label: new Date(times[i]).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
          temp: Math.round(temps[i] ?? 0),
          code: codes[i] ?? 1,
          precipitation: Math.round(precipitation[i] ?? 0),
        });
      }
    }
    return rows;
  }, [data]);

  if (isLoading) {
    return <p className="meta-text">Wetter wird geladen…</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded bg-primary/10 text-primary flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xl font-semibold text-foreground whitespace-nowrap">
            {Math.round(current?.temperature ?? 0)}°C
          </p>
          <p className="meta-text">München · Wind {current?.windspeed ?? 0} km/h</p>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {hourly.map((h) => {
          const HIcon = weatherIcon(h.code);
          return (
            <div key={h.label} className="sub-card px-2 py-2 text-center">
              <p className="text-[10px] text-dim uppercase tracking-wide">{h.label}</p>
              <HIcon className="w-3.5 h-3.5 mx-auto my-1 text-primary" />
              <p className="text-xs font-semibold text-foreground whitespace-nowrap">{h.temp}°</p>
              <p className="mt-0.5 flex items-center justify-center gap-1 text-[10px] text-dim whitespace-nowrap">
                <Umbrella className="h-2.5 w-2.5" aria-hidden="true" />
                {h.precipitation} %
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimelineView({
  rows,
  problems,
}: {
  rows: DriverDayRow[];
  problems: { id: string; title: string; detail: string; severity: string }[];
}) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const nowPct = timeToPercent(
    `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
  );
  const hours = Array.from({ length: TIMELINE_HOURS + 1 }, (_, i) => TIMELINE_START + i);

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="flex mb-2 pl-[140px]">
            {hours.map((h) => (
              <div key={h} className="flex-1 meta-text text-dim">
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {rows.map((row) => {
              const badge = statusBadge(row.status);
              const left = timeToPercent(row.shiftStart);
              const right = timeToPercent(row.shiftEnd);
              const width = Math.max(2, right - left);
              const fillPct =
                row.totalStops > 0 ? (row.completedStops / row.totalStops) * 100 : 0;

              return (
                <div key={`${row.name}-${row.tourId ?? 'idle'}`} className="flex items-center gap-3">
                  <div className="w-[140px] shrink-0">
                    <p className="text-sm font-medium text-foreground truncate">{row.name}</p>
                    <span className={cn('inline-block mt-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded-sm', badge.className)}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="relative flex-1 h-8 rounded-sm bg-white/[0.03] border border-hairline">
                    {row.tourId ? (
                      <div
                        className="absolute top-1 bottom-1 rounded-sm border border-primary/40 bg-primary/15 overflow-hidden"
                        style={{ left: `${left}%`, width: `${width}%` }}
                        title={row.tourDescription}
                      >
                        <div className="progress-fill h-full" style={{ width: `${fillPct}%` }} />
                      </div>
                    ) : (
                      <div className="absolute inset-1 border border-dashed border-white/15 rounded-sm flex items-center px-2">
                        <span className="meta-text text-dim truncate">{row.absentReason}</span>
                      </div>
                    )}
                    <div
                      className="absolute top-0 bottom-0 w-px bg-primary z-10"
                      style={{ left: `${nowPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {rows.length === 0 && (
              <p className="meta-text py-6 text-center">Keine Fahrer für diesen Tag.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4 space-y-3">
          <p className="card-title">Offene Punkte</p>
          {problems.length === 0 ? (
            <p className="meta-text">Keine offenen Probleme.</p>
          ) : (
            problems.slice(0, 6).map((p) => (
              <div key={p.id} className="sub-card p-3">
                <p className="text-sm font-medium text-foreground">{p.title}</p>
                <p className="meta-text mt-1">{p.detail}</p>
              </div>
            ))
          )}
        </div>
        <div className="glass-card p-0 overflow-hidden min-h-[280px]">
          <LiveMap fill />
        </div>
      </div>
    </div>
  );
}

export function Startseite() {
  const { selectedDate, selectedDepotId, selectedDepotLabel, searchQuery } = useDispatch();
  const { user } = useAuth();
  const dateStr = selectedDate.toISOString().split('T')[0];
  const { data: kpis } = useKpis(dateStr, selectedDepotId);
  const { data: driverRows } = useActiveDriversOnTour(dateStr);
  const { data: problems } = useProblems(dateStr, selectedDepotId);

  const [viewMode, setViewMode] = useState<ViewMode>('leitstand');
  const [detailType, setDetailType] = useState<
    'activeTours' | 'vehicles' | 'drivers' | 'unassigned' | 'conflicts' | null
  >(null);
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<DriverDayRow | null>(null);

  const activeOnTour = useMemo(
    () =>
      (driverRows ?? []).filter(
        (d) =>
          d.tourId &&
          matchesSearch(searchQuery, d.name, d.currentLocation, d.nextStop, d.tourDescription, d.vehicleName),
      ),
    [driverRows, searchQuery],
  );
  const visibleDriverRows = useMemo(
    () =>
      (driverRows ?? []).filter((d) =>
        matchesSearch(searchQuery, d.name, d.currentLocation, d.nextStop, d.tourDescription, d.vehicleName),
      ),
    [driverRows, searchQuery],
  );

  const problemCount = problems?.length ?? kpis?.problems ?? 0;
  const firstName = firstNameFromUser(user);
  const greet = greetingForHour(new Date().getHours());
  const dateLabel = selectedDate.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const kurzlage = `${kpis?.activeTours ?? 0} von ${kpis?.totalTours ?? 0} Touren laufen, ${kpis?.unassigned ?? 0} Sendungen warten auf Zuordnung`;

  return (
    <div className="space-y-5 max-w-[1600px] mx-auto">
      {/* Begrüßungsbanner */}
      <div
        className="glass-card p-5 flex flex-col sm:flex-row sm:items-center gap-4"
        style={{
          background:
            'linear-gradient(135deg, hsl(var(--panel)) 0%, hsl(186 86% 72% / 0.06) 100%)',
        }}
      >
        <div className="flex-1 min-w-0">
          <p className="section-title">Startseite</p>
          <h1 className="page-title mt-1">
            {greet}, {firstName}
          </h1>
          <p className="meta-text mt-1.5">
            {dateLabel} · {selectedDepotLabel} · {kurzlage}
          </p>
        </div>
        <div className="flex shrink-0 rounded border border-hairline p-0.5 bg-background/40">
          <button
            type="button"
            onClick={() => setViewMode('leitstand')}
            className={cn(
              'px-3 py-1.5 text-xs font-semibold rounded-sm transition-colors',
              viewMode === 'leitstand'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Live Status
          </button>
          <button
            type="button"
            onClick={() => setViewMode('zeitstrahl')}
            className={cn(
              'px-3 py-1.5 text-xs font-semibold rounded-sm transition-colors',
              viewMode === 'zeitstrahl'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Tagesplan
          </button>
        </div>
      </div>

      {/* KPI-Band */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard
          icon={Route}
          label="Aktive Touren"
          value={kpis?.activeTours ?? 0}
          subtitle={`${kpis?.totalTours ?? 0} gesamt`}
          pulse={(kpis?.activeTours ?? 0) > 0}
          onClick={() => setDetailType('activeTours')}
        />
        <KpiCard
          icon={Users}
          label="Fahrer aktiv"
          value={kpis?.activeDrivers ?? 0}
          subtitle="im Einsatz"
          onClick={() => setDetailType('drivers')}
        />
        <KpiCard
          icon={CheckCircle2}
          label="Stopps erledigt"
          value={kpis?.completedStops ?? 0}
          subtitle={`von ${kpis?.totalStops ?? 0}`}
          variant="success"
        />
        <KpiCard
          icon={Gauge}
          label="Ø Auslastung"
          value={`${kpis?.avgUtilization ?? 0}%`}
          subtitle="Stopps"
        />
        <KpiCard
          icon={PackageX}
          label="Unzugeordnet"
          value={kpis?.unassigned ?? 0}
          variant={(kpis?.unassigned ?? 0) > 0 ? 'warning' : 'default'}
          onClick={() => setDetailType('unassigned')}
        />
        <KpiCard
          icon={AlertTriangle}
          label="Probleme"
          value={problemCount}
          variant={problemCount > 0 ? 'destructive' : 'default'}
          onClick={() => setDetailType('conflicts')}
        />
      </div>

      {viewMode === 'leitstand' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 glass-card p-0 overflow-hidden min-h-[420px]">
            <LiveMap fill />
          </div>
          <div className="lg:col-span-5 space-y-4">
            <div className="glass-card p-4">
              <p className="card-title mb-3">Wetter</p>
              <CompactWeather />
            </div>
            <div className="glass-card p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="card-title">Fahrer-Fortschritt</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs rounded"
                  onClick={() => setShowAddDriver(true)}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Fahrer
                </Button>
              </div>
              {activeOnTour.length === 0 ? (
                <p className="meta-text">Keine aktiven Touren vorhanden.</p>
              ) : (
                activeOnTour.map((driver) => {
                  const pct =
                    driver.totalStops > 0
                      ? Math.round((driver.completedStops / driver.totalStops) * 100)
                      : 0;
                  const badge = statusBadge(driver.status);
                  return (
                    <button
                      key={driver.tourId}
                      type="button"
                      onClick={() => setSelectedDriver(driver)}
                      className="w-full text-left sub-card p-3 space-y-2 hover-lift"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{driver.name}</p>
                          <p className="meta-text text-primary truncate">{driver.tourDescription}</p>
                        </div>
                        <span className={cn('shrink-0 px-1.5 py-0.5 text-[10px] font-semibold rounded-sm', badge.className)}>
                          {badge.label}
                        </span>
                      </div>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex items-center justify-between meta-text">
                        <span>
                          {driver.completedStops}/{driver.totalStops} Stopps
                        </span>
                        <span className="truncate ml-2">
                          {driver.vehicleName} · {driver.shiftStart}–{driver.shiftEnd}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : (
        <TimelineView rows={visibleDriverRows} problems={problems ?? []} />
      )}

      <AddDriverDialog open={showAddDriver} onOpenChange={setShowAddDriver} />

      <DriverDetailDialog
        open={!!selectedDriver?.tourId}
        onOpenChange={(open) => {
          if (!open) setSelectedDriver(null);
        }}
        driver={
          selectedDriver?.tourId
            ? {
                name: selectedDriver.name,
                tourId: selectedDriver.tourId,
                tourDescription: selectedDriver.tourDescription,
                currentLocation: selectedDriver.currentLocation,
                completedStops: selectedDriver.completedStops,
                totalStops: selectedDriver.totalStops,
                totalWeight: selectedDriver.totalWeight,
              }
            : null
        }
        gradientClass="from-primary/20 to-transparent"
      />

      <KpiDetailDialog
        open={detailType !== null}
        onOpenChange={(open) => {
          if (!open) setDetailType(null);
        }}
        type={detailType ?? 'activeTours'}
        date={dateStr}
      />
    </div>
  );
}
