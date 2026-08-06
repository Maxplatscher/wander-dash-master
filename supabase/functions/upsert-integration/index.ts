import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_TYPES = new Set([
  "erp",
  "telematics",
  "email_imap",
  "rest_api",
  "csv_import",
]);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function asRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "string" && raw.length > 0) out[key] = raw;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceKey || !anonKey) {
      return jsonResponse({ error: "Missing Supabase env vars" }, 500);
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization header" }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const id = body.id as string | undefined;
    const name = (body.name as string | undefined)?.trim();
    const system_type = body.system_type as string | undefined;
    const depot_id = (body.depot_id as string | null | undefined) ?? null;
    const is_active = body.is_active !== false;
    const config = (body.config && typeof body.config === "object" && !Array.isArray(body.config))
      ? body.config as Record<string, unknown>
      : {};
    const credentials = asRecord(body.credentials);

    if (!id) return jsonResponse({ error: "id required" }, 400);
    if (!name) return jsonResponse({ error: "name required" }, 400);
    if (!system_type || !ALLOWED_TYPES.has(system_type)) {
      return jsonResponse({ error: "system_type invalid" }, 400);
    }

    const { data: me, error: meError } = await adminClient
      .from("users")
      .select("company_id")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (meError || !me?.company_id) {
      return jsonResponse({ error: "company_id for current user not found" }, 403);
    }

    const company_id = me.company_id as string;

    if (depot_id) {
      const { data: depot, error: depotError } = await adminClient
        .from("depot")
        .select("id")
        .eq("id", depot_id)
        .eq("company_id", company_id)
        .maybeSingle();
      if (depotError) throw depotError;
      if (!depot) {
        return jsonResponse({ error: "depot_id gehört nicht zur Company" }, 400);
      }
    }

    const { data: existing, error: existingError } = await adminClient
      .from("system_integrations")
      .select("id, vault_secret_id, company_id")
      .eq("id", id)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing && existing.company_id !== company_id) {
      return jsonResponse({ error: "Integration gehört zu einer anderen Company" }, 403);
    }

    let vault_secret_id: string | null = existing?.vault_secret_id ?? null;
    let vault_action: "created" | "updated" | "unchanged" | "none" = "none";

    if (Object.keys(credentials).length > 0) {
      const secretPayload = JSON.stringify(credentials);
      const secretName = `integration_${id}`;
      const secretDescription = `Integration credentials (${system_type})`;

      if (vault_secret_id) {
        const { error: updateSecretError } = await adminClient.rpc(
          "update_integration_vault_secret",
          {
            p_secret_id: vault_secret_id,
            p_secret: secretPayload,
            p_name: secretName,
            p_description: secretDescription,
          },
        );
        if (updateSecretError) {
          console.error("Vault update failed:", updateSecretError);
          return jsonResponse({ error: "Vault-Secret konnte nicht aktualisiert werden" }, 500);
        }
        vault_action = "updated";
      } else {
        const { data: newSecretId, error: createSecretError } = await adminClient.rpc(
          "create_integration_vault_secret",
          {
            p_secret: secretPayload,
            p_name: secretName,
            p_description: secretDescription,
          },
        );
        if (createSecretError || !newSecretId) {
          console.error("Vault create failed:", createSecretError);
          return jsonResponse({ error: "Vault-Secret konnte nicht angelegt werden" }, 500);
        }
        vault_secret_id = newSecretId as string;
        vault_action = "created";
      }
    } else if (vault_secret_id) {
      vault_action = "unchanged";
    }

    const row = {
      id,
      company_id,
      depot_id,
      system_type,
      name,
      config,
      is_active,
      vault_secret_id,
      updated_at: new Date().toISOString(),
    };

    const { data: saved, error: upsertError } = await adminClient
      .from("system_integrations")
      .upsert(row, { onConflict: "id" })
      .select("id, company_id, depot_id, system_type, name, config, vault_secret_id, is_active, created_at, updated_at")
      .single();

    if (upsertError) throw upsertError;

    return jsonResponse({
      success: true,
      integration: saved,
      vault_action,
      // Never echo credentials back
    });
  } catch (error) {
    console.error("upsert-integration error:", error);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
