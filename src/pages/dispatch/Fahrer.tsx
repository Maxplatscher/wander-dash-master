import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDispatch } from "@/lib/dispatch-context";
import { AddDriverDialog } from "@/components/dispatch/AddDriverDialog";
import { DriverDetailDialog } from "@/components/dispatch/DriverDetailDialog";
import { DriverTourView } from "@/components/dispatch/DriverTourView";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface FleetCard {
  id: string;
  name: string;
  phone: string;
  status: "aktiv" | "verfügbar" | "abwesend";
  shiftStart: string;
  shiftEnd: string;
  vehicleName: string;
  capacity: number;
  weight: number;
  util: number;
  tourId: string | null;
  tourLabel: string | null;
  stopsDone: number;
  stopsTotal: number;
  progress: number;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function normalizeStatus(
  status: string | null | undefined,
): "aktiv" | "verfügbar" | "abwesend" {
  const s = (status ?? "").toLowerCase();
  if (s.includes("abwesend") || s.includes("krank") || s === "inactive")
    return "abwesend";
  if (s === "active" || s === "aktiv") return "aktiv";
  return "verfügbar";
}

const STATUS_STYLE: Record<string, { badge: string; tile: string }> = {
  aktiv: {
    badge: "bg-success/15 text-success",
    tile: "bg-success/15 text-success",
  },
  verfügbar: {
    badge: "bg-primary/15 text-primary",
    tile: "bg-primary/15 text-primary",
  },
  abwesend: {
    badge: "bg-danger/15 text-danger",
    tile: "bg-danger/15 text-danger",
  },
};

function fmtDate(d: Date) {
  return d.toISOString().split("T")[0];
}

function useFleetCards(companyId: string | null, date: string) {
  return useQuery({
    queryKey: ["drivers", companyId, date],
    enabled: !!companyId,
    queryFn: async () => {
      const cid = companyId!;
      const [driversRes, vehiclesRes, toursRes] = await Promise.all([
        supabase
          .from("driver")
          .select(
            "id, name, phone, status, shift_start, shift_end, assigned_vehicle_id",
          )
          .eq("company_id", cid)
          .order("name"),
        supabase
          .from("vehicle")
          .select("id, name, capacity")
          .eq("company_id", cid),
        supabase
          .from("tour")
          .select("id, description, is_active")
          .eq("date", date)
          .eq("is_active", true),
      ]);

      const drivers = driversRes.data ?? [];
      const vehicles = vehiclesRes.data ?? [];
      const tours = toursRes.data ?? [];
      const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));
      const tourIds = tours.map((t) => t.id);

      let stops: {
        tour_id: string;
        shipment_id: string | null;
        vehicle_id: string | null;
        driver_completed: boolean | null;
      }[] = [];
      let shipmentWeights = new Map<string, number>();

      if (tourIds.length > 0) {
        const { data: stopData } = await supabase
          .from("tour_stop")
          .select("tour_id, shipment_id, vehicle_id, driver_completed")
          .in("tour_id", tourIds);
        stops = stopData ?? [];
        const shipmentIds = stops
          .map((s) => s.shipment_id)
          .filter(Boolean) as string[];
        if (shipmentIds.length > 0) {
          const { data: shipments } = await supabase
            .from("shipment")
            .select("id, weight_kg")
            .in("id", shipmentIds);
          shipmentWeights = new Map(
            (shipments ?? []).map((s) => [s.id, s.weight_kg ?? 0]),
          );
        }
      }

      const cards: FleetCard[] = drivers.map((driver, idx) => {
        const status = normalizeStatus(driver.status);
        const vehicle = driver.assigned_vehicle_id
          ? vehicleMap.get(driver.assigned_vehicle_id)
          : null;

        // Tour-Zuordnung: Fahrzeug-Match, sonst Index-Fallback wie Startseite
        let tour = tours.find((t) =>
          stops.some(
            (s) =>
              s.tour_id === t.id &&
              driver.assigned_vehicle_id &&
              s.vehicle_id === driver.assigned_vehicle_id,
          ),
        );
        if (!tour && idx < tours.length) tour = tours[idx];

        const tourStops = tour
          ? stops.filter((s) => s.tour_id === tour!.id)
          : [];
        const done = tourStops.filter((s) => s.driver_completed).length;
        const total = tourStops.length;
        const weight = tourStops.reduce(
          (sum, s) =>
            sum +
            (s.shipment_id ? (shipmentWeights.get(s.shipment_id) ?? 0) : 0),
          0,
        );
        const capacity = vehicle?.capacity ?? 0;
        const util =
          capacity > 0
            ? Math.min(100, Math.round((weight / capacity) * 100))
            : 0;

        return {
          id: driver.id,
          name: driver.name ?? "Fahrer",
          phone: driver.phone || "—",
          status,
          shiftStart: driver.shift_start?.slice(0, 5) || "—",
          shiftEnd: driver.shift_end?.slice(0, 5) || "—",
          vehicleName: vehicle?.name ?? "—",
          capacity,
          weight,
          util,
          tourId: tour?.id ?? null,
          tourLabel:
            tour?.description ?? (tour ? `Tour-${tour.id.slice(0, 4)}` : null),
          stopsDone: done,
          stopsTotal: total,
          progress: total > 0 ? Math.round((done / total) * 100) : 0,
        };
      });
      return { cards, vehicleCount: vehicles.length };
    },
  });
}

export function Fahrer() {
  const { role, companyId, selectedDate } = useDispatch();
  const dateStr = fmtDate(selectedDate);
  const { data: fleet, isLoading } = useFleetCards(companyId, dateStr);
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<FleetCard | null>(null);
  const cards = fleet?.cards;

  if (role === "driver") {
    return <DriverTourView />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end gap-5">
        <div>
          <p className="section-title">Fahrer & Fahrzeuge</p>
          <h2 className="page-title mt-1">
            {cards?.length ?? 0} Fahrer · {fleet?.vehicleCount ?? 0} Fahrzeuge
          </h2>
          <p className="meta-text mt-1">
            {selectedDate.toLocaleDateString("de-DE", {
              weekday: "long",
              day: "2-digit",
              month: "long",
            })}
          </p>
        </div>
        <Button
          className="ml-auto rounded"
          onClick={() => setShowAddDriver(true)}
        >
          <Plus className="w-4 h-4" />
          Fahrer hinzufügen
        </Button>
      </div>

      {isLoading || !companyId ? (
        <div className="glass-card flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : !cards?.length ? (
        <div className="glass-card p-8 text-center meta-text">
          Noch keine Fahrer angelegt — im Onboarding oder unter Lieferscheine
          ergänzen.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((d) => {
            const style = STATUS_STYLE[d.status];
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelectedDriver(d)}
                className="glass-card p-4 flex flex-col text-left transition-colors hover:bg-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "w-10 h-10 shrink-0 rounded flex items-center justify-center text-sm font-semibold",
                      style.tile,
                    )}
                  >
                    {initials(d.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-foreground truncate">
                      {d.name}
                    </p>
                    <p className="text-[11.5px] text-muted-foreground truncate">
                      {d.phone}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 px-1.5 py-0.5 text-[10.5px] font-semibold rounded-sm",
                      style.badge,
                    )}
                  >
                    {d.status}
                  </span>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-primary truncate">
                      {d.tourLabel ?? "Keine Tour"}
                    </p>
                    <span className="meta-text whitespace-nowrap shrink-0">
                      {d.stopsDone} / {d.stopsTotal} Stopps
                    </span>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${d.progress}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-hairline grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-dim font-semibold">
                      Schicht
                    </p>
                    <p className="text-sm text-foreground mt-0.5 whitespace-nowrap">
                      {d.shiftStart}–{d.shiftEnd}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-dim font-semibold">
                      Auslastung
                    </p>
                    <p className="text-sm text-foreground mt-0.5 whitespace-nowrap">
                      {d.weight} / {d.capacity || "—"} kg
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] uppercase tracking-wide text-dim font-semibold">
                      Fahrzeug
                    </p>
                    <p className="text-sm text-foreground mt-0.5 truncate">
                      {d.vehicleName}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <AddDriverDialog open={showAddDriver} onOpenChange={setShowAddDriver} />

      <DriverDetailDialog
        open={!!selectedDriver}
        onOpenChange={(open) => {
          if (!open) setSelectedDriver(null);
        }}
        driver={
          selectedDriver
            ? {
                name: selectedDriver.name,
                tourId: selectedDriver.tourId,
                tourDescription:
                  selectedDriver.tourLabel ?? "Keine aktive Tour",
                currentLocation: selectedDriver.tourId ? "Auf Tour" : "Depot",
                completedStops: selectedDriver.stopsDone,
                totalStops: selectedDriver.stopsTotal,
                totalWeight: selectedDriver.weight,
              }
            : null
        }
        gradientClass="from-primary/20 to-transparent"
      />
    </div>
  );
}
