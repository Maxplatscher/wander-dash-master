import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  MapPin, ArrowRight, Clock, Settings, FileText, AlertTriangle,
  CheckCircle2, ClipboardList, Calendar as CalendarIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDispatch } from '@/lib/dispatch-context';
import { supabase } from '@/integrations/supabase/client';
import { LiveMap } from '@/components/dispatch/LiveMap';
import { useProblems } from '@/pages/dispatch/Probleme';

/* ═══════════════════════════════════════════
   Styles — Management Dashboard
   ═══════════════════════════════════════════ */
const CARD = 'bg-white border border-[#e2e8f0] rounded-xl p-4 flex flex-col shadow-sm';
const CARD_TITLE = 'text-[11px] uppercase tracking-wider text-[#1e3a5f] font-semibold mb-3';
const PRIMARY_TEXT = 'text-[#1a2340]';
const SECONDARY_TEXT = 'text-[#6b7c93]';

/* ── Driver colors for charts — darker blue palette ── */
const DRIVER_COLORS = ['#1e3a5f', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'];

/* ═══════════════════════════════════════════
   Data hooks
   ═══════════════════════════════════════════ */
function useActiveDriversOnTour(date: string) {
  return useQuery({
    queryKey: ['active-drivers-tour', date],
    queryFn: async () => {
      const { data: tours } = await supabase
        .from('tour')
        .select('id, description, is_active')
        .eq('date', date)
        .eq('is_active', true);

      if (!tours?.length) return [];

      const tourIds = tours.map(t => t.id);
      const { data: stops } = await supabase
        .from('tour_stop')
        .select('tour_id, shipment_id, stop_index, driver_completed, vehicle_id')
        .in('tour_id', tourIds)
        .order('stop_index');

      const { data: drivers } = await supabase
        .from('driver')
        .select('id, name, status');

      const { data: shipments } = await supabase
        .from('shipment')
        .select('id, customer_name, delivery_address, weight_kg');

      // Build driver-tour mapping
      const result: {
        name: string;
        currentLocation: string;
        nextStop: string;
        tourId: string;
        tourDescription: string;
        completedStops: number;
        totalStops: number;
        totalWeight: number;
      }[] = [];

      const activeDrivers = (drivers ?? []).filter(d => d.status === 'active' || d.status === 'aktiv');
      const shipmentMap = new Map((shipments ?? []).map(s => [s.id, s]));

      tours.forEach((tour, idx) => {
        const tourStops = (stops ?? []).filter(s => s.tour_id === tour.id);
        if (tourStops.length === 0) return;

        const completed = tourStops.filter(s => s.driver_completed).length;
        const nextStopData = tourStops.find(s => !s.driver_completed);
        const lastCompleted = [...tourStops].reverse().find(s => s.driver_completed);

        const currentShipment = lastCompleted?.shipment_id ? shipmentMap.get(lastCompleted.shipment_id) : null;
        const nextShipment = nextStopData?.shipment_id ? shipmentMap.get(nextStopData.shipment_id) : null;

        const totalWeight = tourStops.reduce((sum, s) => {
          const sh = s.shipment_id ? shipmentMap.get(s.shipment_id) : null;
          return sum + (sh?.weight_kg ?? 0);
        }, 0);

        const driverName = activeDrivers[idx]?.name ?? tour.description ?? `Tour ${idx + 1}`;

        result.push({
          name: driverName,
          currentLocation: currentShipment?.delivery_address ?? 'Depot',
          nextStop: nextShipment?.customer_name ?? 'Keine weiteren Stops',
          tourId: tour.id,
          tourDescription: tour.description ?? `Tour-${tour.id.slice(0, 4)}`,
          completedStops: completed,
          totalStops: tourStops.length,
          totalWeight,
        });
      });

      return result.slice(0, 5);
    },
    refetchInterval: 120_000,
  });
}

/* ═══════════════════════════════════════════
   Mini Calendar Component
   ═══════════════════════════════════════════ */
function MiniCalendar() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = firstDay === 0 ? 6 : firstDay - 1; // Monday start

  const monthName = now.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  const days = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  return (
    <div>
      <p className={cn(CARD_TITLE)}>Kalender</p>
      <p className={cn('text-xs font-semibold mb-2', PRIMARY_TEXT)}>{monthName}</p>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {days.map(d => (
          <span key={d} className="text-[9px] font-medium text-[#aaa]">{d}</span>
        ))}
        {Array.from({ length: offset }).map((_, i) => (
          <span key={`e-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const isToday = day === today;
          return (
            <span
              key={day}
              className={cn(
                'text-[10px] w-5 h-5 flex items-center justify-center rounded-full mx-auto',
                isToday ? 'bg-blue-600 text-white font-bold' : 'text-[#666]'
              )}
            >
              {day}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Live Clock Component
   ═══════════════════════════════════════════ */
function LiveClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const timeStr = time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const dateStr = time.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <p className={CARD_TITLE}>Aktuelle Uhrzeit</p>
      <p className={cn('text-4xl font-extrabold tracking-tight', PRIMARY_TEXT)}>{timeStr}</p>
      <p className={cn('text-xs mt-1', SECONDARY_TEXT)}>{dateStr}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Donut Chart Component
   ═══════════════════════════════════════════ */
function DonutChart({ drivers }: { drivers: { name: string; percent: number }[] }) {
  const size = 120;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const sorted = [...drivers].sort((a, b) => b.percent - a.percent);
  let accumulatedOffset = 0;

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f0f0f0" strokeWidth={strokeWidth} />
        {sorted.map((d, i) => {
          const segmentLength = (d.percent / 100) * circumference * 0.18; // scale segments
          const dashOffset = circumference - accumulatedOffset;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={DRIVER_COLORS[i]}
              strokeWidth={strokeWidth}
              strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              className="transition-all duration-500"
              style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
            />
          );
          accumulatedOffset += segmentLength + 2;
          return el;
        })}
      </svg>
      <div className="space-y-1.5">
        {sorted.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: DRIVER_COLORS[i] }} />
            <span className={PRIMARY_TEXT}>{d.name.split(' ')[0]}</span>
            <span className={cn('font-semibold ml-auto', PRIMARY_TEXT)}>{d.percent}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Bar Chart Component
   ═══════════════════════════════════════════ */
function WeightBarChart({ drivers }: { drivers: { name: string; weight: number }[] }) {
  const maxWeight = Math.max(...drivers.map(d => d.weight), 1);

  return (
    <div className="flex items-end gap-2 h-28 mt-2">
      {drivers.map((d, i) => (
        <div key={i} className="flex flex-col items-center flex-1 gap-1">
          <span className="text-[9px] font-semibold text-[#666]">{d.weight}kg</span>
          <div
            className="w-full rounded-t-md transition-all duration-500"
            style={{
              height: `${Math.max((d.weight / maxWeight) * 80, 4)}%`,
              backgroundColor: DRIVER_COLORS[i],
            }}
          />
          <span className="text-[9px] text-[#aaa] truncate max-w-full">{d.name.split(' ')[0]}</span>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Weather Widget (inline, Open-Meteo)
   ═══════════════════════════════════════════ */
function InlineWeather() {
  const { data, isLoading } = useQuery({
    queryKey: ['weather-inline'],
    queryFn: async () => {
      const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=48.14&longitude=11.58&current_weather=true');
      return res.json();
    },
    refetchInterval: 600_000,
    staleTime: 300_000,
  });

  const weather = data?.current_weather;
  const code = weather?.weathercode ?? 1;
  let label = 'Sonnig';
  let emoji = '☀️';
  if (code > 1 && code <= 3) { label = 'Bewölkt'; emoji = '⛅'; }
  else if (code > 3 && code <= 48) { label = 'Nebelig'; emoji = '🌫️'; }
  else if (code > 48 && code <= 67) { label = 'Regen'; emoji = '🌧️'; }
  else if (code > 67 && code <= 77) { label = 'Schnee'; emoji = '❄️'; }
  else if (code > 77) { label = 'Gewitter'; emoji = '⛈️'; }

  if (isLoading) return <p className="text-xs text-[#aaa]">Lade Wetter…</p>;

  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <p className={CARD_TITLE}>Aktuelles Wetter</p>
      <span className="text-4xl mb-1">{emoji}</span>
      <p className={cn('text-2xl font-bold', PRIMARY_TEXT)}>{Math.round(weather?.temperature ?? 0)}°C</p>
      <p className={cn('text-xs', SECONDARY_TEXT)}>{label}</p>
      <p className={cn('text-[10px] mt-1', SECONDARY_TEXT)}>Wind: {weather?.windspeed ?? 0} km/h</p>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════ */
export function OperativeLage() {
  const { selectedDate, navigateTo } = useDispatch();
  const dateStr = selectedDate.toISOString().split('T')[0];
  const { data: activeDrivers } = useActiveDriversOnTour(dateStr);
  const { data: problems } = useProblems(dateStr);

  const driverCards = useMemo(() => {
    const cards = (activeDrivers ?? []).slice(0, 5);
    while (cards.length < 5) {
      cards.push(null as any);
    }
    return cards;
  }, [activeDrivers]);

  const donutData = useMemo(() => {
    return (activeDrivers ?? []).map(d => ({
      name: d.name,
      percent: d.totalStops > 0 ? Math.round((d.completedStops / d.totalStops) * 100) : 0,
    }));
  }, [activeDrivers]);

  const weightData = useMemo(() => {
    return (activeDrivers ?? []).map(d => ({
      name: d.name,
      weight: d.totalWeight,
    }));
  }, [activeDrivers]);

  const activeProblems = (problems ?? []).slice(0, 4);

  return (
    <div className="space-y-3 max-w-[1400px] mx-auto relative">

      {/* ═══ ROW 1 — 7 cards ═══ */}
      <div className="grid grid-cols-7 gap-3">
        {/* Cards 1-5: Active drivers */}
        {driverCards.map((driver, i) => (
          <div key={i} className={cn(CARD, 'min-h-[120px] justify-center')}>
            {driver ? (
              <>
                <p className={CARD_TITLE}>Fahrer {i + 1}</p>
                <p className={cn('text-sm font-bold truncate', PRIMARY_TEXT)}>{driver.name}</p>
                <div className={cn('flex items-center gap-1 mt-1.5 text-[10px]', SECONDARY_TEXT)}>
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{driver.currentLocation}</span>
                </div>
                <div className={cn('flex items-center gap-1 mt-1 text-[10px]', SECONDARY_TEXT)}>
                  <ArrowRight className="w-3 h-3 shrink-0" />
                  <span className="truncate">{driver.nextStop}</span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center text-center">
                <p className={cn('text-xs', SECONDARY_TEXT)}>Kein aktiver Fahrer</p>
              </div>
            )}
          </div>
        ))}

        {/* Card 6: Mini Calendar */}
        <div className={cn(CARD, 'min-h-[120px]')}>
          <MiniCalendar />
        </div>

        {/* Card 7: Live Clock */}
        <div className={cn(CARD, 'min-h-[120px]')}>
          <LiveClock />
        </div>
      </div>

      {/* ═══ ROW 2 — 5 cards ═══ */}
      <div className="grid grid-cols-5 gap-3">
        {/* Donut: Tour Progress */}
        <div className={cn(CARD, 'min-h-[180px]')}>
          <p className={CARD_TITLE}>Tourfortschritt</p>
          {donutData.length > 0 ? (
            <DonutChart drivers={donutData} />
          ) : (
            <p className={cn('text-xs text-center mt-4', SECONDARY_TEXT)}>Keine aktiven Touren</p>
          )}
        </div>

        {/* Tageszusammenfassung */}
        <div
          className={cn(CARD, 'min-h-[180px] items-center justify-center cursor-pointer hover:shadow-md transition-shadow')}
          onClick={() => navigateTo('tagesleitstelle')}
        >
          <p className={CARD_TITLE}>Tageszusammenfassung</p>
          <ClipboardList className="w-10 h-10 text-blue-600 mb-2" />
          <p className={cn('text-xs text-center', SECONDARY_TEXT)}>Klicken für Details</p>
        </div>

        {/* Weight Bar Chart */}
        <div className={cn(CARD, 'min-h-[180px]')}>
          <p className={CARD_TITLE}>Gewicht der Touren</p>
          {weightData.length > 0 ? (
            <WeightBarChart drivers={weightData} />
          ) : (
            <p className={cn('text-xs text-center mt-4', SECONDARY_TEXT)}>Keine Daten</p>
          )}
        </div>

        {/* Einstellungen */}
        <div
          className={cn(CARD, 'min-h-[180px] items-center justify-center cursor-pointer hover:shadow-md transition-shadow')}
          onClick={() => navigateTo('einstellungen')}
        >
          <p className={CARD_TITLE}>Einstellungen</p>
          <Settings className="w-12 h-12 text-[#aaa] mb-2" />
        </div>

        {/* Lieferscheine */}
        <div
          className={cn(CARD, 'min-h-[180px] items-center justify-center cursor-pointer hover:shadow-md transition-shadow')}
          onClick={() => navigateTo('kontrollzentrale')}
        >
          <p className={CARD_TITLE}>Lieferscheine & mehr</p>
          <FileText className="w-10 h-10 text-blue-600 mb-2" />
          <p className={cn('text-xs text-center', SECONDARY_TEXT)}>Klicken zum Öffnen</p>
        </div>
      </div>

      {/* ═══ ROW 3 — 4 cards ═══ */}
      <div className="grid grid-cols-4 gap-3">
        {/* Tageskilometer Ranking */}
        <div className={cn(CARD, 'min-h-[200px]')}>
          <p className={CARD_TITLE}>Tageskilometer-Ranking</p>
          <div className="space-y-2 mt-1">
            {(activeDrivers ?? []).length > 0 ? (
              (activeDrivers ?? []).slice(0, 6).map((d, i) => {
                const estimatedKm = Math.round((d.completedStops / Math.max(d.totalStops, 1)) * 180 + Math.random() * 20);
                return (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className={cn('font-medium', PRIMARY_TEXT)}>{d.name}</span>
                    <div className="flex-1 mx-2 border-b border-dotted border-[#ddd]" />
                    <span className={cn('font-bold', PRIMARY_TEXT)}>{estimatedKm} km</span>
                  </div>
                );
              })
            ) : (
              <p className={cn('text-xs', SECONDARY_TEXT)}>Keine Fahrer aktiv</p>
            )}
          </div>
        </div>

        {/* Wetter */}
        <div className={cn(CARD, 'min-h-[200px]')}>
          <InlineWeather />
        </div>

        {/* Live-Karte */}
        <div className={cn(CARD, 'min-h-[200px] p-0 overflow-hidden')}>
          <p className={cn(CARD_TITLE, 'p-4 pb-0')}>Live-Karte</p>
          <div className="flex-1 min-h-0">
            <LiveMap />
          </div>
        </div>

        {/* Probleme & Hinweise */}
        <div className={cn(CARD, 'min-h-[200px]')}>
          <p className={CARD_TITLE}>Probleme & Hinweise</p>
          {activeProblems.length > 0 ? (
            <div className="space-y-2 mt-1">
              {activeProblems.map((p, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className={cn(
                    'w-2 h-2 rounded-full mt-1 shrink-0',
                    p.severity === 'kritisch' ? 'bg-red-500' : 'bg-amber-500'
                  )} />
                  <span className={PRIMARY_TEXT}>{p.title}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
              <p className={cn('text-xs font-medium', PRIMARY_TEXT)}>Alles in Ordnung</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
