import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type LatLng = { lat: number; lng: number };

type DepotRow = {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
};

type ShipmentRow = {
  id: string;
  location_x: number | null;
  location_y: number | null;
  depot_id: string | null;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Haversine distance in meters. */
function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function shipmentPoint(row: ShipmentRow): LatLng | null {
  if (row.location_x == null || row.location_y == null) return null;
  // Convention in this project: location_x = lat, location_y = lng
  return { lat: row.location_x, lng: row.location_y };
}

function depotPoint(row: DepotRow): LatLng | null {
  if (row.lat == null || row.lng == null) return null;
  return { lat: row.lat, lng: row.lng };
}

function assignByHaversine(
  shipments: ShipmentRow[],
  depots: DepotRow[],
): { shipmentId: string; depotId: string; meters: number; method: "haversine" }[] {
  const usable = depots
    .map((d) => ({ depot: d, point: depotPoint(d) }))
    .filter((d): d is { depot: DepotRow; point: LatLng } => d.point != null);

  const assignments: { shipmentId: string; depotId: string; meters: number; method: "haversine" }[] = [];

  for (const shipment of shipments) {
    const origin = shipmentPoint(shipment);
    if (!origin) continue;

    let best: { depotId: string; meters: number } | null = null;
    for (const { depot, point } of usable) {
      const meters = haversineMeters(origin, point);
      if (!best || meters < best.meters) {
        best = { depotId: depot.id, meters };
      }
    }
    if (best) {
      assignments.push({
        shipmentId: shipment.id,
        depotId: best.depotId,
        meters: Math.round(best.meters),
        method: "haversine",
      });
    }
  }

  return assignments;
}

/**
 * Google Distance Matrix: origins = shipments, destinations = depots.
 * Prefer duration_in_traffic / duration, else distance. Fallback per element to Haversine.
 * Batches in chunks of 10×10 to stay within typical request limits.
 */
async function assignByDistanceMatrix(
  shipments: ShipmentRow[],
  depots: DepotRow[],
  apiKey: string,
): Promise<{ shipmentId: string; depotId: string; meters: number; method: "distance_matrix" | "haversine" }[]> {
  const usableShipments = shipments
    .map((s) => ({ shipment: s, point: shipmentPoint(s) }))
    .filter((s): s is { shipment: ShipmentRow; point: LatLng } => s.point != null);

  const usableDepots = depots
    .map((d) => ({ depot: d, point: depotPoint(d) }))
    .filter((d): d is { depot: DepotRow; point: LatLng } => d.point != null);

  if (usableShipments.length === 0 || usableDepots.length === 0) return [];

  const assignments: {
    shipmentId: string;
    depotId: string;
    meters: number;
    method: "distance_matrix" | "haversine";
  }[] = [];

  const ORIGIN_CHUNK = 10;
  const DEST_CHUNK = 10;

  for (let oi = 0; oi < usableShipments.length; oi += ORIGIN_CHUNK) {
    const originChunk = usableShipments.slice(oi, oi + ORIGIN_CHUNK);

    // Accumulate best depot per shipment across destination chunks
    const bestByShipment = new Map<string, { depotId: string; meters: number; method: "distance_matrix" | "haversine" }>();

    for (let di = 0; di < usableDepots.length; di += DEST_CHUNK) {
      const destChunk = usableDepots.slice(di, di + DEST_CHUNK);
      const origins = originChunk.map((o) => `${o.point.lat},${o.point.lng}`).join("|");
      const destinations = destChunk.map((d) => `${d.point.lat},${d.point.lng}`).join("|");

      const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
      url.searchParams.set("origins", origins);
      url.searchParams.set("destinations", destinations);
      url.searchParams.set("mode", "driving");
      url.searchParams.set("units", "metric");
      url.searchParams.set("key", apiKey);

      const res = await fetch(url.toString());
      if (!res.ok) {
        throw new Error(`Distance Matrix HTTP ${res.status}`);
      }
      const data = await res.json() as {
        status: string;
        error_message?: string;
        rows?: { elements?: { status: string; distance?: { value: number }; duration?: { value: number } }[] }[];
      };

      if (data.status !== "OK") {
        throw new Error(`Distance Matrix status ${data.status}: ${data.error_message ?? ""}`);
      }

      for (let r = 0; r < originChunk.length; r++) {
        const shipment = originChunk[r];
        const elements = data.rows?.[r]?.elements ?? [];
        for (let c = 0; c < destChunk.length; c++) {
          const depot = destChunk[c];
          const el = elements[c];
          let meters: number;
          let method: "distance_matrix" | "haversine";

          if (el?.status === "OK" && (el.distance?.value != null || el.duration?.value != null)) {
            // Prefer road distance; duration alone is converted roughly if distance missing
            meters = el.distance?.value ?? (el.duration?.value ?? 0) * 12;
            method = "distance_matrix";
          } else {
            meters = haversineMeters(shipment.point, depot.point);
            method = "haversine";
          }

          const prev = bestByShipment.get(shipment.shipment.id);
          if (!prev || meters < prev.meters) {
            bestByShipment.set(shipment.shipment.id, {
              depotId: depot.depot.id,
              meters: Math.round(meters),
              method,
            });
          }
        }
      }
    }

    for (const [shipmentId, best] of bestByShipment) {
      assignments.push({ shipmentId, ...best });
    }
  }

  return assignments;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const mapsKey = Deno.env.get("GOOGLE_MAPS_API_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceKey);

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    let company_id = body.company_id as string | undefined;
    const date = (body.date as string) || new Date().toISOString().split("T")[0];
    const force = body.force === true;
    const onlyUnassigned = body.only_unassigned !== false;

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
      return jsonResponse({ error: "company_id required (provide in body or sign in)" }, 400);
    }

    const { data: depotRows, error: depotError } = await supabase
      .from("depot")
      .select("id, name, lat, lng")
      .eq("company_id", company_id)
      .eq("is_active", true);

    if (depotError) throw depotError;

    const depots = (depotRows ?? []) as DepotRow[];
    const depotsWithCoords = depots.filter((d) => d.lat != null && d.lng != null);

    if (depotsWithCoords.length === 0) {
      return jsonResponse({
        error: "Keine aktiven Depots mit lat/lng vorhanden. Bitte Depot-Koordinaten setzen.",
        assigned: 0,
        skipped: 0,
      }, 422);
    }

    let query = supabase
      .from("shipment")
      .select("id, location_x, location_y, depot_id")
      .eq("company_id", company_id)
      .eq("service_date", date);

    if (onlyUnassigned && !force) {
      query = query.is("depot_id", null);
    }

    const { data: shipmentRows, error: shipmentError } = await query;
    if (shipmentError) throw shipmentError;

    const shipments = (shipmentRows ?? []) as ShipmentRow[];
    const withCoords = shipments.filter((s) => s.location_x != null && s.location_y != null);
    const skippedNoCoords = shipments.length - withCoords.length;

    if (withCoords.length === 0) {
      return jsonResponse({
        success: true,
        assigned: 0,
        skipped: skippedNoCoords,
        method: mapsKey ? "distance_matrix" : "haversine",
        message: "Keine Sendungen mit Koordinaten zum Zuordnen",
      });
    }

    let assignments: {
      shipmentId: string;
      depotId: string;
      meters: number;
      method: "distance_matrix" | "haversine";
    }[];
    let methodUsed: "distance_matrix" | "haversine" = "haversine";

    if (mapsKey) {
      try {
        assignments = await assignByDistanceMatrix(withCoords, depotsWithCoords, mapsKey);
        methodUsed = assignments.some((a) => a.method === "distance_matrix")
          ? "distance_matrix"
          : "haversine";
      } catch (matrixError) {
        console.warn("Distance Matrix failed, falling back to Haversine:", matrixError);
        assignments = assignByHaversine(withCoords, depotsWithCoords);
        methodUsed = "haversine";
      }
    } else {
      assignments = assignByHaversine(withCoords, depotsWithCoords);
      methodUsed = "haversine";
    }

    let updated = 0;
    for (const a of assignments) {
      const { error } = await supabase
        .from("shipment")
        .update({ depot_id: a.depotId })
        .eq("id", a.shipmentId)
        .eq("company_id", company_id);
      if (!error) updated += 1;
    }

    const byDepot: Record<string, number> = {};
    for (const a of assignments) {
      byDepot[a.depotId] = (byDepot[a.depotId] ?? 0) + 1;
    }

    return jsonResponse({
      success: true,
      assigned: updated,
      skipped: skippedNoCoords,
      method: methodUsed,
      maps_key_configured: Boolean(mapsKey),
      depot_counts: byDepot,
      sample: assignments.slice(0, 5),
    });
  } catch (error) {
    console.error("assign-depot error:", error);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
