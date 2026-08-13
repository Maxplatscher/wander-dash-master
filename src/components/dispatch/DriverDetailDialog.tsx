import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle2, Circle, MapPin, Package, Clock, Truck, Route } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import {
  getCyanSquareMarkerIcon,
  getDarkMapOptions,
  getGoogleMapsApiKey,
  GOOGLE_MAPS_LIBRARIES,
  GOOGLE_MAPS_LOADER_ID,
} from '@/lib/google-maps';

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

      const shipmentIds = stops.map((s) => s.shipment_id).filter(Boolean) as string[];
      const { data: shipments } = await supabase
        .from('shipment')
        .select('id, customer_name, delivery_address, weight_kg, window_start, window_end')
        .in('id', shipmentIds);

      const shipmentMap = new Map((shipments ?? []).map((s) => [s.id, s]));

      return stops.map((s) => {
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

export function DriverDetailDialog({ open, onOpenChange, driver }: Props) {
  const { data: stops, isLoading } = useTourStops(driver?.tourId);
  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_LOADER_ID,
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const completedStops = stops?.filter((s) => s.driver_completed) ?? [];
  const nextStop = stops?.find((s) => !s.driver_completed);
  const upcomingStops = stops?.filter((s) => !s.driver_completed) ?? [];

  // Demo-Fallback — echte Koordinaten eigener Block
  const mapCenter = { lat: 52.52, lng: 13.405 };

  if (!driver) return null;

  const progressPercent =
    driver.totalStops > 0
      ? Math.round((driver.completedStops / driver.totalStops) * 100)
      : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0 border-hairline bg-panel sm:rounded">
        <div className="p-5 border-b border-hairline bg-primary/5">
          <DialogHeader>
            <DialogTitle className="text-foreground text-lg flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" />
              {driver.name}
            </DialogTitle>
          </DialogHeader>
          <p className="text-primary text-sm mt-1">{driver.tourDescription}</p>
          <div className="flex items-center gap-4 mt-3 meta-text">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> {driver.currentLocation}
            </span>
            <span className="flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" /> {driver.totalWeight} kg
            </span>
          </div>
          <div className="mt-4">
            <div className="flex justify-between meta-text mb-1">
              <span>
                {driver.completedStops}/{driver.totalStops} Stops erledigt
              </span>
              <span className="whitespace-nowrap">{progressPercent}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <h3 className="card-title flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-primary" /> Live-Standort
            </h3>
            <div
              className="rounded-sm border border-hairline overflow-hidden bg-[#101012]"
              style={{ height: 200 }}
            >
              {isLoaded ? (
                <GoogleMap
                  mapContainerStyle={{ width: '100%', height: '100%' }}
                  center={mapCenter}
                  zoom={12}
                  options={getDarkMapOptions()}
                >
                  <Marker
                    position={mapCenter}
                    icon={getCyanSquareMarkerIcon()}
                    title={driver.name}
                  />
                </GoogleMap>
              ) : (
                <div className="h-full flex items-center justify-center meta-text">
                  Karte wird geladen…
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="card-title flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-success" /> Erledigte Stops ({completedStops.length})
            </h3>
            {isLoading ? (
              <p className="meta-text">Laden…</p>
            ) : completedStops.length === 0 ? (
              <p className="meta-text">Noch keine Stops erledigt</p>
            ) : (
              <div className="space-y-1.5">
                {completedStops.map((stop) => (
                  <div key={stop.id} className="flex items-center gap-3 sub-card p-2.5 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground line-through opacity-70">
                        {stop.customerName}
                      </p>
                      <p className="text-muted-foreground truncate">{stop.address}</p>
                    </div>
                    <span className="text-muted-foreground whitespace-nowrap">{stop.weightKg} kg</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {nextStop && (
            <div>
              <h3 className="card-title flex items-center gap-2 mb-2">
                <Route className="w-4 h-4 text-primary" /> Nächster Stop
              </h3>
              <div className="rounded-sm border border-primary/30 bg-primary/5 p-3">
                <p className="font-semibold text-sm text-foreground">{nextStop.customerName}</p>
                <p className="meta-text mt-0.5">{nextStop.address}</p>
                <div className="flex items-center gap-3 mt-2 meta-text">
                  <span className="flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    {nextStop.weightKg} kg
                  </span>
                </div>
              </div>
            </div>
          )}

          {upcomingStops.length > 1 && (
            <div>
              <h3 className="card-title flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-warning" /> Noch zu fahren ({upcomingStops.length - 1})
              </h3>
              <div className="space-y-1.5">
                {upcomingStops.slice(1).map((stop) => (
                  <div key={stop.id} className="flex items-center gap-3 sub-card p-2.5 text-xs">
                    <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground">{stop.customerName}</p>
                      <p className="text-muted-foreground truncate">{stop.address}</p>
                    </div>
                    <span className="text-muted-foreground whitespace-nowrap">{stop.weightKg} kg</span>
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
