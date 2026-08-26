import { useState } from "react";
import {
  GoogleMap,
  InfoWindow,
  Marker,
  Polyline,
  useJsApiLoader,
} from "@react-google-maps/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  MapPin,
  Navigation,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  getDarkMapOptions,
  getGoogleMapsApiKey,
  GOOGLE_MAPS_LIBRARIES,
  GOOGLE_MAPS_LOADER_ID,
} from "@/lib/google-maps";
import { shipmentCoordinates } from "@/lib/tour-position";
import { formatGpsAge } from "@/lib/driver-gps";
import { formatDateLabel } from "@/lib/date-input";
import { useDriverGpsShare } from "@/hooks/useDriverGpsShare";
import {
  acknowledgeDriverGpsConsent,
  DRIVER_GPS_LEGAL_TEXT,
  hasAcknowledgedDriverGpsConsent,
} from "@/lib/gps-consent";

const GOOGLE_MAPS_API_KEY = getGoogleMapsApiKey();

type DriverTourStop = {
  id: string;
  done: boolean;
  completedAt: string | null;
  customer: string;
  address: string | null;
  weightKg: number | null;
  windowStart: string | null;
  windowEnd: string | null;
  coordinates: { lat: number; lng: number } | null;
  vehicleName: string | null;
};

type DriverTourResult =
  | { kind: "unassigned" }
  | { kind: "no-tour" }
  | {
      kind: "tour";
      tour: {
        id: string;
        description: string | null;
        date: string;
      };
      stops: DriverTourStop[];
    };

export interface DriverTourViewProps {
  selectedDate: Date;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTimeWindow(start: string | null, end: string | null): string {
  const format = (value: string | null) =>
    value
      ? new Date(value).toLocaleTimeString("de-DE", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;
  const startLabel = format(start);
  const endLabel = format(end);
  if (startLabel && endLabel) return `${startLabel}–${endLabel}`;
  return startLabel ?? endLabel ?? "Kein Zeitfenster";
}

async function loadDriverTour(date: string): Promise<DriverTourResult> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw new Error(`Anmeldung konnte nicht geprüft werden: ${authError.message}`);
  if (!user) throw new Error("Keine aktive Anmeldung gefunden.");

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("driver_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) throw new Error(`Fahrerzuordnung konnte nicht geladen werden: ${profileError.message}`);
  if (!profile?.driver_id) return { kind: "unassigned" };

  const { data: tour, error: tourError } = await supabase
    .from("tour")
    .select("id, description, date")
    .eq("driver_id", profile.driver_id)
    .eq("date", date)
    .eq("is_active", true)
    .maybeSingle();

  if (tourError) throw new Error(`Tour konnte nicht geladen werden: ${tourError.message}`);
  if (!tour || !tour.date) return { kind: "no-tour" };

  const { data: stopRows, error: stopsError } = await supabase
    .from("tour_stop")
    .select(
      "id, stop_index, shipment_id, vehicle_id, driver_completed, driver_completed_at",
    )
    .eq("tour_id", tour.id)
    .order("stop_index", { ascending: true });

  if (stopsError) throw new Error(`Stops konnten nicht geladen werden: ${stopsError.message}`);

  const shipmentIds = [
    ...new Set((stopRows ?? []).flatMap((stop) => (stop.shipment_id ? [stop.shipment_id] : []))),
  ];
  const vehicleIds = [
    ...new Set((stopRows ?? []).flatMap((stop) => (stop.vehicle_id ? [stop.vehicle_id] : []))),
  ];

  const [shipmentsResult, vehiclesResult] = await Promise.all([
    shipmentIds.length
      ? supabase
          .from("shipment")
          .select(
            "id, customer_name, name, delivery_address, weight_kg, window_start, window_end, location_x, location_y",
          )
          .in("id", shipmentIds)
      : Promise.resolve({ data: [], error: null }),
    vehicleIds.length
      ? supabase.from("vehicle").select("id, name").in("id", vehicleIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (shipmentsResult.error) {
    throw new Error(`Sendungsdaten konnten nicht geladen werden: ${shipmentsResult.error.message}`);
  }
  if (vehiclesResult.error) {
    throw new Error(`Fahrzeugdaten konnten nicht geladen werden: ${vehiclesResult.error.message}`);
  }

  const shipments = new Map((shipmentsResult.data ?? []).map((shipment) => [shipment.id, shipment]));
  const vehicles = new Map((vehiclesResult.data ?? []).map((vehicle) => [vehicle.id, vehicle]));

  return {
    kind: "tour",
    tour: {
      id: tour.id,
      description: tour.description,
      date: tour.date,
    },
    stops: (stopRows ?? []).map((stop) => {
      const shipment = stop.shipment_id ? shipments.get(stop.shipment_id) : null;
      const vehicle = stop.vehicle_id ? vehicles.get(stop.vehicle_id) : null;
      return {
        id: stop.id,
        done: stop.driver_completed === true,
        completedAt: stop.driver_completed_at,
        customer: shipment?.customer_name ?? shipment?.name ?? "Kunde nicht hinterlegt",
        address: shipment?.delivery_address ?? null,
        weightKg: shipment?.weight_kg ?? null,
        windowStart: shipment?.window_start ?? null,
        windowEnd: shipment?.window_end ?? null,
        coordinates: shipment
          ? shipmentCoordinates(shipment.location_x, shipment.location_y)
          : null,
        vehicleName: vehicle?.name ?? null,
      };
    }),
  };
}

export function DriverTourView({ selectedDate }: DriverTourViewProps) {
  const date = formatLocalDate(selectedDate);
  const queryClient = useQueryClient();
  const [selectedStop, setSelectedStop] = useState<DriverTourStop | null>(null);
  const { isLoaded, loadError } = useJsApiLoader({
    id: GOOGLE_MAPS_LOADER_ID,
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });
  const tourQuery = useQuery({
    queryKey: ["driver-tour", date],
    queryFn: () => loadDriverTour(date),
  });
  const completion = useMutation({
    mutationFn: async (tourStopId: string) => {
      const { data, error } = await supabase.rpc("complete_my_tour_stop", {
        p_tour_stop_id: tourStopId,
      });
      if (error) throw new Error(error.message);
      if (!data?.length) throw new Error("Der Stop wurde nicht bestätigt.");
      return data[0];
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["driver-tour", date] });
      toast.success("Stop dauerhaft als erledigt gespeichert.");
    },
    onError: (error) => {
      toast.error(`Stop konnte nicht abgeschlossen werden: ${error.message}`);
    },
  });
  const activeTour = tourQuery.data?.kind === "tour" ? tourQuery.data.tour : null;
  const gpsShare = useDriverGpsShare(activeTour?.id ?? null, activeTour !== null);
  const [gpsConsentOpen, setGpsConsentOpen] = useState(false);

  const requestGpsShare = () => {
    if (gpsShare.sharing) {
      gpsShare.stop();
      return;
    }
    if (!hasAcknowledgedDriverGpsConsent()) {
      setGpsConsentOpen(true);
      return;
    }
    void gpsShare.start();
  };

  const confirmGpsShare = () => {
    acknowledgeDriverGpsConsent();
    setGpsConsentOpen(false);
    void gpsShare.start();
  };

  if (tourQuery.isLoading) {
    return (
      <div className="glass-card flex items-center justify-center gap-2 py-16 meta-text">
        <Loader2 className="h-5 w-5 animate-spin" />
        Tour wird geladen…
      </div>
    );
  }

  if (tourQuery.isError) {
    return (
      <div role="alert" className="glass-card p-8 text-center">
        <AlertCircle className="mx-auto h-6 w-6 text-danger" />
        <p className="card-title mt-3">Tour konnte nicht geladen werden</p>
        <p className="meta-text mt-1">{tourQuery.error.message}</p>
        <Button className="mt-4" variant="outline" onClick={() => tourQuery.refetch()}>
          Erneut versuchen
        </Button>
      </div>
    );
  }

  const result = tourQuery.data;
  if (!result || result.kind === "unassigned") {
    return (
      <div className="glass-card p-8 text-center">
        <p className="card-title">Keine Fahrerzuordnung</p>
        <p className="meta-text mt-1">
          Dein Benutzerkonto ist noch keinem Fahrerprofil zugeordnet.
        </p>
      </div>
    );
  }

  if (result.kind === "no-tour") {
    return (
      <div className="glass-card p-8 text-center">
        <p className="card-title">Keine aktive Tour</p>
        <p className="meta-text mt-1">
          Für den {formatDateLabel(selectedDate)} ist dir keine aktive Tour zugeordnet.
        </p>
      </div>
    );
  }

  const { tour, stops } = result;
  const doneCount = stops.filter((stop) => stop.done).length;
  const totalWeight = stops.reduce((sum, stop) => sum + (stop.weightKg ?? 0), 0);
  const doneWeight = stops
    .filter((stop) => stop.done)
    .reduce((sum, stop) => sum + (stop.weightKg ?? 0), 0);
  const mappedStops = stops.filter((stop) => stop.coordinates !== null);
  const routePath = mappedStops.flatMap((stop) =>
    stop.coordinates ? [stop.coordinates] : [],
  );
  const vehicleNames = [...new Set(stops.flatMap((stop) => (stop.vehicleName ? [stop.vehicleName] : [])))];
  const allDone = stops.length > 0 && doneCount === stops.length;

  return (
    <div className="space-y-4">
      <div className="glass-card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="section-title">Meine Tour</p>
            <h3 className="card-title mt-1">
              {formatDateLabel(selectedDate, {
                weekday: "long",
                day: "2-digit",
                month: "long",
              })}
            </h3>
            <p className="meta-text mt-0.5">
              {tour.description ?? `Tour ${tour.id.slice(0, 8)}`}
              {vehicleNames.length ? ` · ${vehicleNames.join(", ")}` : ""}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-3 meta-text">
              <span className="flex items-center gap-1">
                <Package className="h-3.5 w-3.5" /> {doneWeight}/{totalWeight} kg
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {doneCount}/{stops.length} Stops
              </span>
            </div>
            <Button
              type="button"
              size="sm"
              variant={gpsShare.sharing ? "outline" : "default"}
              className="h-7 rounded text-xs"
              onClick={requestGpsShare}
            >
              {gpsShare.sharing ? "Standort stoppen" : "Standort teilen"}
            </Button>
          </div>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${stops.length ? (doneCount / stops.length) * 100 : 0}%` }}
          />
        </div>
        <p className="meta-text mt-2">
          {gpsShare.sharing
            ? `GPS aktiv${gpsShare.lastAt ? ` · zuletzt ${formatGpsAge(gpsShare.lastAt)}` : ""}`
            : "GPS aus — Disposition sieht nur Stop-Lagen, keine Live-Position."}
          {gpsShare.error ? ` · ${gpsShare.error}` : ""}
        </p>
        <p className="meta-text mt-2 max-w-2xl leading-relaxed">{DRIVER_GPS_LEGAL_TEXT}</p>
      </div>

      <Dialog open={gpsConsentOpen} onOpenChange={setGpsConsentOpen}>
        <DialogContent className="max-w-md rounded-sm border-hairline bg-panel">
          <DialogHeader>
            <DialogTitle>Standort mit der Disposition teilen</DialogTitle>
            <DialogDescription className="leading-relaxed">
              {DRIVER_GPS_LEGAL_TEXT}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="rounded" onClick={() => setGpsConsentOpen(false)}>
              Ablehnen
            </Button>
            <Button type="button" className="rounded" onClick={confirmGpsShare}>
              Einwilligen und teilen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {stops.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <p className="card-title">Tour ohne Stops</p>
          <p className="meta-text mt-1">Dieser Tour wurden noch keine Stops zugeordnet.</p>
        </div>
      ) : (
        <>
          {allDone && (
            <div className="glass-card border-success/30 p-4 text-center">
              <CheckCircle2 className="mx-auto h-6 w-6 text-success" />
              <p className="card-title mt-2">Tour vollständig erledigt</p>
              <p className="meta-text mt-1">Alle Stops wurden dauerhaft abgeschlossen.</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <p className="card-title">Stops</p>
              {stops.map((stop, index) => (
                <div
                  key={stop.id}
                  className={cn("sub-card flex items-start gap-3 p-3", stop.done && "opacity-70")}
                >
                  <button
                    type="button"
                    onClick={() => completion.mutate(stop.id)}
                    disabled={stop.done || completion.isPending}
                    className="mt-0.5 shrink-0 disabled:cursor-not-allowed"
                    title={stop.done ? "Dauerhaft erledigt" : "Als erledigt speichern"}
                  >
                    {completion.isPending && completion.variables === stop.id ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    ) : stop.done ? (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground transition-colors hover:text-primary" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={cn(
                          "text-sm font-medium",
                          stop.done ? "text-muted-foreground line-through" : "text-foreground",
                        )}
                      >
                        {index + 1}. {stop.customer}
                      </p>
                      <span className="rounded-sm border border-hairline bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10.5px] text-dim">
                        {stop.id.slice(0, 8)}
                      </span>
                    </div>
                    <p className="meta-text mt-0.5 truncate">
                      {stop.address ?? "Keine Lieferadresse hinterlegt"}
                    </p>
                    <div className="meta-text mt-1 flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTimeWindow(stop.windowStart, stop.windowEnd)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        {stop.weightKg === null ? "Gewicht fehlt" : `${stop.weightKg} kg`}
                      </span>
                      {stop.completedAt && (
                        <span>
                          Erledigt{" "}
                          {new Date(stop.completedAt).toLocaleTimeString("de-DE", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 rounded p-0"
                    disabled={!stop.coordinates}
                    title={stop.coordinates ? "Auf Karte anzeigen" : "Keine Koordinaten hinterlegt"}
                    onClick={() => setSelectedStop(stop)}
                  >
                    <Navigation className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <p className="card-title">Tourposition & Route</p>
              <div className="overflow-hidden rounded-sm border border-hairline bg-[#101012]">
                {mappedStops.length === 0 ? (
                  <div className="flex aspect-square items-center justify-center p-8 text-center">
                    <p className="meta-text max-w-[42ch]">
                      Zu den Lieferadressen dieser Tour sind keine Koordinaten hinterlegt — die
                      Adressen wurden noch nicht geokodiert. Die Stops stehen vollständig in der
                      Liste.
                    </p>
                  </div>
                ) : loadError ? (
                  <div className="flex aspect-square items-center justify-center p-8 text-center">
                    <p className="meta-text">Die Karte konnte nicht geladen werden.</p>
                  </div>
                ) : !isLoaded ? (
                  <div className="flex aspect-square items-center justify-center">
                    <p className="meta-text">Karte wird geladen…</p>
                  </div>
                ) : (
                  <div className="aspect-square">
                    <GoogleMap
                      mapContainerStyle={{ width: "100%", height: "100%" }}
                      center={mappedStops[0].coordinates!}
                      zoom={13}
                      options={getDarkMapOptions()}
                    >
                      {mappedStops.map((stop, index) => (
                        <Marker
                          key={stop.id}
                          position={stop.coordinates!}
                          label={{
                            text: `${index + 1}`,
                            color: "#0d0d0f",
                            fontWeight: "600",
                            fontSize: "11px",
                          }}
                          opacity={stop.done ? 0.4 : 1}
                          onClick={() => setSelectedStop(stop)}
                        />
                      ))}
                      {routePath.length > 1 && (
                        <Polyline
                          path={routePath}
                          options={{
                            strokeColor: "#7ce8f5",
                            strokeOpacity: 0.7,
                            strokeWeight: 3,
                          }}
                        />
                      )}
                      {selectedStop?.coordinates && (
                        <InfoWindow
                          position={selectedStop.coordinates}
                          onCloseClick={() => setSelectedStop(null)}
                        >
                          <div className="p-1 text-sm text-[#0d0d0f]">
                            <p className="font-semibold">{selectedStop.customer}</p>
                            <p className="text-xs opacity-70">
                              {selectedStop.address ?? "Keine Lieferadresse hinterlegt"}
                            </p>
                            <p className="mt-1 text-xs">
                              {formatTimeWindow(selectedStop.windowStart, selectedStop.windowEnd)}
                              {" · "}
                              {selectedStop.weightKg === null
                                ? "Gewicht fehlt"
                                : `${selectedStop.weightKg} kg`}
                            </p>
                            <p className="mt-1 text-xs">
                              {selectedStop.done ? "Erledigt" : "Offen"}
                            </p>
                          </div>
                        </InfoWindow>
                      )}
                    </GoogleMap>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
