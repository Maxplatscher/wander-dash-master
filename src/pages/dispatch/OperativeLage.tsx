import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MapPin, ArrowRight, Clock, Settings, FileText, AlertTriangle,
  CheckCircle2, ClipboardList, Calendar as CalendarIcon, ChevronLeft, ChevronRight,
  TrendingUp, Truck, Package, MoreVertical, Plus, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDispatch } from '@/lib/dispatch-context';
import { supabase } from '@/integrations/supabase/client';
import { LiveMap } from '@/components/dispatch/LiveMap';
import { useProblems } from '@/pages/dispatch/Probleme';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

/* ═══════════════════════════════════════════
   Styles
   ═══════════════════════════════════════════ */
const CARD = 'bg-white rounded-2xl p-5 flex flex-col shadow-sm border border-gray-100';
const CARD_SM = 'bg-white rounded-2xl p-4 flex flex-col shadow-sm border border-gray-100';
const SECTION_TITLE = 'text-sm font-bold text-gray-800';
const PRIMARY_TEXT = 'text-gray-800';
const SECONDARY_TEXT = 'text-gray-500';

const DRIVER_COLORS = ['#ef4444', '#6366f1', '#f59e0b', '#10b981', '#8b5cf6'];
const CARD_GRADIENTS = [
  'from-red-500 to-orange-500',
  'from-indigo-500 to-blue-500',
  'from-amber-400 to-yellow-500',
  'from-emerald-500 to-teal-500',
  'from-purple-500 to-pink-500',
];

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
   Mini Calendar (right sidebar)
   ═══════════════════════════════════════════ */
function MiniCalendar() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = firstDay === 0 ? 6 : firstDay - 1;

  const monthName = now.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  const days = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  return (
    <div className={CARD}>
      <div className="flex items-center justify-between mb-3">
        <p className={SECTION_TITLE}>Kalender</p>
      </div>
      <div className="flex items-center justify-between mb-3">
        <button className="w-6 h-6 rounded-full hover:bg-gray-100 flex items-center justify-center">
          <ChevronLeft className="w-3.5 h-3.5 text-gray-500" />
        </button>
        <p className="text-xs font-semibold text-gray-700">{monthName}</p>
        <button className="w-6 h-6 rounded-full hover:bg-gray-100 flex items-center justify-center">
          <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {days.map(d => (
          <span key={d} className="text-[10px] font-semibold text-gray-400 pb-1">{d}</span>
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
                'text-[11px] w-7 h-7 flex items-center justify-center rounded-full mx-auto cursor-pointer transition-colors',
                isToday
                  ? 'bg-indigo-500 text-white font-bold shadow-md shadow-indigo-200'
                  : 'text-gray-600 hover:bg-gray-100'
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
   Live Clock
   ═══════════════════════════════════════════ */
function LiveClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const timeStr = time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = time.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="text-center">
      <p className="text-3xl font-extrabold tracking-tight text-gray-800">{timeStr}</p>
      <p className="text-xs text-gray-500 mt-1">{dateStr}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Weather Widget
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

  if (isLoading) return <p className="text-xs text-gray-400">Lade Wetter…</p>;

  return (
    <div className="flex items-center gap-3">
      <span className="text-3xl">{emoji}</span>
      <div>
        <p className="text-lg font-bold text-gray-800">{Math.round(weather?.temperature ?? 0)}°C</p>
        <p className="text-xs text-gray-500">{label} · Wind {weather?.windspeed ?? 0} km/h</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Weight Bar Chart
   ═══════════════════════════════════════════ */
function WeightBarChart({ drivers }: { drivers: { name: string; weight: number }[] }) {
  const maxWeight = Math.max(...drivers.map(d => d.weight), 1);

  return (
    <div className="flex items-end gap-3 h-32 mt-2">
      {drivers.map((d, i) => (
        <div key={i} className="flex flex-col items-center flex-1 gap-1">
          <span className="text-[10px] font-semibold text-gray-500">{d.weight}kg</span>
          <div
            className="w-full rounded-t-lg transition-all duration-500"
            style={{
              height: `${Math.max((d.weight / maxWeight) * 85, 6)}%`,
              backgroundColor: DRIVER_COLORS[i % DRIVER_COLORS.length],
            }}
          />
          <span className="text-[10px] text-gray-400 truncate max-w-full">{d.name.split(' ')[0]}</span>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Donut Chart
   ═══════════════════════════════════════════ */
function DonutChart({ drivers }: { drivers: { name: string; percent: number }[] }) {
  const size = 110;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const sorted = [...drivers].sort((a, b) => b.percent - a.percent);
  let accumulatedOffset = 0;

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f3f4f6" strokeWidth={strokeWidth} />
        {sorted.map((d, i) => {
          const segmentLength = (d.percent / 100) * circumference * 0.18;
          const dashOffset = circumference - accumulatedOffset;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={DRIVER_COLORS[i % DRIVER_COLORS.length]}
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
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: DRIVER_COLORS[i % DRIVER_COLORS.length] }} />
            <span className="text-gray-700">{d.name.split(' ')[0]}</span>
            <span className="font-bold ml-auto text-gray-800">{d.percent}%</span>
          </div>
        ))}
      </div>
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
  const queryClient = useQueryClient();

  const [showAddDriver, setShowAddDriver] = useState(false);
  const [newDriver, setNewDriver] = useState({ name: '', phone: '' });
  const [saving, setSaving] = useState(false);

  const handleAddDriver = async () => {
    if (!newDriver.name.trim()) return;
    setSaving(true);
    try {
      const { data: cid } = await supabase.rpc('get_user_company_id');
      if (!cid) { toast.error('Kein Unternehmen zugeordnet'); setSaving(false); return; }
      const { error } = await supabase.from('driver').insert({
        name: newDriver.name.trim(),
        phone: newDriver.phone.trim() || null,
        company_id: cid,
        status: 'verfügbar',
      });
      if (error) throw error;
      toast.success('Fahrer hinzugefügt');
      setNewDriver({ name: '', phone: '' });
      setShowAddDriver(false);
      queryClient.invalidateQueries({ queryKey: ['active-drivers-tour'] });
    } catch (e: any) {
      toast.error(e.message ?? 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

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

  const activeProblems = (problems ?? []).slice(0, 5);
  const driverCards = (activeDrivers ?? []).slice(0, 3);

  const totalStops = (activeDrivers ?? []).reduce((s, d) => s + d.totalStops, 0);
  const completedStops = (activeDrivers ?? []).reduce((s, d) => s + d.completedStops, 0);
  const totalWeight = (activeDrivers ?? []).reduce((s, d) => s + d.totalWeight, 0);

  return (
    <div className="flex gap-6 max-w-[1600px] mx-auto relative">
      {/* ═══ CENTER COLUMN ═══ */}
      <div className="flex-1 min-w-0 space-y-5">

        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-indigo-50 rounded-2xl p-6 border border-indigo-100 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800 mb-1">Aktuelle Lage</h1>
            <p className="text-sm text-gray-500 max-w-md">
              Übersicht über alle aktiven Touren, Fahrer und Lieferungen für den {selectedDate.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <LiveClock />
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-5xl opacity-80">
            🚛
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-4 gap-4">
          {(activeDrivers ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center" onClick={() => setShowAddDriver(true)}>
              <div className="w-20 h-20 rounded-full border-2 border-dashed border-indigo-300 flex items-center justify-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-all group">
                <Plus className="w-8 h-8 text-indigo-400 group-hover:text-indigo-600 transition-colors" />
              </div>
              <p className="text-[11px] font-medium text-indigo-600 mt-2">Fahrer Hinzufügen</p>
            </div>
          ) : (
            <div className={cn(CARD_SM, 'items-center text-center')}>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center mb-2">
                <Truck className="w-5 h-5 text-indigo-500" />
              </div>
              <p className="text-xl font-bold text-gray-800">{(activeDrivers ?? []).length}</p>
              <p className="text-[11px] text-gray-500">Aktive Fahrer</p>
            </div>
          )}
          <div className={cn(CARD_SM, 'items-center text-center')}>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-xl font-bold text-gray-800">{completedStops}/{totalStops}</p>
            <p className="text-[11px] text-gray-500">Stops erledigt</p>
          </div>
          <div className={cn(CARD_SM, 'items-center text-center')}>
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center mb-2">
              <Package className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-xl font-bold text-gray-800">{totalWeight} kg</p>
            <p className="text-[11px] text-gray-500">Gesamtgewicht</p>
          </div>
          <div className={cn(CARD_SM, 'items-center text-center')}>
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center mb-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <p className="text-xl font-bold text-gray-800">{activeProblems.length}</p>
            <p className="text-[11px] text-gray-500">Offene Probleme</p>
          </div>
        </div>

        {/* Colored Driver Cards — like "Folders" in the image */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className={SECTION_TITLE}>Aktive Touren</p>
            <button
              onClick={() => navigateTo('fahrer')}
              className="text-xs text-indigo-500 font-medium hover:text-indigo-700 transition-colors"
            >
              Alle anzeigen →
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {driverCards.length > 0 ? driverCards.map((driver, i) => (
              <div
                key={i}
                className={cn(
                  'rounded-2xl p-4 text-white bg-gradient-to-br shadow-lg',
                  CARD_GRADIENTS[i % CARD_GRADIENTS.length]
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                    <Truck className="w-4 h-4" />
                  </div>
                  <button className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/20">
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="font-bold text-sm truncate">{driver.tourDescription}</p>
                <p className="text-white/80 text-xs mt-1 truncate">{driver.name}</p>
                <div className="flex items-center gap-2 mt-3 text-[11px] text-white/70">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{driver.currentLocation}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className="text-white/80">{driver.completedStops}/{driver.totalStops} Stops</span>
                  <span className="font-semibold">{driver.totalWeight} kg</span>
                </div>
                {/* Progress bar */}
                <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white/60 rounded-full transition-all duration-500"
                    style={{ width: `${driver.totalStops > 0 ? (driver.completedStops / driver.totalStops) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )) : (
              [0, 1, 2].map(i => (
                <div key={i} className={cn('rounded-2xl p-4 text-white bg-gradient-to-br', CARD_GRADIENTS[i])}>
                  <div className="flex flex-col items-center justify-center h-24 text-center">
                    <Truck className="w-8 h-8 opacity-40 mb-2" />
                    <p className="text-xs text-white/60">Keine aktive Tour</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Donut */}
          <div className={CARD}>
            <p className={cn(SECTION_TITLE, 'mb-3')}>Tourfortschritt</p>
            {donutData.length > 0 ? (
              <DonutChart drivers={donutData} />
            ) : (
              <p className="text-xs text-gray-400 text-center mt-4">Keine aktiven Touren</p>
            )}
          </div>

          {/* Weight */}
          <div className={CARD}>
            <p className={cn(SECTION_TITLE, 'mb-3')}>Gewicht der Touren</p>
            {weightData.length > 0 ? (
              <WeightBarChart drivers={weightData} />
            ) : (
              <p className="text-xs text-gray-400 text-center mt-4">Keine Daten</p>
            )}
          </div>
        </div>

        {/* Recent Tours — like "Recent Files" in the image */}
        <div className={CARD}>
          <div className="flex items-center justify-between mb-3">
            <p className={SECTION_TITLE}>Alle Fahrer heute</p>
            <button
              onClick={() => navigateTo('fahrer')}
              className="text-xs text-indigo-500 font-medium hover:text-indigo-700 transition-colors"
            >
              Alle anzeigen →
            </button>
          </div>
          <div className="space-y-0">
            {(activeDrivers ?? []).length > 0 ? (activeDrivers ?? []).map((d, i) => {
              const pct = d.totalStops > 0 ? Math.round((d.completedStops / d.totalStops) * 100) : 0;
              return (
                <div key={i} className={cn(
                  'flex items-center gap-3 py-3 px-3 -mx-1 rounded-xl transition-colors',
                  i % 2 === 1 && 'bg-gray-50/70'
                )}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: DRIVER_COLORS[i % DRIVER_COLORS.length] }}>
                    {d.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{d.name}</p>
                    <p className="text-[11px] text-gray-400 truncate">{d.tourDescription}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold text-gray-700">{d.completedStops}/{d.totalStops} Stops</p>
                  </div>
                  <div className="w-16 shrink-0">
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: DRIVER_COLORS[i % DRIVER_COLORS.length] }} />
                    </div>
                  </div>
                  <span className="text-xs font-bold text-gray-700 w-10 text-right shrink-0">{pct}%</span>
                </div>
              );
            }) : (
              <p className="text-xs text-gray-400 py-4 text-center">Keine aktiven Fahrer heute</p>
            )}
          </div>
        </div>
      </div>

      {/* ═══ RIGHT SIDEBAR ═══ */}
      <div className="w-72 shrink-0 space-y-4 hidden xl:block">
        {/* Calendar */}
        <MiniCalendar />

        {/* Probleme */}
        <div className={CARD}>
          <div className="flex items-center justify-between mb-3">
            <p className={SECTION_TITLE}>Probleme</p>
            <button
              onClick={() => navigateTo('probleme')}
              className="text-xs text-indigo-500 font-medium hover:text-indigo-700 transition-colors"
            >
              Alle →
            </button>
          </div>
          {activeProblems.length > 0 ? (
            <div className="space-y-3">
              {activeProblems.map((p, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className={cn(
                    'w-2 h-2 rounded-full mt-1.5 shrink-0',
                    p.severity === 'kritisch' ? 'bg-red-500' : 'bg-amber-400'
                  )} />
                  <div>
                    <p className="text-xs font-medium text-gray-700">{p.title}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{p.severity}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-4 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
              <p className="text-xs font-medium text-gray-700">Alles in Ordnung</p>
            </div>
          )}
        </div>

        {/* Weather */}
        <div className={CARD}>
          <p className={cn(SECTION_TITLE, 'mb-3')}>Wetter</p>
          <InlineWeather />
        </div>

        {/* Quick Links */}
        <div className={CARD}>
          <p className={cn(SECTION_TITLE, 'mb-3')}>Schnellzugriff</p>
          <div className="space-y-2">
            {[
              { label: 'Tagesleitstelle', icon: ClipboardList, section: 'tagesleitstelle' as const },
              { label: 'Kontrollzentrale', icon: FileText, section: 'kontrollzentrale' as const },
              { label: 'Einstellungen', icon: Settings, section: 'einstellungen' as const },
            ].map((item, i) => (
              <button
                key={i}
                onClick={() => navigateTo(item.section)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 transition-all"
              >
                <item.icon className="w-4 h-4 text-gray-400" />
                <span>{item.label}</span>
                <ArrowRight className="w-3 h-3 ml-auto text-gray-300" />
              </button>
            ))}
          </div>
        </div>

        {/* Live Map */}
        <div className={cn(CARD, 'p-0 overflow-hidden')}>
          <p className={cn(SECTION_TITLE, 'p-5 pb-0')}>Live-Karte</p>
          <div className="h-48">
            <LiveMap />
          </div>
        </div>
      </div>
    </div>
  );
}
