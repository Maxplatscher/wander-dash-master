import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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

function generateTemporaryPassword(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  let raw = "";
  for (const b of bytes) raw += String.fromCharCode(b);
  const token = btoa(raw).replace(/[+/=]/g, "").slice(0, 16);
  return `Dc-${token}!1a`;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function findAuthUserId(
  supabaseUrl: string,
  serviceKey: string,
  email: string,
): Promise<string | null> {
  const url = `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
  });
  if (!response.ok) return null;
  const payload = await response.json().catch(() => null);
  if (payload?.users && Array.isArray(payload.users) && payload.users[0]?.id) {
    return payload.users[0].id as string;
  }
  if (payload?.id) return payload.id as string;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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
      return json({ error: "Nur Disposition darf Fahrer einladen." }, 403);
    }
    const { data: companyId, error: companyError } = await userClient.rpc("get_user_company_id");
    if (companyError || !companyId) {
      return json({ error: "Kein Unternehmen zugeordnet." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const driverId = typeof body.driver_id === "string" ? body.driver_id : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!driverId) return json({ error: "driver_id fehlt." }, 400);
    if (!isValidEmail(email)) return json({ error: "Gültige E-Mail erforderlich." }, 400);

    const { data: driver, error: driverError } = await admin
      .from("driver")
      .select("id, company_id, name")
      .eq("id", driverId)
      .maybeSingle();
    if (driverError) throw driverError;
    if (!driver || driver.company_id !== companyId) {
      return json({ error: "Fahrer gehört nicht zu diesem Unternehmen." }, 403);
    }

    const password = generateTemporaryPassword();
    let userId: string | null = null;
    let created = false;

    const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: driver.name ?? "", role: "driver" },
    });

    if (createError) {
      userId = await findAuthUserId(supabaseUrl, serviceKey, email);
      if (!userId) {
        return json({ error: createError.message }, 400);
      }
      const { error: updatePwError } = await admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
      });
      if (updatePwError) throw updatePwError;
    } else {
      userId = createdUser.user?.id ?? null;
      created = true;
    }

    if (!userId) return json({ error: "Auth-User konnte nicht angelegt werden." }, 500);

    const { data: existingProfile } = await admin
      .from("users")
      .select("id, company_id, driver_id")
      .eq("id", userId)
      .maybeSingle();

    if (existingProfile?.company_id && existingProfile.company_id !== companyId) {
      return json({ error: "Diese E-Mail gehört bereits zu einem anderen Unternehmen." }, 409);
    }

    const { error: profileError } = await admin.from("users").upsert(
      {
        id: userId,
        email,
        company_id: companyId,
        driver_id: driverId,
        role: "driver",
        is_active: true,
      },
      { onConflict: "id" },
    );
    if (profileError) throw profileError;

    await admin.from("user_roles").delete().eq("user_id", userId).neq("role", "driver");
    const { error: roleError } = await admin.from("user_roles").upsert(
      { user_id: userId, role: "driver" },
      { onConflict: "user_id,role" },
    );
    if (roleError) throw roleError;

    return json({
      success: true,
      user_id: userId,
      email,
      temporary_password: password,
      created,
    });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
