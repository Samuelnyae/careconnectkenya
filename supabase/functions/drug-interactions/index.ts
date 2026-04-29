import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { drugs, patientAllergies, patientConditions } = await req.json();
    if (!Array.isArray(drugs) || drugs.length === 0) {
      return new Response(JSON.stringify({ error: "drugs[] required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are a clinical pharmacist AI. Analyze the provided list of drugs for:
1. Drug-drug interactions (between any pair).
2. Drug-allergy conflicts (against patient allergies).
3. Drug-condition contraindications (against patient chronic conditions).

Respond ONLY by calling the report_interactions tool. Be concise but specific. Severity: "severe" (avoid combination), "moderate" (monitor closely), "mild" (informational).`;

    const userPrompt = `Drugs: ${drugs.join(", ")}
Patient allergies: ${patientAllergies || "none reported"}
Chronic conditions: ${patientConditions || "none reported"}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "report_interactions",
            description: "Return drug interaction analysis",
            parameters: {
              type: "object",
              properties: {
                overall_risk: { type: "string", enum: ["safe", "caution", "danger"] },
                summary: { type: "string" },
                interactions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["drug-drug", "allergy", "condition"] },
                      severity: { type: "string", enum: ["mild", "moderate", "severe"] },
                      drugs_involved: { type: "array", items: { type: "string" } },
                      description: { type: "string" },
                      recommendation: { type: "string" },
                    },
                    required: ["type", "severity", "drugs_involved", "description", "recommendation"],
                  },
                },
              },
              required: ["overall_risk", "summary", "interactions"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "report_interactions" } },
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded, try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (resp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in workspace settings." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await resp.text();
      console.error("AI gateway error:", resp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await resp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "No analysis returned" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const result = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("drug-interactions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});