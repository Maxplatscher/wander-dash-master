import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle2, Circle, MapPin, Package, Clock, Truck, Route } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import { getGoogleMapsApiKey, GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_LOADER_ID } from '@/lib/google-maps';

const GOOGLE_MAPS_API_KEY = getGoogleMapsApiKey();

interface DriverInfo {
  name: string;
  tourId: string;
  tourDescription: string;
  currentLocation: string;
  completedStops: number;
  totalStops: number;
  totalWeight: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver: DriverInfo | null;
  gradientClass: string;
}

function useTourStops(tourId: string | undefined) {
  return useQuery({
    queryKey: ['tour-stops-detail', tourId],
    enabled: !!tourId,
    queryFn: async () => {
      const { data: stops } = await supabase
        .from('tour_stop')
        .select('id, stop_index, driver_completed, driver_completed_at, arrival_time, departure_time, shipment_id, segment_cost')
        .eq('tour_id', tourId!)
        .order('stop_index');

      if (!stops?.length) return [];

      const shipmentIds = stops.map(s => s.shipment_id).filter(Boolean) as string[];
      const { data: shipments } = await supabase
        .from('shipment')
        .select('id, customer_name, delivery_address, weight_kg, window_start, window_end')
        .in('id', shipmentIds);

      const shipmentMap = new Map((shipments ?? []).map(s => [s.id, s]));

      return stops.map(s => {
        const shipment = s.shipment_id ? shipmentMap.get(s.shipment_id) : null;
        return {
          ...s,
          customerName: shipment?.customer_name ?? 'Unbekannt',
          address: shipment?.delivery_address ?? '–',
          weightKg: shipment?.weight_kg ?? 0,
          lat: null as number | null,
          lng: null as number | null,
        };
      });
    },
  });
}

export function DriverDetailDialog({ open, onOpenChange, driver, gradientClass }: Props) {
  const { data: stops, isLoading } = useTourStops(driver?.tourId);
  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_LOADER_ID,
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const completedStops = stops?.filter(s => s.driver_completed) ?? [];
  const nextStop = stops?.find(s => !s.driver_completed);
  const upcomingStops = stops?.filter(s => !s.driver_completed) ?? [];

  // Use Berlin coords as fallback for demo
  const mapCenter = { lat: 52.52, lng: 13.405 };

  if (!driver) return null;

  const progressPercent = driver.totalStops > 0
    ? Math.round((driver.completedStops / driver.totalStops) * 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0">
        {/* Header with gradient */}
        <div className={cn('rounded-t-lg p-6 text-white bg-gradient-to-br', gradientClass)}>
          <DialogHeader>
            <DialogTitle className="text-white text-lg flex items-center gap-2">
              <Truck className="w-5 h-5" />
              {driver.name}
            </DialogTitle>
          </DialogHeader>
          <p className="text-white/80 text-sm mt-1">{driver.tourDescription}</p>
          <div className="flex items-center gap-4 mt-3 text-sm">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> {driver.currentLocation}
            </span>
            <span className="flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" /> {driver.totalWeight} kg
            </span>
          </div>
          {/* Progress */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-white/80 mb-1">
              <span>{driver.completedStops}/{driver.totalStops} Stops erledigt</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white/70 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Live Standort */}
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-primary" /> Live-Standort
            </h3>
            <div className="rounded-lg border overflow-hidden" style={{ height: 200 }}>
              {isLoaded ? (
                <GoogleMap
                  mapContainerStyle={{ width: '100%', height: '100%' }}
                  center={mapCenter}
                  zoom={12}
                  options={{ disableDefaultUI: true, zoomControl: true }}
                >
                  <Marker
                    position={mapCenter}
                    icon={{
                      path: google.maps.SymbolPath.CIRCLE,
                      scale: 10,
                      fillColor: '#0d9488',
                      fillOpacity: 1,
                      strokeColor: '#fff',
                      strokeWeight: 3,
                    }}
                    title={driver.name}
                  />
                </GoogleMap>
              ) : (
                <div className="h-full bg-muted flex items-center justify-center text-sm text-muted-foreground">
                  Karte wird geladen…
                </div>
              )}
            </div>
          </div>

          {/* Erledigte Stops */}
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Erledigte Stops ({completedStops.length})
            </h3>
            {isLoading ? (
              <p className="text-xs text-muted-foreground">Laden…</p>
            ) : completedStops.length === 0 ? (
              <p className="text-xs text-muted-foreground">Noch keine Stops erledigt</p>
            ) : (
              <div className="space-y-1.5">
                {completedStops.map((stop, i) => (
                  <div key={stop.id} className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-2.5 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground line-through opacity-70">{stop.customerName}</p>
                      <p className="text-muted-foreground truncate">{stop.address}</p>
                    </div>
                    <span className="text-muted-foreground">{stop.weightKg} kg</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Aktiver / Nächster Stop */}
          {nextStop && (
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-2">
                <Route className="w-4 h-4 text-primary" /> Nächster Stop
              </h3>
              <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-3">
                <p className="font-semibold text-sm text-foreground">{nextStop.customerName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{nextStop.address}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Package className="w-3 h-3" />{nextStop.weightKg} kg</span>
                </div>
              </div>
            </div>
          )}

          {/* Noch zu fahrende Stops */}
          {upcomingStops.length > 1 && (
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-amber-500" /> Noch zu fahren ({upcomingStops.length - 1})
              </h3>
              <div className="space-y-1.5">
                {upcomingStops.slice(1).map((stop) => (
                  <div key={stop.id} className="flex items-center gap-3 rounded-lg border p-2.5 text-xs">
                    <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground">{stop.customerName}</p>
                      <p className="text-muted-foreground truncate">{stop.address}</p>
                    </div>
                    <span className="text-muted-foreground">{stop.weightKg} kg</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
