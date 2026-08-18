/**
 * research-article — KI-Webrecherche für unbekannte Artikelmaße.
 *
 * Provider-Strategie:
 * 1. Optional echte Websuche: SERPER_API_KEY oder TAVILY_API_KEY
 *    (Site-eingeschränkt über research_source-Integrationen, sonst allgemein)
 * 2. Extraktion/Strukturierung: GEMINI_API_KEY → Gemini generateContent (wie ai-resolve)
 * 3. Ohne Such-API: Gemini mit Branchen-URLs im Prompt (niedrigere confidence)
 *
 * Schreibt nie blind in `artikel` — nur Vorschläge; optional in shipment.missing_fields.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ArticleSuggestion = {
  name: string;
  length_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  weight_kg: number | null;
  quelle_url: string | null;
  confidence: number | null;
};

type SearchHit = { title: string; url: string; snippet: string };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function articleKey(name: string, artikelnummer?: string | null): string {
  const n = name.trim().toLowerCase();
  const a = (artikelnummer ?? "").trim().toLowerCase();
  return a ? `${a}::${n}` : n;
}

function hostnameFromUrl(raw: string): string | null {
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function extractPositionArticles(
  positionen: unknown,
): { name: string; artikelnummer: string | null }[] {
  if (!Array.isArray(positionen)) return [];
  const out: { name: string; artikelnummer: string | null }[] = [];
  for (const row of positionen) {
    if (typeof row === "string" && row.trim()) {
      out.push({ name: row.trim(), artikelnummer: null });
      continue;
    }
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const name = String(
      r.name ?? r.bezeichnung ?? r.artikel ?? r.artikelname ?? r.description ?? r.title ?? "",
    ).trim();
    if (!name) continue;
    const artikelnummer =
      String(r.artikelnummer ?? r.sku ?? r.artnr ?? r.article_number ?? r.nr ?? "").trim() || null;
    out.push({ name, artikelnummer });
  }
  return out;
}

async function searchSerper(query: string, apiKey: string): Promise<SearchHit[]> {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, num: 8, gl: "de", hl: "de" }),
  });
  if (!res.ok) {
    console.error("Serper error:", res.status, await res.text());
    return [];
  }
  const data = await res.json();
  const organic = Array.isArray(data.organic) ? data.organic : [];
  return organic.slice(0, 8).map((o: { title?: string; link?: string; snippet?: string }) => ({
    title: o.title ?? "",
    url: o.link ?? "",
    snippet: o.snippet ?? "",
  }));
}

async function searchTavily(query: string, apiKey: string): Promise<SearchHit[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      max_results: 8,
      include_answer: false,
    }),
  });
  if (!res.ok) {
    console.error("Tavily error:", res.status, await res.text());
    return [];
  }
  const data = await res.json();
  const results = Array.isArray(data.results) ? data.results : [];
  return results.slice(0, 8).map((r: { title?: string; url?: string; content?: string }) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    snippet: r.content ?? "",
  }));
}

async function webSearch(query: string): Promise<{ hits: SearchHit[]; provider: string | null }> {
  const serper = Deno.env.get("SERPER_API_KEY");
  if (serper) return { hits: await searchSerper(query, serper), provider: "serper" };
  const tavily = Deno.env.get("TAVILY_API_KEY");
  if (tavily) return { hits: await searchTavily(query, tavily), provider: "tavily" };
  return { hits: [], provider: null };
}

async function synthesizeWithGemini(params: {
  name: string;
  artikelnummer: string | null;
  sourceHosts: string[];
  hits: SearchHit[];
}): Promise<ArticleSuggestion> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not configured (benötigt für Maß-Extraktion)");
  }
  const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";

  const systemPrompt =
    "Du bist ein Logistik-Stammdaten-Assistent. Extrahiere Packmaße und Gewicht eines Artikels aus Suchtreffern oder Branchenwissen. " +
    "Erfinde keine präzisen Maße ohne Beleg. Wenn unsicher: null-Felder und niedrige confidence. " +
    "quelle_url muss eine konkrete URL aus den Treffern sein (oder eine der Branchen-Domains), nie eine erfundene URL.";

  const userPrompt = [
    `Artikel: ${params.name}`,
    params.artikelnummer ? `Artikelnummer: ${params.artikelnummer}` : null,
    params.sourceHosts.length
      ? `Bevorzugte Branchen-Domains: ${params.sourceHosts.join(", ")}`
      : "Keine Branchen-Domains hinterlegt — allgemeine Suche.",
    params.hits.length
      ? `Suchtreffer:\n${params.hits.map((h, i) => `${i + 1}. ${h.title}\n${h.url}\n${h.snippet}`).join("\n\n")}`
      : "Keine Suchtreffer verfügbar — nur vorsichtige Schätzung aus allgemeinem Produktwissen, confidence ≤ 0.35.",
    "Gib Länge/Breite/Höhe in mm und Gewicht in kg zurück.",
  ]
    .filter(Boolean)
    .join("\n");

  const aiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": GEMINI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        tools: [{
          function_declarations: [{
            name: "article_dimensions",
            description: "Structured packaging dimensions for the article",
            parameters: {
              type: "object",
              properties: {
                name: { type: "string" },
                length_mm: { type: "number", nullable: true },
                width_mm: { type: "number", nullable: true },
                height_mm: { type: "number", nullable: true },
                weight_kg: { type: "number", nullable: true },
                quelle_url: { type: "string", nullable: true },
                confidence: { type: "number", nullable: true, description: "0..1" },
              },
              required: ["name", "length_mm", "width_mm", "height_mm", "weight_kg", "quelle_url", "confidence"],
            },
          }],
        }],
        tool_config: {
          function_calling_config: {
            mode: "ANY",
            allowed_function_names: ["article_dimensions"],
          },
        },
      }),
    },
  );

  if (!aiResponse.ok) {
    const errBody = await aiResponse.json().catch(() => null);
    if (aiResponse.status === 429 || errBody?.error?.status === "RESOURCE_EXHAUSTED") {
      throw new Error("KI-Ratenlimit erreicht");
    }
    console.error("Gemini API error:", aiResponse.status, errBody);
    throw new Error(`Gemini API error: ${aiResponse.status}`);
  }

  const aiResult = await aiResponse.json();
  const parts = aiResult.candidates?.[0]?.content?.parts ?? [];
  const functionCall = parts.find((p: { functionCall?: unknown }) => p.functionCall)?.functionCall;
  const parsed = (functionCall?.args && typeof functionCall.args === "object"
    ? functionCall.args
    : null) as ArticleSuggestion | null;

  if (!parsed) {
    return {
      name: params.name,
      length_mm: null,
      width_mm: null,
      height_mm: null,
      weight_kg: null,
      quelle_url: params.hits[0]?.url ?? null,
      confidence: 0.1,
    };
  }

  let confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.3;
  if (!params.hits.length) confidence = Math.min(confidence, 0.35);

  return {
    name: parsed.name?.trim() || params.name,
    length_mm: numOrNull(parsed.length_mm),
    width_mm: numOrNull(parsed.width_mm),
    height_mm: numOrNull(parsed.height_mm),
    weight_kg: numOrNull(parsed.weight_kg),
    quelle_url: typeof parsed.quelle_url === "string" ? parsed.quelle_url : params.hits[0]?.url ?? null,
    confidence,
  };
}

function numOrNull(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v;
}

async function researchOne(params: {
  supabase: ReturnType<typeof createClient>;
  companyId: string;
  name: string;
  artikelnummer: string | null;
}): Promise<{ suggestion: ArticleSuggestion; search_provider: string | null; known: boolean }> {
  const { supabase, companyId, name, artikelnummer } = params;

  let knownQuery = supabase.from("artikel").select("id").eq("company_id", companyId).ilike("name", name);
  if (artikelnummer) {
    const { data: byNr } = await supabase
      .from("artikel")
      .select("id")
      .eq("company_id", companyId)
      .eq("artikelnummer", artikelnummer)
      .not("bestaetigt_am", "is", null)
      .limit(1);
    if (byNr?.length) {
      return {
        suggestion: {
          name,
          length_mm: null,
          width_mm: null,
          height_mm: null,
          weight_kg: null,
          quelle_url: null,
          confidence: 1,
        },
        search_provider: null,
        known: true,
      };
    }
  }

  const { data: byName } = await knownQuery.not("bestaetigt_am", "is", null).limit(1);
  if (byName?.length) {
    return {
      suggestion: {
        name,
        length_mm: null,
        width_mm: null,
        height_mm: null,
        weight_kg: null,
        quelle_url: null,
        confidence: 1,
      },
      search_provider: null,
      known: true,
    };
  }

  const { data: integrations } = await supabase
    .from("system_integrations")
    .select("config, name")
    .eq("company_id", companyId)
    .eq("system_type", "research_source")
    .eq("is_active", true);

  const sourceHosts: string[] = [];
  for (const integ of integrations ?? []) {
    const cfg = (integ.config ?? {}) as Record<string, unknown>;
    const base = typeof cfg.base_url === "string" ? cfg.base_url : "";
    const host = hostnameFromUrl(base);
    if (host) sourceHosts.push(host);
  }

  const queryParts = [name, artikelnummer].filter(Boolean);
  let hits: SearchHit[] = [];
  let search_provider: string | null = null;

  if (sourceHosts.length) {
    for (const host of sourceHosts.slice(0, 3)) {
      const q = `site:${host} ${queryParts.join(" ")} Maße Abmessungen Gewicht`;
      const result = await webSearch(q);
      search_provider = result.provider;
      hits.push(...result.hits);
      if (hits.length >= 4) break;
    }
  }

  if (hits.length < 2) {
    const q = `${queryParts.join(" ")} Verpackung Maße mm Gewicht kg`;
    const result = await webSearch(q);
    search_provider = search_provider ?? result.provider;
    hits.push(...result.hits);
  }

  // Dedup by URL
  const seen = new Set<string>();
  hits = hits.filter((h) => {
    if (!h.url || seen.has(h.url)) return false;
    seen.add(h.url);
    return true;
  });

  const suggestion = await synthesizeWithGemini({ name, artikelnummer, sourceHosts, hits });
  return { suggestion, search_provider, known: false };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const action = body.action ?? "research";

    const { data: companyIdRpc } = await userClient.rpc("get_user_company_id");
    const companyId = (body.company_id as string | undefined) ?? (companyIdRpc as string | null);
    if (!companyId) return jsonResponse({ error: "company_id required" }, 400);

    if (action === "research") {
      const name = String(body.name ?? body.article_name ?? "").trim();
      if (!name) return jsonResponse({ error: "name required" }, 400);
      const artikelnummer = body.artikelnummer ? String(body.artikelnummer).trim() : null;
      const shipmentId = body.shipment_id as string | undefined;

      const result = await researchOne({ supabase, companyId, name, artikelnummer });

      if (shipmentId && !result.known) {
        const { data: shipment } = await supabase
          .from("shipment")
          .select("id, company_id, missing_fields")
          .eq("id", shipmentId)
          .eq("company_id", companyId)
          .maybeSingle();

        if (shipment) {
          const mf =
            shipment.missing_fields && typeof shipment.missing_fields === "object"
              ? { ...(shipment.missing_fields as Record<string, unknown>) }
              : {};
          const list = Array.isArray(mf.unknown_articles) ? [...mf.unknown_articles] : [];
          const key = articleKey(name, artikelnummer);
          const idx = list.findIndex((x: { key?: string }) => x?.key === key);
          const entry = {
            key,
            name,
            artikelnummer,
            suggestion: result.suggestion,
            status: "pending",
          };
          if (idx >= 0) list[idx] = entry;
          else list.push(entry);
          mf.unknown_articles = list;
          await supabase.from("shipment").update({ missing_fields: mf }).eq("id", shipmentId);
        }
      }

      return jsonResponse(result);
    }

    if (action === "scan_shipment") {
      const shipmentId = body.shipment_id as string;
      if (!shipmentId) return jsonResponse({ error: "shipment_id required" }, 400);

      const { data: shipment, error: shipErr } = await supabase
        .from("shipment")
        .select("id, company_id, positionen, missing_fields")
        .eq("id", shipmentId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (shipErr || !shipment) return jsonResponse({ error: "Shipment not found" }, 404);

      const positions = extractPositionArticles(shipment.positionen);
      const mf =
        shipment.missing_fields && typeof shipment.missing_fields === "object"
          ? { ...(shipment.missing_fields as Record<string, unknown>) }
          : {};
      const list = Array.isArray(mf.unknown_articles) ? [...mf.unknown_articles] : [];
      const researched: unknown[] = [];

      for (const pos of positions) {
        const result = await researchOne({
          supabase,
          companyId,
          name: pos.name,
          artikelnummer: pos.artikelnummer,
        });
        if (result.known) continue;

        const key = articleKey(pos.name, pos.artikelnummer);
        const entry = {
          key,
          name: pos.name,
          artikelnummer: pos.artikelnummer,
          suggestion: result.suggestion,
          status: "pending",
        };
        const idx = list.findIndex((x: { key?: string }) => x?.key === key);
        if (idx >= 0) list[idx] = entry;
        else list.push(entry);
        researched.push(entry);
      }

      mf.unknown_articles = list;
      await supabase.from("shipment").update({ missing_fields: mf }).eq("id", shipmentId);

      return jsonResponse({
        scanned: positions.length,
        unknown: researched.length,
        unknown_articles: list.filter((x: { status?: string }) => x?.status === "pending"),
      });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("research-article error:", error);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
