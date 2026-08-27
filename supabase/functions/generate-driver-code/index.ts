import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import bcrypt from "npm:bcryptjs@2.4.3";
import { generateLoginCode } from "../_shared/driver-name.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json({ error: "Anmeldung erforderlich." }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: role } = await userClient.rpc("get_my_role");
    if (role !== "admin" && role !== "dispatcher") {
      return json({ error: "Nur Disposition darf Codes erzeugen." }, 403);
    }
    const { data: companyId } = await userClient.rpc("get_user_company_id");
    if (!companyId) return json({ error: "Kein Unternehmen zugeordnet." }, 403);

    const body = await req.json().catch(() => ({}));
    const driverId = typeof body.driver_id === "string" ? body.driver_id : "";
    if (!driverId) return json({ error: "driver_id fehlt." }, 400);

    const { data: driver, error: driverError } = await admin
      .from("driver")
      .select("id, company_id, name")
      .eq("id", driverId)
      .maybeSingle();
    if (driverError) throw driverError;
    if (!driver || driver.company_id !== companyId) {
      return json({ error: "Fahrer gehört nicht zu diesem Unternehmen." }, 403);
    }

    const code = generateLoginCode();
    const codeHash = bcrypt.hashSync(code, 10);
    const setAt = new Date().toISOString();

    const { error: secretError } = await admin.from("driver_login_secret").upsert(
      {
        driver_id: driverId,
        code_hash: codeHash,
        set_at: setAt,
        failed_attempts: 0,
        locked_until: null,
      },
      { onConflict: "driver_id" },
    );
    if (secretError) throw secretError;

    const { error: flagError } = await admin
      .from("driver")
      .update({ login_code_set_at: setAt })
      .eq("id", driverId);
    if (flagError) throw flagError;

    return json({
      success: true,
      driver_id: driverId,
      driver_name: driver.name,
      code,
    });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
