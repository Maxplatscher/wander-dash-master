import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type TestResult = {
  success: boolean;
  message: string;
  latency_ms?: number;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// SSRF-Schutz: blockiert Loopback, Link-Local, private Netze und Cloud-Metadata-Endpoints.
function isPrivateOrLoopback(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (lower === "localhost" || lower === "127.0.0.1" || lower === "::1") return true;
  if (lower === "169.254.169.254") return true; // AWS/GCP Metadata
  if (lower === "metadata.google.internal") return true;
  if (lower === "metadata") return true;

  const ipv4 = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = parseInt(ipv4[1], 10);
    const b = parseInt(ipv4[2], 10);
    if (a === 0) return true;             // 0.0.0.0/8
    if (a === 10) return true;            // 10.0.0.0/8
    if (a === 127) return true;           // Loopback
    if (a === 169 && b === 254) return true; // Link-Local
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a >= 224) return true;            // Multicast / reserviert
  }

  // Einfacher IPv6-Private-Check (fc00::/7, fe80::/10)
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true;

  return false;
}

function validateExternalUrl(input: string): { ok: true; url: URL } | { ok: false; reason: string } {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return { ok: false, reason: "Ungültige URL" };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, reason: `Protokoll ${parsed.protocol} nicht erlaubt – nur http(s)` };
  }
  if (!parsed.hostname) {
    return { ok: false, reason: "Hostname fehlt" };
  }
  if (isPrivateOrLoopback(parsed.hostname)) {
    return { ok: false, reason: "Private oder lokale Adressen sind aus Sicherheitsgründen nicht erlaubt" };
  }
  return { ok: true, url: parsed };
}

function describeHttpStatus(status: number): { success: boolean; message: string } {
  if (status >= 200 && status < 300) {
    return { success: true, message: `Verbindung erfolgreich (HTTP ${status})` };
  }
  if (status === 401) {
    return { success: false, message: "Authentifizierung fehlgeschlagen (HTTP 401) – Credentials prüfen" };
  }
  if (status === 403) {
    return { success: false, message: "Zugriff verweigert (HTTP 403) – Berechtigungen prüfen" };
  }
  if (status === 404) {
    return { success: false, message: "Endpoint nicht gefunden (HTTP 404) – base_url prüfen" };
  }
  if (status === 405) {
    return { success: false, message: "Test-Methode nicht erlaubt (HTTP 405) – Server antwortet, blockiert aber HEAD" };
  }
  if (status === 429) {
    return { success: false, message: "Rate-Limit erreicht (HTTP 429)" };
  }
  if (status >= 500) {
    return { success: false, message: `Server-Fehler (HTTP ${status})` };
  }
  if (status >= 300 && status < 400) {
    return { success: false, message: `Redirect ohne Ziel-Auflösung (HTTP ${status})` };
  }
  return { success: false, message: `Unerwarteter Status (HTTP ${status})` };
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

    const requestBody = await req.json();
    const integrationId = requestBody?.integration_id as string | undefined;
    if (!integrationId) {
      return jsonResponse({ error: "integration_id required" }, 400);
    }

    const { data: me, error: meError } = await adminClient
      .from("users")
      .select("company_id")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (meError || !me?.company_id) {
      return jsonResponse({ error: "company_id for current user not found" }, 403);
    }

    const { data: integration, error: integrationError } = await adminClient
      .from("system_integrations")
      .select("id, company_id, system_type, name, config, vault_secret_id")
      .eq("id", integrationId)
      .eq("company_id", me.company_id)
      .maybeSingle();

    if (integrationError) throw integrationError;
    if (!integration) {
      return jsonResponse({ error: "Integration not found" }, 404);
    }

    let credentials: Record<string, string> = {};
    let credentialsCorrupted = false;
    if (integration.vault_secret_id) {
      const { data: secretRow, error: secretError } = await adminClient
        .schema("vault")
        .from("decrypted_secrets")
        .select("decrypted_secret")
        .eq("id", integration.vault_secret_id)
        .maybeSingle();

      if (secretError) {
        console.error("Vault read failed:", secretError);
        return jsonResponse({ error: "Vault-Secret konnte nicht gelesen werden" }, 500);
      }

      if (secretRow?.decrypted_secret) {
        try {
          const parsed = JSON.parse(secretRow.decrypted_secret);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            credentials = parsed as Record<string, string>;
          } else {
            credentialsCorrupted = true;
          }
        } catch (parseError) {
          // Korrupter Vault-Inhalt: Test darf nicht heimlich ohne Auth durchlaufen.
          console.error("Vault secret JSON parse failed:", parseError);
          credentialsCorrupted = true;
        }
      }
    }

    if (credentialsCorrupted) {
      const corruptedResult: TestResult = {
        success: false,
        message: "Gespeicherte Zugangsdaten sind beschädigt – bitte Integration neu speichern",
      };
      await adminClient
        .from("system_integrations")
        .update({
          last_test_at: new Date().toISOString(),
          last_test_result: false,
          last_test_message: corruptedResult.message,
          last_test_latency_ms: null,
        })
        .eq("id", integration.id)
        .eq("company_id", me.company_id);
      return jsonResponse(corruptedResult);
    }

    let result: TestResult;
    const start = Date.now();

    if (integration.system_type === "rest_api" || integration.system_type === "research_source") {
      const config = (integration.config ?? {}) as Record<string, string>;
      const rawUrl = config.base_url;
      if (!rawUrl) {
        result = { success: false, message: "Keine base_url konfiguriert" };
      } else {
        const validation = validateExternalUrl(rawUrl);
        if (!validation.ok) {
          result = { success: false, message: validation.reason };
        } else {
          try {
            const headers: Record<string, string> = {};
            if (credentials.auth_header) headers.Authorization = credentials.auth_header;
            const response = await fetch(validation.url, {
              method: "HEAD",
              headers,
              redirect: "manual", // SSRF-Schutz: keine Redirects in interne Netze
              signal: AbortSignal.timeout(5000),
            });
            const desc = describeHttpStatus(response.status);
            result = {
              success: desc.success,
              message:
                integration.system_type === "research_source"
                  ? `Recherchequelle erreichbar — ${desc.message}`
                  : desc.message,
              latency_ms: Date.now() - start,
            };
          } catch (error) {
            // Generische Fehlermeldung – keine internen Details (Pfade, Stacks) leaken
            const isTimeout = error instanceof Error && error.name === "TimeoutError";
            result = {
              success: false,
              message: isTimeout ? "Zeitüberschreitung (5s) – Server nicht erreichbar" : "Verbindung fehlgeschlagen",
            };
          }
        }
      }
    } else {
      result = {
        success: true,
        message: `Konfiguration gespeichert – Vollständiger Test für ${integration.system_type.toUpperCase()} wird in Phase 3+ erweitert`,
      };
    }

    await adminClient
      .from("system_integrations")
      .update({
        last_test_at: new Date().toISOString(),
        last_test_result: result.success,
        last_test_message: result.message,
        last_test_latency_ms: result.latency_ms ?? null,
      })
      .eq("id", integration.id)
      .eq("company_id", me.company_id);

    return jsonResponse(result);
  } catch (error) {
    console.error("test-integration error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
