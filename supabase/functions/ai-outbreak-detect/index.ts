import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { callAIStructured, corsHeaders, jsonResponse } from "../_shared/ai.ts";
import { requireTenantMember } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { tenant_id } = await req.json();
    if (!tenant_id) return jsonResponse({ error: "tenant_id required" }, 400);

    const auth = await requireTenantMember(req, tenant_id);
    if (!auth.ok) return jsonResponse({ error: auth.error }, auth.status);


    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const { data: sales } = await supabase
      .from("sales")
      .select("id, created_at, sale_items(product_name, quantity)")
      .eq("tenant_id", tenant_id)
      .gte("created_at", since)
      .limit(2000);

    // Aggregate by product per week (last 8 weeks)
    const weekly: Record<string, Record<string, number>> = {};
    for (const s of sales ?? []) {
      const wk = new Date(s.created_at);
      wk.setHours(0,0,0,0);
      wk.setDate(wk.getDate() - wk.getDay());
      const key = wk.toISOString().slice(0,10);
      for (const item of (s as any).sale_items ?? []) {
        weekly[item.product_name] = weekly[item.product_name] || {};
        weekly[item.product_name][key] = (weekly[item.product_name][key] || 0) + (item.quantity || 0);
      }
    }

    const trends = Object.entries(weekly).map(([drug, byWeek]) => ({
      drug,
      weekly: Object.entries(byWeek).sort(([a],[b]) => a.localeCompare(b)).map(([wk, qty]) => ({ wk, qty })),
    })).filter((t) => t.weekly.length >= 2);

    if (trends.length === 0) return jsonResponse({ alerts: [], summary: "Not enough sales history yet." });

    const result = await callAIStructured({
      systemPrompt: "You are an epidemiologist analyzing pharmacy sales for early signs of disease outbreaks. Look for unusual spikes (>100% week-over-week) in symptomatic-treatment drugs (antimalarials, antibiotics, ORS, antipyretics, cough syrups, antidiarrheals, antihistamines). Correlate related drugs to suggest probable conditions. Be conservative — only flag real spikes.",
      userPrompt: `Weekly drug sales trends:\n${JSON.stringify(trends, null, 2)}`,
      toolName: "report_outbreak_signals",
      toolDescription: "Return outbreak early-warning signals",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string" },
          alerts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                suspected_condition: { type: "string" },
                drugs_spiking: { type: "array", items: { type: "string" } },
                spike_pct: { type: "number" },
                confidence: { type: "string", enum: ["low", "medium", "high"] },
                recommendation: { type: "string" },
              },
              required: ["suspected_condition", "drugs_spiking", "confidence", "recommendation"],
            },
          },
        },
        required: ["summary", "alerts"],
      },
    });
    return jsonResponse(result);
  } catch (e) {
    console.error("ai-outbreak-detect error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});