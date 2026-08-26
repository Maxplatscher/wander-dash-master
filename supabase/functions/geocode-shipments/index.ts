import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const NOMINATIM_GAP_MS = 1100;

type LatLng = { lat: number; lng: number };
type Precision = "exact" | "street" | "postal" | "area";
type Provider = "google" | "nominatim";
type GoogleResult = {
  formatted_address?: string;
  geometry?: { location?: LatLng; location_type?: string };
  types?: string[];
};

type Outcome = {
  shipment_id: string;
  address: string;
  status: "updated" | "skipped" | "failed";
  reason?: string;
  precision?: Precision;
  location?: LatLng;
  provider?: Provider;
};

type Lookup =
  | { ok: true; result: GoogleResult; provider: Provider }
  | { ok: false; reason: string; abort?: boolean; fallback?: boolean };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isServiceRoleToken(token: string, serviceKey: string): boolean {
  if (token === serviceKey) return true;
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return false;
    const padded = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const withPad = padded + "=".repeat((4 - (padded.length % 4)) % 4);
    const payload = JSON.parse(atob(withPad)) as { role?: string };
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

function usableExisting(lat: number | null, lng: number | null): boolean {
  if (lat == null || lng == null) return false;
  if (lat === 0 && lng === 0) return false;
  return Number.isFinite(lat) && Number.isFinite(lng);
}

function addressHasHouseNumber(address: string): boolean {
  return /\d+[a-zA-Z]?/.test(address);
}

function geocodePrecision(result: GoogleResult): Precision {
  const locationType = result.geometry?.location_type ?? "";
  const types = result.types ?? [];
  if (
    locationType === "ROOFTOP" ||
    types.includes("street_address") ||
    types.includes("premise") ||
    types.includes("subpremise")
  ) {
    return "exact";
  }
  if (locationType === "RANGE_INTERPOLATED" || types.includes("route")) {
    return "street";
  }
  if (types.includes("postal_code")) return "postal";
  return "area";
}

function acceptResult(
  address: string,
  result: GoogleResult,
): { ok: true; lat: number; lng: number; precision: Precision } | { ok: false; reason: string } {
  const location = result.geometry?.location;
  if (
    location == null ||
    !Number.isFinite(location.lat) ||
    !Number.isFinite(location.lng)
  ) {
    return { ok: false, reason: "no_geometry" };
  }
  if (location.lat === 0 && location.lng === 0) {
    return { ok: false, reason: "null_island" };
  }
  const precision = geocodePrecision(result);
  if (precision === "area" && addressHasHouseNumber(address)) {
    return { ok: false, reason: "too_coarse" };
  }
  return { ok: true, lat: location.lat, lng: location.lng, precision };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nominatimTypes(row: {
  class?: string;
  type?: string;
  addresstype?: string;
}): string[] {
  const kind = row.addresstype || row.type || "";
  const cls = row.class || "";
  if (cls === "building" || kind === "house" || kind === "building") {
    return ["street_address"];
  }
  if (cls === "highway" || kind === "road" || kind === "residential") {
    return ["route"];
  }
  if (kind === "postcode") return ["postal_code"];
  if (kind === "city" || kind === "town" || kind === "village" || kind === "suburb") {
    return ["locality"];
  }
  return ["route"];
}

async function lookupGoogle(address: string, mapsKey: string): Promise<Lookup> {
  const url =
    `${GEOCODE_URL}?address=${encodeURIComponent(address)}&region=de&language=de` +
    `&components=${encodeURIComponent("country:DE")}&key=${mapsKey}`;
  const response = await fetch(url);
  if (response.status === 429) {
    return { ok: false, reason: "rate_limited", abort: true };
  }
  if (!response.ok) {
    return { ok: false, reason: `http_${response.status}` };
  }
  const payload = await response.json() as {
    status?: string;
    results?: GoogleResult[];
  };
  if (payload.status === "OVER_QUERY_LIMIT" || payload.status === "UNKNOWN_ERROR") {
    return {
      ok: false,
      reason: payload.status.toLowerCase(),
      abort: true,
      fallback: true,
    };
  }
  if (payload.status === "REQUEST_DENIED") {
    return { ok: false, reason: "request_denied", fallback: true };
  }
  if (payload.status === "ZERO_RESULTS") {
    return { ok: false, reason: "not_found" };
  }
  if (!payload.results?.length || payload.status !== "OK") {
    return { ok: false, reason: (payload.status ?? "geocode_error").toLowerCase() };
  }
  return { ok: true, result: payload.results[0], provider: "google" };
}

async function lookupNominatim(address: string): Promise<Lookup> {
  const url =
    "https://nominatim.openstreetmap.org/search?" +
    new URLSearchParams({
      q: address,
      format: "jsonv2",
      limit: "1",
      countrycodes: "de",
    }).toString();
  const response = await fetch(url, {
    headers: {
      "User-Agent": "DispoCenter-geocode-shipments/1.0",
      "Accept-Language": "de",
    },
  });
  if (response.status === 429) {
    return { ok: false, reason: "rate_limited", abort: true };
  }
  if (!response.ok) {
    return { ok: false, reason: `http_${response.status}` };
  }
  const rows = await response.json() as Array<{
    lat: string;
    lon: string;
    class?: string;
    type?: string;
    addresstype?: string;
  }>;
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, reason: "not_found" };
  }
  const row = rows[0];
  const lat = Number(row.lat);
  const lng = Number(row.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, reason: "no_geometry" };
  }
  const types = nominatimTypes(row);
  return {
    ok: true,
    provider: "nominatim",
    result: {
      geometry: {
        location: { lat, lng },
        location_type: types.includes("street_address") ? "ROOFTOP" : "APPROXIMATE",
      },
      types,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const mapsKey = Deno.env.get("GOOGLE_MAPS_API_KEY") ?? "";
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Anmeldung erforderlich." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    let companyId: string | null = null;
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const serviceRoleCall = isServiceRoleToken(token, serviceKey);

    if (serviceRoleCall) {
      companyId = typeof body.company_id === "string" ? body.company_id : null;
      if (!companyId) {
        return jsonResponse(
          { error: "company_id ist bei Service-Role-Aufruf Pflicht." },
          400,
        );
      }
    } else {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: rpcCompanyId, error: companyError } = await userClient.rpc(
        "get_user_company_id",
      );
      if (companyError || !rpcCompanyId) {
        return jsonResponse({ error: "Kein Unternehmen zugeordnet." }, 403);
      }
      const { data: role } = await userClient.rpc("get_my_role");
      if (role !== "admin" && role !== "dispatcher") {
        return jsonResponse(
          { error: "Nur Disposition darf Adressen geokodieren." },
          403,
        );
      }
      companyId = rpcCompanyId as string;
    }

    const date = typeof body.date === "string" && body.date
      ? body.date
      : new Date().toISOString().split("T")[0];
    const force = body.force === true;
    const requestedLimit = Number(body.limit);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(MAX_LIMIT, Math.max(1, Math.floor(requestedLimit)))
      : DEFAULT_LIMIT;
    const shipmentIds = Array.isArray(body.shipment_ids)
      ? body.shipment_ids.filter((id): id is string => typeof id === "string")
      : [];

    const admin = createClient(supabaseUrl, serviceKey);
    let query = admin
      .from("shipment")
      .select("id, delivery_address, location_x, location_y")
      .eq("company_id", companyId)
      .eq("service_date", date)
      .order("id", { ascending: true })
      .limit(limit);

    if (shipmentIds.length > 0) {
      query = query.in("id", shipmentIds);
    }

    const { data: rows, error: loadError } = await query;
    if (loadError) throw loadError;

    const targets = (rows ?? []).filter((row) => {
      if (!row.delivery_address?.trim()) return false;
      if (force) return true;
      return !usableExisting(row.location_x, row.location_y);
    });

    const outcomes: Outcome[] = [];
    let aborted: string | null = null;
    let useNominatim = !mapsKey;

    for (const row of targets) {
      const address = String(row.delivery_address).trim();
      let lookup: Lookup;

      if (!useNominatim) {
        lookup = await lookupGoogle(address, mapsKey);
        if (!lookup.ok && lookup.fallback) {
          useNominatim = true;
          lookup = await lookupNominatim(address);
        }
      } else {
        lookup = await lookupNominatim(address);
      }

      if (useNominatim) {
        await sleep(NOMINATIM_GAP_MS);
      }

      if (!lookup.ok) {
        if (lookup.abort) aborted = lookup.reason;
        outcomes.push({
          shipment_id: row.id,
          address,
          status: "failed",
          reason: lookup.reason,
        });
        if (lookup.abort) break;
        continue;
      }

      const decision = acceptResult(address, lookup.result);
      if (!decision.ok) {
        outcomes.push({
          shipment_id: row.id,
          address,
          status: "failed",
          reason: decision.reason,
          provider: lookup.provider,
        });
        continue;
      }

      const { error: updateError } = await admin
        .from("shipment")
        .update({
          location_x: decision.lat,
          location_y: decision.lng,
        })
        .eq("id", row.id)
        .eq("company_id", companyId);
      if (updateError) throw updateError;

      outcomes.push({
        shipment_id: row.id,
        address,
        status: "updated",
        precision: decision.precision,
        location: { lat: decision.lat, lng: decision.lng },
        provider: lookup.provider,
      });
    }

    const updated = outcomes.filter((item) => item.status === "updated").length;
    return jsonResponse({
      date,
      scanned: targets.length,
      updated,
      aborted,
      provider: useNominatim ? "nominatim" : "google",
      results: outcomes,
    });
  } catch (error) {
    console.error("geocode-shipments", error);
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error && "message" in error
        ? String((error as { message: unknown }).message)
        : "Geokodierung fehlgeschlagen";
    return jsonResponse({ error: message }, 500);
  }
});
