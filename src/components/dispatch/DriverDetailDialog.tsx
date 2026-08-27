import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  Circle,
  MapPin,
  Package,
  Clock,
  Truck,
  Route,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { generateDriverCode } from "@/lib/driver-pin";
import { DriverCodeRevealDialog } from "@/components/dispatch/DriverCodeRevealDialog";
import { cn } from "@/lib/utils";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import {
  getCyanSquareMarkerIcon,
  getDarkMapOptions,
  getGoogleMapsApiKey,
  getOutlineSquareMarkerIcon,
  GOOGLE_MAPS_LIBRARIES,
  GOOGLE_MAPS_LOADER_ID,
} from "@/lib/google-maps";
import { pickTourAnchor, shipmentCoordinates } from "@/lib/tour-position";

const GOOGLE_MAPS_API_KEY = getGoogleMapsApiKey();

interface DriverInfo {
  id?: string | null;
  name: string;
  tourId: string | null;
  tourDescription: string;
  /** @deprecated Wird nicht angezeigt — die Lage kommt aus dem letzten bestätigten Stop. */
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

function useTourStops(tourId: string | null | undefined) {
  return useQuery({
    queryKey: ["tour-stops-detail", tourId],
    enabled: !!tourId,
    queryFn: async () => {
      const { data: stops } = await supabase
        .from("tour_stop")
        .select(
          "id, stop_index, driver_completed, driver_completed_at, arrival_time, departure_time, shipment_id, segment_cost",
        )
        .eq("tour_id", tourId!)
        .order("stop_index");

      if (!stops?.length) return [];

      const shipmentIds = stops
        .map((s) => s.shipment_id)
        .filter(Boolean) as string[];
      const { data: shipments } = await supabase
        .from("shipment")
        .select(
          "id, customer_name, delivery_address, weight_kg, window_start, window_end, location_x, location_y",
        )
        .in("id", shipmentIds);

      const shipmentMap = new Map((shipments ?? []).map((s) => [s.id, s]));

      return stops.map((s) => {
        const shipment = s.shipment_id ? shipmentMap.get(s.shipment_id) : null;
        return {
          ...s,
          customerName: shipment?.customer_name ?? "Unbekannt",
          address: shipment?.delivery_address ?? "–",
          weightKg: shipment?.weight_kg ?? 0,
          coordinates: shipment
            ? shipmentCoordinates(shipment.location_x, shipment.location_y)
            : null,
        };
      });
    },
  });
}

export function DriverDetailDialog({ open, onOpenChange, driver }: Props) {
  const queryClient = useQueryClient();
  const [regenerating, setRegenerating] = useState(false);
  const [reveal, setReveal] = useState<{ driverName: string; code: string }[] | null>(null);
  const { data: stops, isLoading } = useTourStops(driver?.tourId);
  const { data: codeSetAt } = useQuery({
    queryKey: ["driver-login-code-flag", driver?.id],
    enabled: open && !!driver?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("driver")
        .select("login_code_set_at")
        .eq("id", driver!.id!)
        .maybeSingle();
      return data?.login_code_set_at ?? null;
    },
  });
  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_LOADER_ID,
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const completedStops = stops?.filter((s) => s.driver_completed) ?? [];
  const nextStop = stops?.find((s) => !s.driver_completed);
  const upcomingStops = stops?.filter((s) => !s.driver_completed) ?? [];

  const anchor = useMemo(
    () =>
      pickTourAnchor(
        (stops ?? []).map((s, index) => ({
          id: s.id,
          stopNumber: s.stop_index ?? index + 1,
          confirmed: s.driver_completed === true,
          confirmedAt: s.driver_completed_at,
          customer: s.customerName,
          address: s.address,
          coordinates: s.coordinates,
        })),
      ),
    [stops],
  );

  if (!driver) return null;

  const handleRegenerateCode = async () => {
    if (!driver.id || regenerating) return;
    if (
      !window.confirm(
        "Alter Code wird sofort ungültig. Neuen Code erzeugen und einmalig anzeigen?",
      )
    ) {
      return;
    }
    setRegenerating(true);
    try {
      const generated = await generateDriverCode(driver.id);
      if (!generated.success || !generated.code) {
        throw new Error(generated.error ?? "Code konnte nicht erzeugt werden.");
      }
      setReveal([{ driverName: driver.name, code: generated.code }]);
      await queryClient.invalidateQueries({
        queryKey: ["driver-login-code-flag", driver.id],
      });
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Code nicht erzeugt");
    } finally {
      setRegenerating(false);
    }
  };

  const progressPercent =
    driver.totalStops > 0
      ? Math.round((driver.completedStops / driver.totalStops) * 100)
      : 0;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0 border-hairline bg-panel sm:rounded">
        <div className="p-5 border-b border-hairline bg-primary/5">
          <DialogHeader>
            <DialogTitle className="text-foreground text-lg flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" />
              {driver.name}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="text-primary text-sm">{driver.tourDescription}</p>
            {driver.id ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="ml-auto h-8 rounded"
                disabled={regenerating}
                onClick={() => void handleRegenerateCode()}
              >
                <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                {regenerating ? "Code wird erzeugt…" : "Code neu generieren"}
              </Button>
            ) : null}
          </div>
          {driver.id ? (
            <p className="meta-text mt-1">
              {codeSetAt
                ? "Login-Code gesetzt — Klartext wird nur bei Neu-Generieren gezeigt."
                : "Noch kein Login-Code. Bitte erzeugen und dem Fahrer mitteilen."}
            </p>
          ) : null}
          <div className="flex items-center gap-4 mt-3 meta-text">
            <span className="flex items-center gap-1.5 min-w-0">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {completedStops.length > 0
                  ? `Zuletzt bestätigt: ${completedStops[completedStops.length - 1].customerName}`
                  : "Noch kein Stop bestätigt"}
              </span>
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
              <div
                className="progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {driver.tourId && (
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="card-title flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" /> Tourposition
                </h3>
                <span className="rounded-sm border border-hairline px-1.5 py-0.5 meta-text text-dim">
                  Keine GPS-Ortung
                </span>
              </div>
              <div
                className="rounded-sm border border-hairline overflow-hidden bg-[#101012]"
                style={{ height: 200 }}
              >
                {!anchor ? (
                  <div className="h-full flex items-center justify-center p-6 text-center">
                    <p className="meta-text max-w-[42ch]">
                      Zu den Lieferadressen dieser Tour sind keine Koordinaten hinterlegt — die
                      Adressen wurden noch nicht geokodiert.
                    </p>
                  </div>
                ) : isLoaded ? (
                  <GoogleMap
                    mapContainerStyle={{ width: "100%", height: "100%" }}
                    center={anchor.coordinates}
                    zoom={12}
                    options={getDarkMapOptions()}
                  >
                    <Marker
                      position={anchor.coordinates}
                      icon={
                        anchor.kind === "confirmed"
                          ? getCyanSquareMarkerIcon()
                          : getOutlineSquareMarkerIcon()
                      }
                      title={`${driver.name} · Stop ${anchor.stop.stopNumber}`}
                    />
                  </GoogleMap>
                ) : (
                  <div className="h-full flex items-center justify-center meta-text">
                    Karte wird geladen…
                  </div>
                )}
              </div>
              <p className="meta-text mt-1.5">
                {anchor
                  ? anchor.kind === "confirmed"
                    ? `Stop ${anchor.stop.stopNumber} bestätigt${
                        anchor.stop.confirmedAt
                          ? ` um ${new Date(anchor.stop.confirmedAt).toLocaleTimeString("de-DE", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}`
                          : ""
                      } · ${anchor.stop.address ?? anchor.stop.customer}`
                    : `Stop ${anchor.stop.stopNumber} disponiert, noch nicht bestätigt · ${
                        anchor.stop.address ?? anchor.stop.customer
                      }`
                  : "Position aus bestätigten Stops nicht ableitbar"}
              </p>
            </div>
          )}

          <div>
            <h3 className="card-title flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-success" /> Erledigte Stops
              ({completedStops.length})
            </h3>
            {isLoading ? (
              <p className="meta-text">Laden…</p>
            ) : completedStops.length === 0 ? (
              <p className="meta-text">Noch keine Stops erledigt</p>
            ) : (
              <div className="space-y-1.5">
                {completedStops.map((stop) => (
                  <div
                    key={stop.id}
                    className="flex items-center gap-3 sub-card p-2.5 text-xs"
                  >
                    <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground line-through opacity-70">
                        {stop.customerName}
                      </p>
                      <p className="text-muted-foreground truncate">
                        {stop.address}
                      </p>
                    </div>
                    <span className="text-muted-foreground whitespace-nowrap">
                      {stop.weightKg} kg
                    </span>
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
                <p className="font-semibold text-sm text-foreground">
                  {nextStop.customerName}
                </p>
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
                <Clock className="w-4 h-4 text-warning" /> Noch zu fahren (
                {upcomingStops.length - 1})
              </h3>
              <div className="space-y-1.5">
                {upcomingStops.slice(1).map((stop) => (
                  <div
                    key={stop.id}
                    className="flex items-center gap-3 sub-card p-2.5 text-xs"
                  >
                    <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground">
                        {stop.customerName}
                      </p>
                      <p className="text-muted-foreground truncate">
                        {stop.address}
                      </p>
                    </div>
                    <span className="text-muted-foreground whitespace-nowrap">
                      {stop.weightKg} kg
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
    <DriverCodeRevealDialog
      open={!!reveal?.length}
      entries={reveal ?? []}
      onClose={() => setReveal(null)}
    />
    </>
  );
}
