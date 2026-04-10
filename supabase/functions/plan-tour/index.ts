import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Shipment {
  id: string;
  demand: number;
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

function greedyPlan(shipments: Shipment[], vehicles: Vehicle[]): { vehicleId: string; stops: { shipmentId: string; index: number }[]; cost: number }[] {
  const unassigned = [...shipments];
  const tours: { vehicleId: string; stops: { shipmentId: string; index: number }[]; cost: number }[] = [];

  // Depot at centroid
  const depot = {
    location_x: shipments.reduce((s, sh) => s + sh.location_x, 0) / shipments.length,
    location_y: shipments.reduce((s, sh) => s + sh.location_y, 0) / shipments.length,
  };

  for (const vehicle of vehicles) {
    if (unassigned.length === 0) break;
    let remaining = vehicle.capacity;
    let current = depot;
    const stops: { shipmentId: string; index: number }[] = [];
    let totalCost = 0;

    while (unassigned.length > 0) {
      // Find nearest that fits
      let bestIdx = -1;
      let bestDist = Infinity;
      for (let i = 0; i < unassigned.length; i++) {
        const d = manhattan(current, unassigned[i]);
        if ((unassigned[i].demand ?? 1) <= remaining && d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      if (bestIdx === -1) break;

      const chosen = unassigned.splice(bestIdx, 1)[0];
      remaining -= chosen.demand ?? 1;
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
    const supabase = createClient(supabaseUrl, serviceKey);

    // Parse body safely — allow empty body for UI calls
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      // empty body is fine — we'll resolve from auth
    }

    let company_id = body.company_id as string | undefined;
    const date = (body.date as string) || new Date().toISOString().split('T')[0];
    const auto_activate = body.auto_activate !== false;

    // If no company_id provided, resolve from the caller's JWT
    if (!company_id) {
      const authHeader = req.headers.get("authorization");
      if (authHeader) {
        const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: cid } = await userClient.rpc("get_user_company_id");
        if (cid) company_id = cid as string;
      }
    }

    if (!company_id) {
      return new Response(JSON.stringify({ error: "company_id required (provide in body or sign in)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load shipments for the date
    const { data: shipments, error: sErr } = await supabase
      .from("shipment")
      .select("id, demand, location_x, location_y, window_start, window_end")
      .eq("company_id", company_id)
      .eq("service_date", date);
    if (sErr) throw sErr;
    if (!shipments?.length) {
      return new Response(JSON.stringify({ error: "No shipments for this date" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load vehicles
    const { data: vehicles, error: vErr } = await supabase
      .from("vehicle")
      .select("id, capacity, name")
      .eq("company_id", company_id);
    if (vErr) throw vErr;
    if (!vehicles?.length) {
      return new Response(JSON.stringify({ error: "No vehicles" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Run optimizer
    const planned = greedyPlan(shipments as Shipment[], vehicles as Vehicle[]);
    const totalCost = planned.reduce((s, t) => s + t.cost, 0);

    // Create plan_run
    const { data: planRun, error: prErr } = await supabase
      .from("plan_run")
      .insert({
        company_id,
        status: "completed",
        input_snapshot: { shipment_count: shipments.length, vehicle_count: vehicles.length },
        result_snapshot: { tour_count: planned.length, total_cost: totalCost },
      })
      .select("id")
      .single();
    if (prErr) throw prErr;

    // Get next version number
    const { data: maxVersion } = await supabase
      .from("touren_plan")
      .select("version")
      .eq("company_id", company_id)
      .eq("date", date)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersion = (maxVersion?.version ?? 0) + 1;

    // If auto_activate, deactivate old plans
    if (auto_activate) {
      await supabase
        .from("touren_plan")
        .update({ is_active: false })
        .eq("company_id", company_id)
        .eq("date", date);
    }

    // Create touren_plan
    const { data: plan, error: tpErr } = await supabase
      .from("touren_plan")
      .insert({
        company_id,
        date,
        version: nextVersion,
        is_active: auto_activate,
        plan_run_id: planRun!.id,
        total_cost: totalCost,
        description: `Plan v${nextVersion} – ${planned.length} Touren, ${shipments.length} Stops`,
      })
      .select("id")
      .single();
    if (tpErr) throw tpErr;

    // Create tours + stops
    for (const t of planned) {
      const { data: tour, error: tourErr } = await supabase
        .from("tour")
        .insert({
          company_id,
          plan_version_id: plan!.id,
          date,
          version: nextVersion,
          is_active: auto_activate,
          plan_run_id: planRun!.id,
          total_cost: t.cost,
          description: `Tour ${vehicles.find(v => v.id === t.vehicleId)?.name ?? "?"} – ${t.stops.length} Stops`,
        })
        .select("id")
        .single();
      if (tourErr) throw tourErr;

      const stops = t.stops.map(s => ({
        tour_id: tour!.id,
        vehicle_id: t.vehicleId,
        shipment_id: s.shipmentId,
        stop_index: s.index,
      }));

      const { error: stErr } = await supabase.from("tour_stop").insert(stops);
      if (stErr) throw stErr;
    }

    return new Response(
      JSON.stringify({
        success: true,
        plan_id: plan!.id,
        plan_run_id: planRun!.id,
        version: nextVersion,
        tours: planned.length,
        total_stops: planned.reduce((s, t) => s + t.stops.length, 0),
        total_cost: totalCost,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
