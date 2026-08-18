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
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { type, context = {} } = body;

    if (!type) {
      return jsonResponse({ error: "type required" }, 400);
    }

    let systemPrompt = "Du bist ein KI-Disponent für eine Spedition. Analysiere das Problem und gib eine strukturierte Lösung.";
    let userPrompt = "";

    switch (type) {
      case "unassigned": {
        userPrompt = `Es gibt ${context.shipments?.length ?? 0} Sendungen ohne Tourzuordnung am ${context.date}. Sendungen: ${JSON.stringify(context.shipments)}. Schlage vor, wie diese optimal auf bestehende oder neue Touren verteilt werden können.`;
        break;
      }
      case "capacity": {
        userPrompt = `Tour hat Kapazitätsüberschreitung: ${context.totalWeight}kg bei einem Fahrzeuglimit von ${context.vehicleCapacity}kg. Tour-ID: ${context.tourId}. Plane die Tour um, sodass das Gewichtslimit eingehalten wird. Welche Sendungen sollen auf eine andere Tour verschoben werden?`;

        try {
          const companyId = await resolveCompanyId(type, context, supabase);
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

          if (planResponse.ok && planResult.success) {
            return jsonResponse({
              message: `Kapazitätsproblem gelöst: ${planResult.tours} Touren mit ${planResult.total_stops} Stops neu geplant.`,
              actions: [],
              resolved: true,
              requires_manual: false,
              result: planResult,
            });
          }

          if (planResponse.status === 422) {
            return jsonResponse({
              message: planResult.error ?? "Kapazitätsproblem konnte nicht automatisch gelöst werden. Manueller Eingriff erforderlich.",
              actions: [],
              resolved: false,
              requires_manual: true,
              result: planResult,
            });
          }

          console.error("Auto-replan failed:", planResponse.status, rawPlanResult);
        } catch (error) {
          console.error("Auto-replan failed, falling back to AI analysis:", error);
        }
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
      throw new Error(`Gemini API error: ${aiResponse.status}`);
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

    return jsonResponse(resolution);
  } catch (error) {
    console.error("ai-resolve error:", error);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
