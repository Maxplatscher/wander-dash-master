import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { ImapClient } from "../_shared/imap-client.ts";
import {
  fallbackMessageId,
  parseImapHeaders,
  previewFromBody,
  shipmentDraftFromMail,
} from "../_shared/imap-mail.ts";
import { isPrivateOrLoopback } from "../_shared/net-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_MAILS = 20;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseServiceDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
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

    const { data: role } = await userClient.rpc("get_my_role");
    if (role !== "admin" && role !== "dispatcher") {
      return jsonResponse({ error: "Nur Disposition darf Mails abrufen." }, 403);
    }

    const { data: rpcCompanyId, error: companyError } = await userClient.rpc("get_user_company_id");
    if (companyError || !rpcCompanyId) {
      return jsonResponse({ error: "Kein Unternehmen zugeordnet." }, 403);
    }
    const companyId = rpcCompanyId as string;

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const { data: imapIntegrations, error: integrationError } = await adminClient
      .from("system_integrations")
      .select("id, company_id, depot_id, system_type, name, config, vault_secret_id, is_active")
      .eq("company_id", companyId)
      .eq("system_type", "email_imap")
      .eq("is_active", true)
      .order("updated_at", { ascending: false });

    if (integrationError) throw integrationError;
    if (!imapIntegrations?.length) {
      return jsonResponse({ error: "Kein aktives IMAP-Konto in den Einstellungen." }, 400);
    }

    const serviceDate = parseServiceDate(body.date) ?? new Date().toISOString().slice(0, 10);
    const requestedDepotId = typeof body.depot_id === "string" && body.depot_id ? body.depot_id : null;

    let imported = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];
    const folders: string[] = [];

    for (const integration of imapIntegrations) {
      const config = (integration.config ?? {}) as Record<string, unknown>;
      const host = typeof config.host === "string" ? config.host.trim() : "";
      const folder = typeof config.folder === "string" && config.folder.trim()
        ? config.folder.trim()
        : "INBOX";
      const portRaw = typeof config.port === "string" ? Number(config.port) : Number(config.port);
      const port = Number.isFinite(portRaw) && portRaw > 0 ? portRaw : 993;

      if (!host) {
        errors.push(`${integration.name}: IMAP-Host fehlt`);
        failed += 1;
        continue;
      }
      if (isPrivateOrLoopback(host)) {
        errors.push(`${integration.name}: private IMAP-Adresse nicht erlaubt`);
        failed += 1;
        continue;
      }

      let depotId: string | null = requestedDepotId ?? (integration.depot_id as string | null);
      if (depotId) {
        const { data: depot, error: depotError } = await adminClient
          .from("depot")
          .select("id")
          .eq("id", depotId)
          .eq("company_id", companyId)
          .maybeSingle();
        if (depotError) throw depotError;
        if (!depot) {
          errors.push(`${integration.name}: depot_id gehört nicht zur Company`);
          failed += 1;
          continue;
        }
      }

      if (!integration.vault_secret_id) {
        errors.push(`${integration.name}: IMAP-Zugangsdaten fehlen`);
        failed += 1;
        continue;
      }

      const { data: secretRow, error: secretError } = await adminClient
        .schema("vault")
        .from("decrypted_secrets")
        .select("decrypted_secret")
        .eq("id", integration.vault_secret_id)
        .maybeSingle();

      if (secretError) {
        console.error("Vault read failed");
        errors.push(`${integration.name}: Vault-Secret unlesbar`);
        failed += 1;
        continue;
      }

      let credentials: Record<string, string> = {};
      try {
        const parsed = JSON.parse(secretRow?.decrypted_secret ?? "{}");
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          credentials = parsed as Record<string, string>;
        }
      } catch {
        errors.push(`${integration.name}: Zugangsdaten beschädigt`);
        failed += 1;
        continue;
      }

      const username = credentials.username?.trim() ?? "";
      const password = credentials.password ?? "";
      if (!username || !password) {
        errors.push(`${integration.name}: Benutzername oder Passwort fehlt`);
        failed += 1;
        continue;
      }

      let client: ImapClient | null = null;
      folders.push(folder);

      try {
        client = await ImapClient.connect(host, port);
        await client.login(username, password);
        await client.select(folder);
        const uids = (await client.uidSearchUnseen()).slice(0, MAX_MAILS);

        for (const uid of uids) {
          try {
            const fetched = await client.uidFetchPeek(uid);
            const headers = parseImapHeaders(fetched.header);
            const preview = previewFromBody(fetched.text);
            const messageId = (headers.messageId ?? fallbackMessageId(companyId, headers, preview)).slice(0, 900);

            const { data: existing } = await adminClient
              .from("email_log")
              .select("id, company_id")
              .eq("message_id", messageId)
              .maybeSingle();

            if (existing) {
              skipped += 1;
              await client.uidMarkSeen(uid);
              continue;
            }

            const draft = shipmentDraftFromMail({
              headers,
              preview,
              serviceDate,
              companyId,
              depotId,
              integrationId: integration.id as string,
            });

            const { data: shipment, error: shipmentError } = await adminClient
              .from("shipment")
              .insert(draft)
              .select("id")
              .single();

            if (shipmentError || !shipment) {
              throw shipmentError ?? new Error("Sendung konnte nicht angelegt werden");
            }

            const { error: logError } = await adminClient.from("email_log").insert({
              company_id: companyId,
              shipment_id: shipment.id,
              message_id: messageId,
              subject: headers.subject.slice(0, 500),
              from_addr: headers.from.slice(0, 500) || null,
              body_preview: preview.slice(0, 2000) || null,
              status: "imported",
              processed_at: new Date().toISOString(),
            });

            if (logError) {
              await adminClient.from("shipment").delete().eq("id", shipment.id).eq("company_id", companyId);
              if (logError.code === "23505") {
                skipped += 1;
                await client.uidMarkSeen(uid);
                continue;
              }
              throw logError;
            }

            await client.uidMarkSeen(uid);
            imported += 1;
          } catch (mailError) {
            failed += 1;
            const message = mailError instanceof Error ? mailError.message : "Mail konnte nicht verarbeitet werden";
            errors.push(`${integration.name} UID ${uid}: ${message}`);
            console.error("fetch-imap mail failed", uid);
          }
        }

        await client.logout();
        client = null;
        await adminClient
          .from("system_integrations")
          .update({ last_test_at: new Date().toISOString(), last_test_result: true })
          .eq("id", integration.id)
          .eq("company_id", companyId);
      } catch (accountError) {
        failed += 1;
        const message = accountError instanceof Error ? accountError.message : "IMAP fehlgeschlagen";
        errors.push(`${integration.name}: ${message}`);
      } finally {
        client?.close();
      }
    }

    return jsonResponse({
      success: failed === 0,
      imported,
      skipped,
      failed,
      scanned: imported + skipped + failed,
      date: serviceDate,
      folder: folders[0] ?? "INBOX",
      errors: errors.slice(0, 8),
    });
  } catch (error) {
    console.error("fetch-imap error");
    const message = error instanceof Error ? error.message : "Unknown error";
    const safe = /login|auth|credentials|password/i.test(message)
      ? "IMAP-Anmeldung fehlgeschlagen — Host, Benutzername und Passwort prüfen."
      : message;
    return jsonResponse({ error: safe }, 500);
  }
});
