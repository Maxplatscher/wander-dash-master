import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { scenario = "A" } = await req.json().catch(() => ({ scenario: "A" }));

    // 1. Create or get demo company
    const companyName = `Demo ${scenario}`;
    let { data: company } = await supabase
      .from("company")
      .select("id")
      .eq("name", companyName)
      .maybeSingle();

    if (!company) {
      const { data: newCo, error } = await supabase
        .from("company")
        .insert({ name: companyName })
        .select("id")
        .single();
      if (error) throw error;
      company = newCo;
    }
    const companyId = company!.id;

    // 2. Vehicles — delete old and recreate
    await supabase.from("vehicle").delete().eq("company_id", companyId);
    const vehicleRows = [
      { company_id: companyId, name: "LKW-01", capacity: 800 },
      { company_id: companyId, name: "LKW-02", capacity: 600 },
      { company_id: companyId, name: "Sprinter-01", capacity: 400 },
    ];
    if (scenario === "B") {
      vehicleRows.push({ company_id: companyId, name: "LKW-03", capacity: 1000 });
    }
    const { data: vehicles } = await supabase.from("vehicle").insert(vehicleRows).select("id, name, capacity");

    // 3. Drivers — delete old and recreate
    await supabase.from("driver").delete().eq("company_id", companyId);
    const driverRows = [
      { company_id: companyId, name: "Max Müller", phone: "+49 170 1234567", status: "active", shift_start: "06:00", shift_end: "14:00" },
      { company_id: companyId, name: "Anna Schmidt", phone: "+49 170 2345678", status: "active", shift_start: "07:00", shift_end: "15:00" },
      { company_id: companyId, name: "Tom Weber", phone: "+49 170 3456789", status: "active", shift_start: "08:00", shift_end: "16:00" },
    ];
    if (scenario === "B") {
      driverRows.push({ company_id: companyId, name: "Lisa Braun", phone: "+49 170 4567890", status: "active", shift_start: "06:00", shift_end: "14:00" });
      driverRows[2].status = "absent";
    }
    const { data: drivers } = await supabase.from("driver").insert(driverRows).select("id, name");

    // 4. Shipments
    const today = new Date().toISOString().split("T")[0];
    await supabase.from("shipment").delete().eq("company_id", companyId).eq("service_date", today);

    const baseShipments = [
      { name: "Lieferung Meier", customer_name: "Meier GmbH", delivery_address: "Hauptstr. 1, München", demand: 3, location_x: 48.137, location_y: 11.576, weight_kg: 120 },
      { name: "Lieferung Schulz", customer_name: "Schulz AG", delivery_address: "Bahnhofstr. 5, München", demand: 5, location_x: 48.140, location_y: 11.560, weight_kg: 250 },
      { name: "Lieferung Bauer", customer_name: "Bauer KG", delivery_address: "Leopoldstr. 10, München", demand: 2, location_x: 48.155, location_y: 11.585, weight_kg: 80 },
      { name: "Lieferung Koch", customer_name: "Koch & Söhne", delivery_address: "Sendlinger Str. 20, München", demand: 4, location_x: 48.134, location_y: 11.567, weight_kg: 180 },
      { name: "Lieferung Fischer", customer_name: "Fischer OHG", delivery_address: "Maximilianstr. 8, München", demand: 6, location_x: 48.139, location_y: 11.581, weight_kg: 300 },
      { name: "Lieferung Wagner", customer_name: "Wagner Ltd", delivery_address: "Karlsplatz 3, München", demand: 1, location_x: 48.139, location_y: 11.565, weight_kg: 45 },
      { name: "Lieferung Hofmann", customer_name: "Hofmann Logistik", delivery_address: "Arnulfstr. 15, München", demand: 3, location_x: 48.142, location_y: 11.553, weight_kg: 150 },
      { name: "Lieferung Braun", customer_name: "Braun Technik", delivery_address: "Theresienstr. 22, München", demand: 2, location_x: 48.150, location_y: 11.570, weight_kg: 90 },
    ];

    if (scenario === "B") {
      baseShipments.push(
        { name: "Eillieferung Kraus", customer_name: "Kraus Elektro", delivery_address: "Nymphenburger Str. 40, München", demand: 8, location_x: 48.148, location_y: 11.540, weight_kg: 500 },
        { name: "Eillieferung Lang", customer_name: "Lang Bau", delivery_address: "Dachauerstr. 55, München", demand: 7, location_x: 48.153, location_y: 11.550, weight_kg: 400 },
      );
    }

    const shipments = baseShipments.map(s => ({
      ...s,
      company_id: companyId,
      service_date: today,
      intake_source: "demo",
      intake_status: "complete",
    }));

    const { data: insertedShipments } = await supabase.from("shipment").insert(shipments).select("id, weight_kg, customer_name");

    // 5. Delete old tours & stops for today
    const { data: oldTours } = await supabase.from("tour").select("id").eq("company_id", companyId).eq("date", today);
    if (oldTours?.length) {
      const oldIds = oldTours.map(t => t.id);
      await supabase.from("tour_stop").delete().in("tour_id", oldIds);
      await supabase.from("tour").delete().in("id", oldIds);
    }

    // 6. Create active tours with stops
    const activeDrivers = (drivers ?? []).filter((_, i) => driverRows[i]?.status === "active");
    const vList = vehicles ?? [];
    const sList = insertedShipments ?? [];

    // Distribute shipments across drivers
    const tourData: { driverIdx: number; shipmentIds: string[] }[] = activeDrivers.map(() => ({ driverIdx: 0, shipmentIds: [] }));
    sList.forEach((s, i) => {
      const tIdx = i % activeDrivers.length;
      tourData[tIdx].shipmentIds.push(s.id);
    });

    const now = new Date();

    for (let t = 0; t < activeDrivers.length; t++) {
      const driver = activeDrivers[t];
      const vehicle = vList[t % vList.length];
      const td = tourData[t];

      if (td.shipmentIds.length === 0) continue;

      const { data: tour, error: tourErr } = await supabase.from("tour").insert({
        company_id: companyId,
        date: today,
        description: `Tour ${driver.name}`,
        is_active: true,
        version: 1,
      }).select("id").single();

      if (tourErr || !tour) continue;

      // Create stops — mark first 1-2 as completed for realism
      const completedCount = Math.min(Math.floor(td.shipmentIds.length / 2), 2);
      const stops = td.shipmentIds.map((shipId, idx) => {
        const arrivalMinutes = 30 + idx * 25;
        const arrival = new Date(now.getTime() - (td.shipmentIds.length - idx) * 30 * 60000);
        const departure = new Date(arrival.getTime() + 15 * 60000);

        return {
          tour_id: tour.id,
          shipment_id: shipId,
          vehicle_id: vehicle.id,
          stop_index: idx + 1,
          arrival_time: arrival.toISOString(),
          departure_time: departure.toISOString(),
          segment_cost: Math.round(5 + Math.random() * 15),
          driver_completed: idx < completedCount,
          driver_completed_at: idx < completedCount ? departure.toISOString() : null,
        };
      });

      await supabase.from("tour_stop").insert(stops);
    }

    return new Response(
      JSON.stringify({ success: true, company_id: companyId, scenario, tours: activeDrivers.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
