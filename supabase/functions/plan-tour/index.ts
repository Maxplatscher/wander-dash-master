import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ShipmentRow {
  id: string;
  weight_kg: number | null;
  demand: number | null;
  location_x: number | null;
  location_y: number | null;
  window_start: string | null;
  window_end: string | null;
}

interface Shipment {
  id: string;
  load: number;
  location_x: number;
  location_y: number;
  window_start: string | null;
  window_end: string | null;
}

interface Vehicle {
  id: string;
  capacity: number;
  name: string;
}

function manhattan(a: { location_x: number; location_y: number }, b: { location_x: number; location_y: number }): number {
  return Math.abs(a.location_x - b.location_x) * 111_000 + Math.abs(a.location_y - b.location_y) * 111_000 * Math.cos((a.location_x * Math.PI) / 180);
}

function normalizeShipments(rows: ShipmentRow[]): Shipment[] {
  return rows.map((row) => ({
    id: row.id,
    load: Math.max(row.weight_kg ?? row.demand ?? 1, 0),
    location_x: row.location_x ?? 0,
    location_y: row.location_y ?? 0,
    window_start: row.window_start,
    window_end: row.window_end,
  }));
}

function greedyPlan(shipments: Shipment[], vehicles: Vehicle[]): { vehicleId: string; stops: { shipmentId: string; index: number }[]; cost: number }[] {
  const unassigned = [...shipments].sort((a, b) => b.load - a.load);
  const tours: { vehicleId: string; stops: { shipmentId: string; index: number }[]; cost: number }[] = [];

  const depot = {
    location_x: shipments.reduce((sum, shipment) => sum + shipment.location_x, 0) / shipments.length,
    location_y: shipments.reduce((sum, shipment) => sum + shipment.location_y, 0) / shipments.length,
  };

  for (const vehicle of [...vehicles].sort((a, b) => b.capacity - a.capacity)) {
    if (unassigned.length === 0) break;

    let remaining = vehicle.capacity;
    let current = depot;
    const stops: { shipmentId: string; index: number }[] = [];
    let totalCost = 0;

    while (unassigned.length > 0) {
      let bestIdx = -1;
      let bestDist = Infinity;

      for (let i = 0; i < unassigned.length; i++) {
        const shipment = unassigned[i];
        const distance = manhattan(current, shipment);
        if (shipment.load <= remaining && distance < bestDist) {
          bestDist = distance;
          bestIdx = i;
        }
      }

      if (bestIdx === -1) break;

      const chosen = unassigned.splice(bestIdx, 1)[0];
      remaining -= chosen.load;
      totalCost += bestDist;
      stops.push({ shipmentId: chosen.id, index: stops.length });
      current = { location_x: chosen.location_x, location_y: chosen.location_y };
    }

    if (stops.length > 0) {
      totalCost += manhattan(current, depot);
      tours.push({ vehicleId: vehicle.id, stops, cost: totalCost });
    }
  }

  return tours;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    let company_id = body.company_id as string | undefined;
    const date = (body.date as string) || new Date().toISOString().split("T")[0];
    const auto_activate = body.auto_activate !== false;
    const force_replan = body.force_replan === true;
    const exclude_shipment_ids = (body.exclude_shipment_ids as string[]) ?? [];

    if (!company_id) {
      const authHeader = req.headers.get("authorization");
      if (authHeader) {
        const userClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: cid } = await userClient.rpc("get_user_company_id");
        if (cid) company_id = cid as string;
      }
    }

    if (!company_id) {
      return new Response(JSON.stringify({ error: "company_id required (provide in body or sign in)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let { data: shipmentRows, error: shipmentError } = await supabase
      .from("shipment")
      .select("id, weight_kg, demand, location_x, location_y, window_start, window_end")
      .eq("company_id", company_id)
      .eq("service_date", date);

    if (shipmentError) throw shipmentError;

    if (exclude_shipment_ids.length > 0 && shipmentRows) {
      shipmentRows = shipmentRows.filter((shipment) => !exclude_shipment_ids.includes(shipment.id));
    }

    const shipments = normalizeShipments((shipmentRows ?? []) as ShipmentRow[]);

    if (shipments.length === 0) {
      return new Response(JSON.stringify({ error: "No shipments for this date" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: vehicleRows, error: vehicleError } = await supabase
      .from("vehicle")
      .select("id, capacity, name")
      .eq("company_id", company_id);

    if (vehicleError) throw vehicleError;

    const vehicles: Vehicle[] = (vehicleRows ?? [])
      .map((vehicle) => ({
        id: vehicle.id,
        capacity: vehicle.capacity ?? 0,
        name: vehicle.name ?? "Fahrzeug",
      }))
      .filter((vehicle) => vehicle.capacity > 0)
      .sort((a, b) => b.capacity - a.capacity);

    if (vehicles.length === 0) {
      return new Response(JSON.stringify({ error: "No vehicles with capacity available", manual_required: true }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const maxVehicleCapacity = Math.max(...vehicles.map((vehicle) => vehicle.capacity), 0);
    const oversizedShipments = shipments.filter((shipment) => shipment.load > maxVehicleCapacity);

    if (oversizedShipments.length > 0) {
      return new Response(JSON.stringify({
        error: `${oversizedShipments.length} Sendung(en) überschreiten die verfügbare Fahrzeugkapazität. Manuelle Disposition erforderlich.`,
        manual_required: true,
        oversized_shipments: oversizedShipments.map((shipment) => ({ id: shipment.id, load: shipment.load })),
      }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const planned = greedyPlan(shipments, vehicles);
    const plannedShipmentIds = new Set(planned.flatMap((tour) => tour.stops.map((stop) => stop.shipmentId)));
    const unplannedShipments = shipments.filter((shipment) => !plannedShipmentIds.has(shipment.id));

    if (unplannedShipments.length > 0) {
      return new Response(JSON.stringify({
        error: `${unplannedShipments.length} Sendung(en) konnten keiner Tour zugeordnet werden. Manuelle Disposition erforderlich.`,
        manual_required: true,
        unplanned_shipments: unplannedShipments.map((shipment) => ({ id: shipment.id, load: shipment.load })),
      }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const totalCost = planned.reduce((sum, tour) => sum + tour.cost, 0);

    const { data: planRun, error: planRunError } = await supabase
      .from("plan_run")
      .insert({
        company_id,
        status: force_replan ? "replanned" : "completed",
        input_snapshot: { shipment_count: shipments.length, vehicle_count: vehicles.length, force_replan },
        result_snapshot: { tour_count: planned.length, total_cost: totalCost },
      })
      .select("id")
      .single();

    if (planRunError) throw planRunError;

    const { data: maxVersion } = await supabase
      .from("touren_plan")
      .select("version")
      .eq("company_id", company_id)
      .eq("date", date)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (maxVersion?.version ?? 0) + 1;

    if (auto_activate) {
      await supabase
        .from("tour")
        .update({ is_active: false })
        .eq("company_id", company_id)
        .eq("date", date)
        .eq("is_active", true);

      await supabase
        .from("touren_plan")
        .update({ is_active: false })
        .eq("company_id", company_id)
        .eq("date", date)
        .eq("is_active", true);
    }

    const { data: plan, error: planError } = await supabase
      .from("touren_plan")
      .insert({
        company_id,
        date,
        version: nextVersion,
        is_active: auto_activate,
        plan_run_id: planRun.id,
        total_cost: totalCost,
        description: `Plan v${nextVersion} – ${planned.length} Touren, ${shipments.length} Stops`,
      })
      .select("id")
      .single();

    if (planError) throw planError;

    for (const plannedTour of planned) {
      const vehicle = vehicles.find((item) => item.id === plannedTour.vehicleId);
      const { data: tour, error: tourError } = await supabase
        .from("tour")
        .insert({
          company_id,
          plan_version_id: plan.id,
          date,
          version: nextVersion,
          is_active: auto_activate,
          plan_run_id: planRun.id,
          total_cost: plannedTour.cost,
          description: `Tour ${vehicle?.name ?? "?"} – ${plannedTour.stops.length} Stops`,
        })
        .select("id")
        .single();

      if (tourError) throw tourError;

      const stops = plannedTour.stops.map((stop) => ({
        tour_id: tour.id,
        vehicle_id: plannedTour.vehicleId,
        shipment_id: stop.shipmentId,
        stop_index: stop.index,
      }));

      const { error: stopError } = await supabase.from("tour_stop").insert(stops);
      if (stopError) throw stopError;
    }

    return new Response(JSON.stringify({
      success: true,
      resolved: true,
      manual_required: false,
      plan_id: plan.id,
      plan_run_id: planRun.id,
      version: nextVersion,
      tours: planned.length,
      total_stops: planned.reduce((sum, tour) => sum + tour.stops.length, 0),
      total_cost: totalCost,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("plan-tour error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
