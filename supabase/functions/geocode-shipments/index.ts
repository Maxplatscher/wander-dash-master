import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NOMINATIM_GAP_MS = 1100;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function geocodeGoogle(address: string, key: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`;
  const res = await fetch(url);
  const data = await res.json();
  const loc = data?.results?.[0]?.geometry?.location;
  if (typeof loc?.lat === "number" && typeof loc?.lng === "number") return { lat: loc.lat, lng: loc.lng };
  return null;
}

async function geocodeNominatim(address: string): Promise<{ lat: number; lng: number } | "rate_limited" | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
  const res = await fetch(url, { headers: { "User-Agent": "DispoCenter-geocode-shipments/1.0" } });
  if (res.status === 429) return "rate_limited";
  const data = await res.json();
  if (!Array.isArray(data) || !data[0]) return null;
  const lat = Number(data[0].lat);
  const lng = Number(data[0].lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const mapsKey = Deno.env.get("GOOGLE_MAPS_API_KEY") ?? "";
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json({ error: "Anmeldung erforderlich." }, 401);

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: companyId } = await userClient.rpc("get_user_company_id");
    if (!companyId) return json({ error: "Kein Unternehmen zugeordnet." }, 403);

    const body = await req.json().catch(() => ({}));
    const date = (body.date as string) || new Date().toISOString().split("T")[0];

    const { data: rows, error } = await admin
      .from("shipment")
      .select("id, delivery_address, location_x, location_y")
      .eq("company_id", companyId)
      .eq("service_date", date);
    if (error) throw error;

    const targets = (rows ?? []).filter(
      (row) =>
        row.delivery_address &&
        (row.location_x == null || row.location_y == null || (row.location_x === 0 && row.location_y === 0)),
    );

    let updated = 0;
    let provider = mapsKey ? "google" : "nominatim";
    for (const row of targets) {
      let coords: { lat: number; lng: number } | null = null;
      if (mapsKey) {
        coords = await geocodeGoogle(row.delivery_address as string, mapsKey);
      }
      if (!coords) {
        if (mapsKey) provider = "nominatim";
        const nom = await geocodeNominatim(row.delivery_address as string);
        if (nom === "rate_limited") {
          return json({ scanned: targets.length, updated, provider, abort: true, error: "Nominatim rate_limited" }, 429);
        }
        coords = nom;
        await new Promise((r) => setTimeout(r, NOMINATIM_GAP_MS));
      }
      if (!coords) continue;
      const { error: upError } = await admin
        .from("shipment")
        .update({ location_x: coords.lat, location_y: coords.lng })
        .eq("id", row.id);
      if (!upError) updated += 1;
    }

    return json({ success: true, scanned: targets.length, updated, provider });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
