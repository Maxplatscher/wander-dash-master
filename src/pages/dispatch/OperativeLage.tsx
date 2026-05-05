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
import { DriverDetailDialog } from '@/components/dispatch/DriverDetailDialog';
import { useProblems } from '@/pages/dispatch/Probleme';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

/* ═══════════════════════════════════════════
   Styles
   ═══════════════════════════════════════════ */
const CARD = 'glass-card p-5 flex flex-col';
const CARD_SM = 'glass-card p-4 flex flex-col';
const SECTION_TITLE = 'text-sm font-bold text-foreground';
const PRIMARY_TEXT = 'text-foreground';
const SECONDARY_TEXT = 'text-muted-foreground';

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
        <button className="w-6 h-6 rounded-full hover:bg-white/5 flex items-center justify-center">
          <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        <p className="text-xs font-semibold text-foreground">{monthName}</p>
        <button className="w-6 h-6 rounded-full hover:bg-white/5 flex items-center justify-center">
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {days.map(d => (
          <span key={d} className="text-[10px] font-semibold text-muted-foreground pb-1">{d}</span>
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
                  ? 'bg-primary text-primary-foreground font-bold shadow-glow'
                  : 'text-muted-foreground hover:bg-white/5'
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
      <p className="text-3xl font-extrabold tracking-tight text-foreground">{timeStr}</p>
      <p className="text-xs text-muted-foreground mt-1">{dateStr}</p>
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

  if (isLoading) return <p className="text-xs text-muted-foreground">Lade Wetter…</p>;

  return (
    <div className="flex items-center gap-3">
      <span className="text-3xl">{emoji}</span>
      <div>
        <p className="text-lg font-bold text-foreground">{Math.round(weather?.temperature ?? 0)}°C</p>
        <p className="text-xs text-muted-foreground">{label} · Wind {weather?.windspeed ?? 0} km/h</p>
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
          <span className="text-[10px] font-semibold text-muted-foreground">{d.weight}kg</span>
          <div
            className="w-full rounded-t-lg transition-all duration-500"
            style={{
              height: `${Math.max((d.weight / maxWeight) * 85, 6)}%`,
              backgroundColor: DRIVER_COLORS[i % DRIVER_COLORS.length],
            }}
          />
          <span className="text-[10px] text-muted-foreground truncate max-w-full">{d.name.split(' ')[0]}</span>
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
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth={strokeWidth} />
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
  const [selectedDriver, setSelectedDriver] = useState<typeof driverCards[0] | null>(null);
  const [selectedDriverGradient, setSelectedDriverGradient] = useState('');
  const [newDriver, setNewDriver] = useState({ name: '', phone: '', vehicleName: '', vehicleCapacity: '', hints: '' });
  const [saving, setSaving] = useState(false);

  // Fetch existing vehicles for selection
  const { data: existingVehicles } = useQuery({
    queryKey: ['vehicles-for-driver'],
    queryFn: async () => {
      const { data } = await supabase.from('vehicle').select('id, name, capacity');
      return data ?? [];
    },
  });
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('new');

  const handleAddDriver = async () => {
    if (!newDriver.name.trim()) return;
    setSaving(true);
    try {
      const { data: cid } = await supabase.rpc('get_user_company_id');
      if (!cid) { toast.error('Kein Unternehmen zugeordnet'); setSaving(false); return; }

      // Create or select vehicle
      let vehicleId: string | null = null;
      if (selectedVehicleId === 'new' && newDriver.vehicleName.trim()) {
        const { data: veh, error: vErr } = await supabase.from('vehicle').insert({
          name: newDriver.vehicleName.trim(),
          capacity: newDriver.vehicleCapacity ? parseInt(newDriver.vehicleCapacity) : null,
          company_id: cid,
        }).select('id').single();
        if (vErr) throw vErr;
        vehicleId = veh.id;
      } else if (selectedVehicleId !== 'new') {
        vehicleId = selectedVehicleId;
      }

      const { data: driver, error } = await supabase.from('driver').insert({
        name: newDriver.name.trim(),
        phone: newDriver.phone.trim() || null,
        company_id: cid,
        status: 'verfügbar',
      }).select('id').single();
      if (error) throw error;

      // Store hints as a note (we can use this later for AI tour planning)
      if (newDriver.hints.trim()) {
        console.log('Driver hints for AI:', newDriver.hints.trim(), 'driver:', driver.id, 'vehicle:', vehicleId);
      }

      toast.success('Fahrer & Fahrzeug hinzugefügt');
      setNewDriver({ name: '', phone: '', vehicleName: '', vehicleCapacity: '', hints: '' });
      setSelectedVehicleId('new');
      setShowAddDriver(false);
      queryClient.invalidateQueries({ queryKey: ['active-drivers-tour'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles-for-driver'] });
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
  const driverCards = (activeDrivers ?? []).slice(0, 4);

  const totalStops = (activeDrivers ?? []).reduce((s, d) => s + d.totalStops, 0);
  const completedStops = (activeDrivers ?? []).reduce((s, d) => s + d.completedStops, 0);
  const totalWeight = (activeDrivers ?? []).reduce((s, d) => s + d.totalWeight, 0);

  return (
    <div className="flex gap-6 max-w-[1600px] mx-auto relative">
      {/* ═══ CENTER COLUMN ═══ */}
      <div className="flex-1 min-w-0 space-y-5">

        {/* Welcome Banner */}
        <div className="glass-card p-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground mb-1">Aktuelle Lage</h1>
            <p className="text-sm text-muted-foreground max-w-md">
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

        {/* KPI Row — Driver cards fill slots, remaining show "Fahrer Hinzufügen" */}
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => {
            const driver = driverCards[i];
            if (driver) {
              return (
                <div
                  key={i}
                  className={cn(
                    'rounded-2xl p-4 text-white bg-gradient-to-br shadow-lg cursor-pointer hover:scale-[1.02] transition-transform',
                    CARD_GRADIENTS[i % CARD_GRADIENTS.length]
                  )}
                  onClick={() => {
                    setSelectedDriver(driver);
                    setSelectedDriverGradient(CARD_GRADIENTS[i % CARD_GRADIENTS.length]);
                  }}
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
                  <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white/60 rounded-full transition-all duration-500"
                      style={{ width: `${driver.totalStops > 0 ? (driver.completedStops / driver.totalStops) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              );
            }
            return (
              <div key={i} className="flex flex-col items-center justify-center" onClick={() => setShowAddDriver(true)}>
                <div className="w-20 h-20 rounded-full border-2 border-dashed border-indigo-300 flex items-center justify-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-all group">
                  <Plus className="w-8 h-8 text-indigo-400 group-hover:text-indigo-600 transition-colors" />
                </div>
                <p className="text-[11px] font-medium text-indigo-600 mt-2">Fahrer Hinzufügen</p>
              </div>
            );
          })}
        </div>

        {/* Fahrer Fortschritt + Live Karte */}
        <div className="grid grid-cols-2 gap-4">
          <div className={CARD}>
            <p className={cn(SECTION_TITLE, 'mb-4')}>Fahrer Fortschritt</p>
            <div className="space-y-3">
              {(driverCards.length > 0 ? driverCards : [{name: 'Fahrer 1', completedStops: 0, totalStops: 0}, {name: 'Fahrer 2', completedStops: 0, totalStops: 0}, {name: 'Fahrer 3', completedStops: 0, totalStops: 0}]).map((driver, i) => {
                const pct = driver.totalStops > 0 ? Math.round((driver.completedStops / driver.totalStops) * 100) : 0;
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{driver.name}</span>
                      <span className="text-foreground font-semibold">{pct}%</span>
                    </div>
                    <div className="h-3 bg-white/5 border border-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: DRIVER_COLORS[i % DRIVER_COLORS.length],
                          opacity: pct > 0 ? 0.85 : 0.3,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            {driverCards.length === 0 && (
              <p className="text-[10px] text-muted-foreground text-center mt-4">Keine aktiven Touren vorhanden</p>
            )}
          </div>
          <div className={CARD}>
            <p className={cn(SECTION_TITLE, 'mb-4')}>Live Karte</p>
            <LiveMap />
          </div>
        </div>

      </div>

      {/* Add Driver Dialog */}
      <Dialog open={showAddDriver} onOpenChange={setShowAddDriver}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Neuen Fahrer hinzufügen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Name */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Name *</label>
              <Input
                placeholder="z.B. Max Müller"
                value={newDriver.name}
                onChange={(e) => setNewDriver(p => ({ ...p, name: e.target.value }))}
              />
            </div>
            {/* Telefon */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Telefon</label>
              <Input
                placeholder="+49 171 ..."
                value={newDriver.phone}
                onChange={(e) => setNewDriver(p => ({ ...p, phone: e.target.value }))}
              />
            </div>

            {/* Fahrzeug */}
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Truck className="w-4 h-4 text-indigo-500" />
                <label className="text-sm font-bold text-gray-800">Fahrzeug zuweisen</label>
              </div>

              {existingVehicles && existingVehicles.length > 0 ? (
                <>
                  <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Fahrzeug wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">+ Neues Fahrzeug anlegen</SelectItem>
                      {existingVehicles.map(v => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name} {v.capacity ? `(${v.capacity} kg)` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedVehicleId === 'new' && (
                    <div className="mt-3 space-y-3 pl-2 border-l-2 border-indigo-100">
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Fahrzeugname *</label>
                        <Input
                          placeholder="z.B. Sprinter 1"
                          value={newDriver.vehicleName}
                          onChange={(e) => setNewDriver(p => ({ ...p, vehicleName: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Kapazität (kg)</label>
                        <Input
                          type="number"
                          placeholder="z.B. 1500"
                          value={newDriver.vehicleCapacity}
                          onChange={(e) => setNewDriver(p => ({ ...p, vehicleCapacity: e.target.value }))}
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-gray-400">Noch kein Fahrzeug vorhanden – lege eines an:</p>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Fahrzeugname *</label>
                    <Input
                      placeholder="z.B. Sprinter 1"
                      value={newDriver.vehicleName}
                      onChange={(e) => setNewDriver(p => ({ ...p, vehicleName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Kapazität (kg)</label>
                    <Input
                      type="number"
                      placeholder="z.B. 1500"
                      value={newDriver.vehicleCapacity}
                      onChange={(e) => setNewDriver(p => ({ ...p, vehicleCapacity: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Hinweise für KI */}
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-amber-500" />
                <label className="text-sm font-bold text-gray-800">Hinweise</label>
              </div>
              <Textarea
                placeholder="z.B. Fahrer kennt Gebiet Nord gut, max. 8h Schicht, keine Autobahn..."
                value={newDriver.hints}
                onChange={(e) => setNewDriver(p => ({ ...p, hints: e.target.value }))}
                rows={3}
                className="text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">Diese Hinweise werden bei der automatischen Tourenplanung berücksichtigt.</p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAddDriver(false)}>Abbrechen</Button>
              <Button onClick={handleAddDriver} disabled={saving || !newDriver.name.trim()}>
                {saving ? 'Speichern…' : 'Fahrer anlegen'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DriverDetailDialog
        open={!!selectedDriver}
        onOpenChange={(open) => { if (!open) setSelectedDriver(null); }}
        driver={selectedDriver}
        gradientClass={selectedDriverGradient}
      />
    </div>
  );
}
