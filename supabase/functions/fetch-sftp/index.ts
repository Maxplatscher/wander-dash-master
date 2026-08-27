import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import SftpClient from "npm:ssh2-sftp-client@9.0.4";
import { parseCsvShipments } from "../_shared/csv-import.ts";
import { assertPublicHostname, validateExternalUrl } from "../_shared/ssrf.ts";

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

function todayIsoDate(): string {
  return new Date().toISOString().split("T")[0];
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
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: role } = await userClient.rpc("get_my_role");
    if (role !== "admin" && role !== "dispatcher") {
      return json({ error: "Nur Disposition darf den Verkäuferordner abholen." }, 403);
    }
    const { data: companyId } = await userClient.rpc("get_user_company_id");
    if (!companyId) return json({ error: "Kein Unternehmen zugeordnet." }, 403);

    const body = await req.json().catch(() => ({}));
    const integrationId = typeof body.integration_id === "string" ? body.integration_id : "";
    if (!integrationId) return json({ error: "integration_id fehlt." }, 400);

    const { data: integration, error: intError } = await admin
      .from("system_integrations")
      .select("id, company_id, config, vault_secret_id, depot_id, system_type")
      .eq("id", integrationId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (intError) throw intError;
    if (!integration || integration.system_type !== "csv_import") {
      return json({ error: "Keine CSV/SFTP-Integration gefunden." }, 404);
    }

    const config = (integration.config ?? {}) as Record<string, string>;
    const host = (config.sftp_host ?? "").trim();
    const port = Number.parseInt(config.sftp_port || "22", 10) || 22;
    const remotePath = (config.remote_path ?? "/").trim() || "/";

    let secret: Record<string, string> = {};
    if (integration.vault_secret_id) {
      const { data: secretRow } = await admin
        .schema("vault")
        .from("decrypted_secrets")
        .select("decrypted_secret")
        .eq("id", integration.vault_secret_id)
        .maybeSingle();
      if (secretRow?.decrypted_secret) {
        secret = JSON.parse(secretRow.decrypted_secret) as Record<string, string>;
      }
    }

    const files: Array<{ name: string; text: string }> = [];
    if (/^https?:\/\//i.test(remotePath)) {
      const checked = validateExternalUrl(remotePath);
      if (!checked.ok) return json({ error: checked.reason }, 400);
      const response = await fetch(checked.url, { redirect: "error" });
      if (!response.ok) throw new Error(`HTTP ${response.status} beim CSV-Abruf.`);
      const length = Number(response.headers.get("content-length") ?? "0");
      if (length > 2_000_000) return json({ error: "CSV größer als 2 MB." }, 413);
      const text = await response.text();
      if (text.length > 2_000_000) return json({ error: "CSV größer als 2 MB." }, 413);
      files.push({ name: checked.url.pathname || remotePath, text });
    } else {
      const username = (secret.sftp_username ?? "").trim();
      const password = secret.sftp_password ?? "";
      if (!host || !username || !password) {
        return json({ error: "SFTP-Host oder Zugangsdaten fehlen." }, 400);
      }
      assertPublicHostname(host);
      if (port < 1 || port > 65535) return json({ error: "Ungültiger SFTP-Port." }, 400);
      const sftp = new SftpClient();
      await sftp.connect({ host, port, username, password, readyTimeout: 12_000 });
      try {
        const listing = await sftp.list(remotePath);
        const csvFiles = listing.filter((entry) =>
          entry.type === "-" && /\.csv$/i.test(entry.name),
        );
        for (const entry of csvFiles.slice(0, 20)) {
          const buf = await sftp.get(`${remotePath.replace(/\/$/, "")}/${entry.name}`);
          const text = typeof buf === "string" ? buf : new TextDecoder().decode(buf as Buffer);
          files.push({ name: entry.name, text });
        }
      } finally {
        await sftp.end();
      }
    }

    let created = 0;
    const fallbackDate = todayIsoDate();
    for (const file of files) {
      const rows = parseCsvShipments(file.text, fallbackDate);
      if (rows.length === 0) continue;
      const payload = rows.map((row) => ({
        company_id: companyId,
        name: row.name,
        customer_name: row.customer_name,
        delivery_address: row.delivery_address,
        weight_kg: row.weight_kg,
        service_date: row.service_date ?? fallbackDate,
        intake_source: "csv_import",
        intake_status: row.delivery_address ? "complete" : "new",
        depot_id: integration.depot_id,
        missing_fields: row.delivery_address ? {} : { needs_review: true },
      }));
      const { error: insertError } = await admin.from("shipment").insert(payload);
      if (insertError) throw insertError;
      created += payload.length;
    }

    return json({ success: true, files: files.length, created });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
