import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function resolveCompanyId(type: string, context: Record<string, any>, supabase: ReturnType<typeof createClient>) {
  if ((type === "capacity" || type === "conflict") && context.tourId) {
    const { data } = await supabase
      .from("tour")
      .select("company_id")
      .eq("id", context.tourId)
      .maybeSingle();
    return data?.company_id ?? null;
  }

  const firstShipmentId = context.shipments?.find((shipment: { id?: string }) => shipment?.id)?.id;
  if (firstShipmentId) {
    const { data } = await supabase
      .from("shipment")
      .select("company_id")
      .eq("id", firstShipmentId)
      .maybeSingle();
    return data?.company_id ?? null;
  }

  return null;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { type, context = {}, apply = false } = body;

    if (!type) {
      return jsonResponse({ error: "type required" }, 400);
    }

    if (apply === true) {
      if (type === "unassigned" || type === "capacity") {
        const companyId = await resolveCompanyId(type, context, supabase);
        if (!companyId) {
          return jsonResponse({ error: "Keine Firma im Kontext — nichts geschrieben." }, 400);
        }
        const planResponse = await fetch(`${supabaseUrl}/functions/v1/plan-tour`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            company_id: companyId,
            force_replan: true,
            date: context.date,
          }),
        });
        const rawPlanResult = await planResponse.text();
        const planResult = rawPlanResult ? JSON.parse(rawPlanResult) : {};
        if (planResponse.ok && (planResult.success || planResult.tours != null)) {
          return jsonResponse({
            applied: true,
            message: `Neu geplant: ${planResult.tours ?? "?"} Touren, ${planResult.total_stops ?? "?"} Stops.`,
            actions: [],
            resolved: true,
            result: planResult,
          });
        }
        return jsonResponse({
          error: planResult.error ?? "plan-tour hat nichts geschrieben.",
          applied: false,
          result: planResult,
        }, planResponse.status === 422 ? 422 : 500);
      }

      if (type === "conflict") {
        const stopA = context.stopA as { id?: string; stop_index?: number } | undefined;
        const stopB = context.stopB as { id?: string; stop_index?: number } | undefined;
        if (!stopA?.id || !stopB?.id || stopA.stop_index == null || stopB.stop_index == null) {
          return jsonResponse({
            error: "Konflikt ohne Stop-IDs — nichts geschrieben. Bitte manuell neu planen.",
          }, 400);
        }
        const idxA = stopA.stop_index;
        const idxB = stopB.stop_index;
        const { error: e1 } = await supabase.from("tour_stop").update({ stop_index: 100000 + idxA }).eq("id", stopA.id);
        if (e1) throw e1;
        const { error: e2 } = await supabase.from("tour_stop").update({ stop_index: idxA }).eq("id", stopB.id);
        if (e2) throw e2;
        const { error: e3 } = await supabase.from("tour_stop").update({ stop_index: idxB }).eq("id", stopA.id);
        if (e3) throw e3;
        return jsonResponse({
          applied: true,
          message: `Stop-Reihenfolge getauscht (${idxA} ↔ ${idxB}).`,
          resolved: true,
        });
      }

      if (type === "absent") {
        const replacementId =
          typeof context.replacementDriverId === "string" ? context.replacementDriverId : "";
        const tourIds = Array.isArray(context.tourIds)
          ? context.tourIds.filter((id: unknown) => typeof id === "string")
          : [];
        if (!replacementId || tourIds.length === 0) {
          return jsonResponse({
            error: "Keine Vertretung oder keine Tour — nichts geschrieben.",
          }, 400);
        }
        const { error: upError } = await supabase
          .from("tour")
          .update({ driver_id: replacementId })
          .in("id", tourIds);
        if (upError) throw upError;
        return jsonResponse({
          applied: true,
          message: `Vertretung auf ${tourIds.length} Tour(en) geschrieben.`,
          resolved: true,
        });
      }

      return jsonResponse({
        error: `Typ ${type} kann nicht automatisch übernommen werden.`,
        applied: false,
      }, 400);
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    // Stable alias avoids hard failures when a dated model is retired for an API key/project.
    const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-flash-latest";

    let systemPrompt = "Du bist ein KI-Disponent für eine Spedition. Analysiere das Problem und gib eine strukturierte Lösung.";
    let userPrompt = "";

    switch (type) {
      case "unassigned": {
        userPrompt = `Es gibt ${context.shipments?.length ?? 0} Sendungen ohne Tourzuordnung am ${context.date}. Sendungen: ${JSON.stringify(context.shipments)}. Schlage vor, wie diese optimal auf bestehende oder neue Touren verteilt werden können.`;
        break;
      }
      case "capacity": {
        userPrompt = `Tour hat Kapazitätsüberschreitung: ${context.totalWeight}kg bei einem Fahrzeuglimit von ${context.vehicleCapacity}kg. Tour-ID: ${context.tourId}. Plane die Tour um, sodass das Gewichtslimit eingehalten wird. Welche Sendungen sollen auf eine andere Tour verschoben werden?`;
        break;
      }
      case "conflict": {
        userPrompt = `Zeitfensterkonflikt in einer Tour. Kontext: ${JSON.stringify(context)}. Analysiere mögliche Ursachen (Verkehr, Abladezeit, Reihenfolge) und schlage eine Lösung vor.`;
        break;
      }
      default: {
        userPrompt = `Problem-Typ: ${type}. Kontext: ${JSON.stringify(context)}. Analysiere und schlage eine Lösung vor.`;
      }
    }

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
              name: "resolve_problem",
              description: "Return the resolution for the logistics problem",
              parameters: {
                type: "object",
                properties: {
                  message: { type: "string", description: "Human-readable summary of the solution" },
                  actions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        action: {
                          type: "string",
                          enum: ["move_shipment", "create_tour", "reorder_stops", "assign_driver"],
                        },
                        details: { type: "string" },
                      },
                      required: ["action", "details"],
                    },
                  },
                },
                required: ["message", "actions"],
              },
            }],
          }],
          tool_config: {
            function_calling_config: {
              mode: "ANY",
              allowed_function_names: ["resolve_problem"],
            },
          },
        }),
      },
    );

    if (!aiResponse.ok) {
      const errBody = await aiResponse.json().catch(() => null);
      if (aiResponse.status === 429 || errBody?.error?.status === "RESOURCE_EXHAUSTED") {
        return jsonResponse({
          error: "KI-Ratenlimit erreicht. Bitte versuchen Sie es in einer Minute erneut.",
        }, 429);
      }
      console.error("Gemini API error:", aiResponse.status, errBody);
      const providerMessage =
        typeof errBody?.error?.message === "string" ? errBody.error.message : "Unbekannter Provider-Fehler";
      throw new Error(`Gemini API error ${aiResponse.status}: ${providerMessage}`);
    }

    const aiResult = await aiResponse.json();
    let resolution: {
      message: string;
      actions: Array<{ action: string; details: string }>;
      resolved: boolean;
      requires_manual: boolean;
    } = {
      message: "KI-Analyse abgeschlossen",
      actions: [],
      resolved: false,
      requires_manual: false,
    };

    try {
      const parts = aiResult.candidates?.[0]?.content?.parts ?? [];
      const functionCall = parts.find((p: { functionCall?: unknown }) => p.functionCall)?.functionCall;
      if (functionCall?.args && typeof functionCall.args === "object") {
        resolution = {
          ...resolution,
          ...functionCall.args,
        };
      } else {
        const textPart = parts.find((p: { text?: string }) => typeof p.text === "string")?.text;
        if (textPart) resolution.message = textPart;
      }
    } catch {
      resolution.message = "Analyse abgeschlossen";
    }

    if (type === "capacity") {
      resolution.resolved = false;
      resolution.requires_manual = true;
    }

    return jsonResponse({ ...resolution, applied: false });
  } catch (error) {
    console.error("ai-resolve error:", error);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
