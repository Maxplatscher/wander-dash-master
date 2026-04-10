import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { type, context } = body;

    if (!type) {
      return new Response(JSON.stringify({ error: "type required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build prompt based on problem type
    let systemPrompt = "Du bist ein KI-Disponent für eine Spedition. Analysiere das Problem und gib eine strukturierte Lösung.";
    let userPrompt = "";

    switch (type) {
      case "unassigned": {
        userPrompt = `Es gibt ${context.shipments?.length ?? 0} Sendungen ohne Tourzuordnung am ${context.date}. Sendungen: ${JSON.stringify(context.shipments)}. Schlage vor, wie diese optimal auf bestehende oder neue Touren verteilt werden können.`;
        break;
      }
      case "capacity": {
        userPrompt = `Tour hat Kapazitätsüberschreitung: ${context.totalWeight}kg bei einem Fahrzeuglimit von ${context.vehicleCapacity}kg. Tour-ID: ${context.tourId}. Plane die Tour um, sodass das Gewichtslimit eingehalten wird. Welche Sendungen sollen auf eine andere Tour verschoben werden?`;
        
        // For capacity issues, also trigger automatic replan
        try {
          const planResponse = await fetch(`${supabaseUrl}/functions/v1/plan-tour`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              force_replan: true,
              date: context.date,
            }),
          });
          const planResult = await planResponse.json();
          if (planResult.success) {
            return new Response(JSON.stringify({
              message: `Kapazitätsproblem gelöst: ${planResult.tours} Touren mit ${planResult.total_stops} Stops neu geplant.`,
              result: planResult,
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } catch (e) {
          console.error("Auto-replan failed, falling back to AI analysis:", e);
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

    // Call Lovable AI Gateway
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
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
                      action: { type: "string", enum: ["move_shipment", "create_tour", "reorder_stops", "assign_driver"] },
                      details: { type: "string" },
                    },
                    required: ["action", "details"],
                  },
                },
              },
              required: ["message", "actions"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "resolve_problem" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "KI-Ratenlimit erreicht. Bitte versuchen Sie es in einer Minute erneut." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "KI-Guthaben aufgebraucht. Bitte laden Sie Ihr Guthaben auf." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    let resolution = { message: "KI-Analyse abgeschlossen", actions: [] };

    try {
      const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        resolution = JSON.parse(toolCall.function.arguments);
      }
    } catch {
      // Fallback to content
      resolution.message = aiResult.choices?.[0]?.message?.content ?? "Analyse abgeschlossen";
    }

    return new Response(JSON.stringify(resolution), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("ai-resolve error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
