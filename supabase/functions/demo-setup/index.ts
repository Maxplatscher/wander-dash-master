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

    // 2. Vehicles
    const { data: existingVehicles } = await supabase
      .from("vehicle")
      .select("id")
      .eq("company_id", companyId);

    if (!existingVehicles?.length) {
      const vehicles = [
        { company_id: companyId, name: "LKW-01", capacity: 20 },
        { company_id: companyId, name: "LKW-02", capacity: 15 },
        { company_id: companyId, name: "Sprinter-01", capacity: 10 },
      ];
      if (scenario === "B") {
        vehicles.push({ company_id: companyId, name: "LKW-03", capacity: 25 });
      }
      await supabase.from("vehicle").insert(vehicles);
    }

    // 3. Drivers
    const { data: existingDrivers } = await supabase
      .from("driver")
      .select("id")
      .eq("company_id", companyId);

    if (!existingDrivers?.length) {
      const drivers = [
        { company_id: companyId, name: "Max Müller", phone: "+49 170 1234567", status: "active", shift_start: "06:00", shift_end: "14:00" },
        { company_id: companyId, name: "Anna Schmidt", phone: "+49 170 2345678", status: "active", shift_start: "07:00", shift_end: "15:00" },
        { company_id: companyId, name: "Tom Weber", phone: "+49 170 3456789", status: "active", shift_start: "08:00", shift_end: "16:00" },
      ];
      if (scenario === "B") {
        drivers[2].status = "absent";
      }
      await supabase.from("driver").insert(drivers);
    }

    // 4. Shipments
    const today = new Date().toISOString().split("T")[0];
    const { data: existingShipments } = await supabase
      .from("shipment")
      .select("id")
      .eq("company_id", companyId)
      .eq("service_date", today);

    if (!existingShipments?.length) {
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
        // Add more shipments for problem scenario
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

      await supabase.from("shipment").insert(shipments);
    }

    return new Response(
      JSON.stringify({ success: true, company_id: companyId, scenario }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
