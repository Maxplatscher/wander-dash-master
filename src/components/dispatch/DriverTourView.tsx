import { useState, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, Polyline } from '@react-google-maps/api';
import { CheckCircle2, Circle, MapPin, Clock, Navigation, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const GOOGLE_MAPS_API_KEY = 'AIzaSyD45ivdJQ9LwYJBctnXPoi8NHGWK2IMhLg';

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
  const { isLoaded } = useJsApiLoader({ id: 'google-map-driver', googleMapsApiKey: GOOGLE_MAPS_API_KEY });

  const doneCount = stops.filter(s => s.done).length;
  const totalPackages = stops.reduce((a, s) => a + s.packages, 0);
  const donePackages = stops.filter(s => s.done).reduce((a, s) => a + s.packages, 0);

  const toggleStop = (id: string) => {
    setStops(prev => prev.map(s => {
      if (s.id !== id) return s;
      const newDone = !s.done;
      toast.success(newDone ? `${s.customer} erledigt ✓` : `${s.customer} wieder offen`);
      return { ...s, done: newDone };
    }));
  };

  const routePath = [driverPosition, ...stops.filter(s => !s.done).map(s => ({ lat: s.lat, lng: s.lng }))];

  return (
    <div className="space-y-4">
      {/* Tour header */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-semibold text-card-foreground">Meine Tour heute</h3>
            <p className="text-xs text-muted-foreground">Tour T-001 · MB Sprinter · B-DI 1001</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Package className="w-3.5 h-3.5" /> {donePackages}/{totalPackages} Pakete
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="w-3.5 h-3.5" /> {doneCount}/{stops.length} Stops
            </span>
          </div>
        </div>
        {/* Progress */}
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-500"
            style={{ width: `${(doneCount / stops.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Stop list */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">Stopps</h4>
          {stops.map((stop, i) => (
            <div
              key={stop.id}
              className={cn(
                'rounded-lg border bg-card p-3 flex items-start gap-3 transition-colors',
                stop.done ? 'border-emerald-200 bg-emerald-50/50' : 'border-border'
              )}
            >
              <button
                onClick={() => toggleStop(stop.id)}
                className="mt-0.5 shrink-0"
                title={stop.done ? 'Als offen markieren' : 'Als erledigt markieren'}
              >
                {stop.done
                  ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  : <Circle className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
                }
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className={cn('text-sm font-medium', stop.done ? 'line-through text-muted-foreground' : 'text-card-foreground')}>
                    {i + 1}. {stop.customer}
                  </p>
                  <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {stop.id}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{stop.address}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{stop.timeWindow}</span>
                  <span className="flex items-center gap-1"><Package className="w-3 h-3" />{stop.packages} Pakete</span>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="shrink-0 h-8 w-8 p-0"
                onClick={() => setSelectedStop(stop)}
              >
                <Navigation className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>

        {/* Live map */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">Live-Standort & Route</h4>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            {!isLoaded ? (
              <div className="aspect-square bg-muted flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Karte wird geladen…</p>
              </div>
            ) : (
              <div className="aspect-square">
                <GoogleMap
                  mapContainerStyle={{ width: '100%', height: '100%' }}
                  center={driverPosition}
                  zoom={13}
                  options={{
                    disableDefaultUI: true,
                    zoomControl: true,
                    fullscreenControl: true,
                    styles: [
                      { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#d4eef7' }] },
                      { featureType: 'landscape', elementType: 'geometry.fill', stylers: [{ color: '#f0f4f0' }] },
                    ],
                  }}
                >
                  {/* Driver position */}
                  <Marker
                    position={driverPosition}
                    icon={{
                      path: google.maps.SymbolPath.CIRCLE,
                      scale: 10,
                      fillColor: '#0d9488',
                      fillOpacity: 1,
                      strokeColor: '#fff',
                      strokeWeight: 3,
                    }}
                    title="Mein Standort"
                  />

                  {/* Stop markers */}
                  {stops.map((stop, i) => (
                    <Marker
                      key={stop.id}
                      position={{ lat: stop.lat, lng: stop.lng }}
                      label={{
                        text: `${i + 1}`,
                        color: '#fff',
                        fontWeight: 'bold',
                        fontSize: '11px',
                      }}
                      opacity={stop.done ? 0.4 : 1}
                      onClick={() => setSelectedStop(stop)}
                    />
                  ))}

                  {/* Route polyline for remaining stops */}
                  {routePath.length > 1 && (
                    <Polyline
                      path={routePath}
                      options={{
                        strokeColor: '#0d9488',
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
                      <div className="text-sm p-1">
                        <p className="font-semibold">{selectedStop.customer}</p>
                        <p className="text-xs text-muted-foreground">{selectedStop.address}</p>
                        <p className="text-xs mt-1">{selectedStop.timeWindow} · {selectedStop.packages} Pakete</p>
                        <p className="text-xs mt-1">{selectedStop.done ? '✅ Erledigt' : '⏳ Offen'}</p>
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
