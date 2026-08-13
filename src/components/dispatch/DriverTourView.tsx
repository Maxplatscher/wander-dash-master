import { useState } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, Polyline } from '@react-google-maps/api';
import { CheckCircle2, Circle, MapPin, Clock, Navigation, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  getCyanSquareMarkerIcon,
  getDarkMapOptions,
  getGoogleMapsApiKey,
  GOOGLE_MAPS_LIBRARIES,
  GOOGLE_MAPS_LOADER_ID,
} from '@/lib/google-maps';

const GOOGLE_MAPS_API_KEY = getGoogleMapsApiKey();

interface Stop {
  id: string;
  address: string;
  customer: string;
  timeWindow: string;
  packages: number;
  lat: number;
  lng: number;
  done: boolean;
}

/** Demo-Stops — echte Tour-Daten folgen in einem eigenen Block */
const initialStops: Stop[] = [
  { id: 'S-1', address: 'Alexanderplatz 1, Berlin', customer: 'Müller GmbH', timeWindow: '08:00–09:00', packages: 3, lat: 52.5219, lng: 13.4132, done: true },
  { id: 'S-2', address: 'Friedrichstr. 43, Berlin', customer: 'Schmidt AG', timeWindow: '09:15–10:00', packages: 1, lat: 52.5200, lng: 13.3880, done: true },
  { id: 'S-3', address: 'Potsdamer Platz 5, Berlin', customer: 'Weber KG', timeWindow: '10:15–11:00', packages: 2, lat: 52.5096, lng: 13.3761, done: false },
  { id: 'S-4', address: 'Kurfürstendamm 21, Berlin', customer: 'Fischer & Co', timeWindow: '11:30–12:15', packages: 4, lat: 52.5035, lng: 13.3320, done: false },
  { id: 'S-5', address: 'Unter den Linden 77, Berlin', customer: 'Becker OHG', timeWindow: '13:00–13:45', packages: 2, lat: 52.5170, lng: 13.3888, done: false },
  { id: 'S-6', address: 'Karl-Marx-Allee 90, Berlin', customer: 'Hofmann Ltd', timeWindow: '14:00–14:45', packages: 1, lat: 52.5185, lng: 13.4310, done: false },
];

const driverPosition = { lat: 52.5130, lng: 13.3850 };

export function DriverTourView() {
  const [stops, setStops] = useState<Stop[]>(initialStops);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_LOADER_ID,
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const doneCount = stops.filter((s) => s.done).length;
  const totalPackages = stops.reduce((a, s) => a + s.packages, 0);
  const donePackages = stops.filter((s) => s.done).reduce((a, s) => a + s.packages, 0);

  const toggleStop = (id: string) => {
    setStops((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const newDone = !s.done;
        toast.success(newDone ? `${s.customer} erledigt ✓` : `${s.customer} wieder offen`);
        return { ...s, done: newDone };
      }),
    );
  };

  const routePath = [driverPosition, ...stops.filter((s) => !s.done).map((s) => ({ lat: s.lat, lng: s.lng }))];

  return (
    <div className="space-y-4">
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-3 gap-3">
          <div>
            <p className="section-title">Meine Tour</p>
            <h3 className="card-title mt-1">Heute</h3>
            <p className="meta-text mt-0.5">Tour T-001 · MB Sprinter · B-DI 1001</p>
          </div>
          <div className="flex items-center gap-3 meta-text">
            <span className="flex items-center gap-1">
              <Package className="w-3.5 h-3.5" /> {donePackages}/{totalPackages} Pakete
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> {doneCount}/{stops.length} Stops
            </span>
          </div>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${(doneCount / stops.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="card-title">Stopps</p>
          {stops.map((stop, i) => (
            <div
              key={stop.id}
              className={cn(
                'sub-card p-3 flex items-start gap-3',
                stop.done && 'opacity-70',
              )}
            >
              <button
                type="button"
                onClick={() => toggleStop(stop.id)}
                className="mt-0.5 shrink-0"
                title={stop.done ? 'Als offen markieren' : 'Als erledigt markieren'}
              >
                {stop.done ? (
                  <CheckCircle2 className="w-5 h-5 text-success" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={cn(
                      'text-sm font-medium',
                      stop.done ? 'line-through text-muted-foreground' : 'text-foreground',
                    )}
                  >
                    {i + 1}. {stop.customer}
                  </p>
                  <span className="font-mono text-[10.5px] text-dim px-1.5 py-0.5 rounded-sm bg-white/[0.03] border border-hairline">
                    {stop.id}
                  </span>
                </div>
                <p className="meta-text mt-0.5 truncate">{stop.address}</p>
                <div className="flex items-center gap-3 mt-1 meta-text">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {stop.timeWindow}
                  </span>
                  <span className="flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    {stop.packages} Pakete
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="shrink-0 h-8 w-8 p-0 rounded"
                onClick={() => setSelectedStop(stop)}
              >
                <Navigation className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <p className="card-title">Live-Standort & Route</p>
          <div className="rounded-sm border border-hairline overflow-hidden bg-[#101012]">
            {!isLoaded ? (
              <div className="aspect-square flex items-center justify-center">
                <p className="meta-text">Karte wird geladen…</p>
              </div>
            ) : (
              <div className="aspect-square">
                <GoogleMap
                  mapContainerStyle={{ width: '100%', height: '100%' }}
                  center={driverPosition}
                  zoom={13}
                  options={getDarkMapOptions()}
                >
                  <Marker
                    position={driverPosition}
                    icon={getCyanSquareMarkerIcon()}
                    title="Mein Standort"
                  />

                  {stops.map((stop, i) => (
                    <Marker
                      key={stop.id}
                      position={{ lat: stop.lat, lng: stop.lng }}
                      label={{
                        text: `${i + 1}`,
                        color: '#0d0d0f',
                        fontWeight: '600',
                        fontSize: '11px',
                      }}
                      opacity={stop.done ? 0.4 : 1}
                      onClick={() => setSelectedStop(stop)}
                    />
                  ))}

                  {routePath.length > 1 && (
                    <Polyline
                      path={routePath}
                      options={{
                        strokeColor: '#7ce8f5',
                        strokeOpacity: 0.7,
                        strokeWeight: 3,
                      }}
                    />
                  )}

                  {selectedStop && (
                    <InfoWindow
                      position={{ lat: selectedStop.lat, lng: selectedStop.lng }}
                      onCloseClick={() => setSelectedStop(null)}
                    >
                      <div className="text-sm p-1 text-[#0d0d0f]">
                        <p className="font-semibold">{selectedStop.customer}</p>
                        <p className="text-xs opacity-70">{selectedStop.address}</p>
                        <p className="text-xs mt-1">
                          {selectedStop.timeWindow} · {selectedStop.packages} Pakete
                        </p>
                        <p className="text-xs mt-1">{selectedStop.done ? 'Erledigt' : 'Offen'}</p>
                      </div>
                    </InfoWindow>
                  )}
                </GoogleMap>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
