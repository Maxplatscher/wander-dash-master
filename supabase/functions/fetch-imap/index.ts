import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { ImapClient } from "../_shared/imap-client.ts";
import {
  fallbackMessageId,
  parseImapHeaders,
  parseShipmentFieldsFromMail,
  previewFromBody,
} from "../_shared/imap-mail.ts";
import { assertPublicHostname } from "../_shared/ssrf.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
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

async function readVaultJson(
  admin: SupabaseClient,
  secretId: string | null,
): Promise<Record<string, string>> {
  if (!secretId) return {};
  const { data } = await admin.schema("vault").from("decrypted_secrets").select("decrypted_secret").eq("id", secretId).maybeSingle();
  if (!data?.decrypted_secret) return {};
  try {
    const parsed = JSON.parse(data.decrypted_secret);
    return parsed && typeof parsed === "object" ? parsed as Record<string, string> : {};
  } catch {
    return {};
  }
}

async function defaultDepotId(admin: SupabaseClient, companyId: string): Promise<string | null> {
  const { data } = await admin
    .from("depot")
    .select("id")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function fetchForIntegration(
  admin: SupabaseClient,
  integration: {
    id: string;
    company_id: string;
    name: string;
    config: Record<string, string> | null;
    vault_secret_id: string | null;
    depot_id: string | null;
  },
): Promise<{ fetched: number; created: number; skipped: number; error?: string }> {
  const config = integration.config ?? {};
  const host = (config.host ?? "").trim();
  const port = Number.parseInt(config.port || "993", 10) || 993;
  const folder = (config.folder ?? "INBOX").trim() || "INBOX";
  const creds = await readVaultJson(admin, integration.vault_secret_id);
  const user = (creds.username ?? "").trim();
  const password = creds.password ?? "";
  if (!host || !user || !password) {
    return { fetched: 0, created: 0, skipped: 0, error: "IMAP-Zugangsdaten unvollständig." };
  }
  try {
    assertPublicHostname(host);
  } catch (err) {
    return { fetched: 0, created: 0, skipped: 0, error: (err as Error).message };
  }
  if (port < 1 || port > 65535) {
    return { fetched: 0, created: 0, skipped: 0, error: "Ungültiger IMAP-Port." };
  }

  const client = new ImapClient(host, port);
  let fetched = 0;
  let created = 0;
  let skipped = 0;
  try {
    await client.connect();
    await client.login(user, password);
    await client.select(folder);
    const uids = await client.searchUnseen();
    const depotId = integration.depot_id ?? await defaultDepotId(admin, integration.company_id);
    const serviceDate = todayIsoDate();

    for (const uid of uids.slice(0, 50)) {
      fetched += 1;
      const raw = await client.fetchRfc822(uid);
      const split = raw.indexOf("\r\n\r\n");
      const headerRaw = split >= 0 ? raw.slice(0, split) : raw;
      const bodyRaw = split >= 0 ? raw.slice(split + 4) : "";
      const headers = parseImapHeaders(headerRaw);
      const preview = previewFromBody(bodyRaw);
      const fields = parseShipmentFieldsFromMail(headers.subject, preview);
      const messageId = headers.messageId ?? fallbackMessageId(integration.company_id, headers, preview);

      const { data: existing } = await admin
        .from("email_log")
        .select("id")
        .eq("message_id", messageId)
        .maybeSingle();
      if (existing) {
        skipped += 1;
        await client.markSeen(uid);
        continue;
      }

      const needsReview = !fields.delivery_address || !fields.customer_name;
      const { data: shipment, error: shipError } = await admin
        .from("shipment")
        .insert({
          company_id: integration.company_id,
          name: headers.subject.slice(0, 120),
          seller_email: headers.from || null,
          email_notes: preview.slice(0, 2000) || null,
          raw_email: preview.slice(0, 15000),
          email_received_at: new Date().toISOString(),
          intake_source: "email_imap",
          intake_status: needsReview ? "new" : "complete",
          service_date: serviceDate,
          depot_id: depotId,
          customer_name: fields.customer_name,
          delivery_address: fields.delivery_address,
          weight_kg: fields.weight_kg,
          missing_fields: needsReview ? { needs_review: true } : {},
        })
        .select("id")
        .single();
      if (shipError) throw shipError;

      await admin.from("email_log").insert({
        message_id: messageId,
        subject: headers.subject.slice(0, 500),
        from_addr: headers.from.slice(0, 500),
        status: "imported",
        company_id: integration.company_id,
        shipment_id: shipment.id,
        body_preview: preview.slice(0, 2000),
        processed_at: new Date().toISOString(),
      });
      await client.markSeen(uid);
      created += 1;
    }
  } finally {
    await client.logout();
  }
  return { fetched, created, skipped };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("ANON_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const cronSecret = Deno.env.get("IMAP_CRON_SECRET") ?? "";
    const admin = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("authorization") ?? "";
    const cronHeader = req.headers.get("x-cron-secret") ?? "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "");
    const isCron = Boolean(cronSecret) && (cronHeader === cronSecret || bearer === cronSecret);

    let companyId: string | null = null;
    if (!isCron) {
      if (!authHeader) return json({ error: "Anmeldung erforderlich." }, 401);
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: role } = await userClient.rpc("get_my_role");
      if (role !== "admin" && role !== "dispatcher") {
        return json({ error: "Nur Disposition darf Mails abrufen." }, 403);
      }
      const { data: cid } = await userClient.rpc("get_user_company_id");
      companyId = (cid as string | null) ?? null;
      if (!companyId) return json({ error: "Kein Unternehmen zugeordnet." }, 403);
    }

    let query = admin
      .from("system_integrations")
      .select("id, company_id, name, config, vault_secret_id, depot_id, is_active")
      .eq("system_type", "email_imap")
      .eq("is_active", true);
    if (companyId) query = query.eq("company_id", companyId);
    const { data: integrations, error } = await query;
    if (error) throw error;

    const results = [];
    for (const row of integrations ?? []) {
      try {
        results.push({
          integration_id: row.id,
          name: row.name,
          ...(await fetchForIntegration(admin, {
            ...row,
            config: (row.config ?? {}) as Record<string, string>,
          })),
        });
      } catch (err) {
        results.push({
          integration_id: row.id,
          name: row.name,
          fetched: 0,
          created: 0,
          skipped: 0,
          error: (err as Error).message,
        });
      }
    }

    return json({
      success: true,
      cron: isCron,
      results,
      created: results.reduce((sum, row) => sum + (row.created ?? 0), 0),
    });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
