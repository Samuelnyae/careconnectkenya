import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { callAIStructured, corsHeaders, jsonResponse } from "../_shared/ai.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { tenant_id } = await req.json();
    if (!tenant_id) return jsonResponse({ error: "tenant_id required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
    const { data: sales } = await supabase
      .from("sales")
      .select("id, total, payment_method, created_at, patient_id, customer_name")
      .eq("tenant_id", tenant_id)
      .gte("created_at", since)
      .limit(3000);

    // Aggregate per patient
    const byPatient: Record<string, { name: string; credit_count: number; credit_total: number; cash_count: number; last_credit: string | null }> = {};
    for (const s of sales ?? []) {
      const key = s.patient_id || s.customer_name || "anonymous";
      const isCredit = (s.payment_method || "").toLowerCase() === "credit";
      const slot = byPatient[key] || (byPatient[key] = { name: s.customer_name || key, credit_count: 0, credit_total: 0, cash_count: 0, last_credit: null });
      if (isCredit) {
        slot.credit_count += 1;
        slot.credit_total += Number(s.total || 0);
        if (!slot.last_credit || s.created_at > slot.last_credit) slot.last_credit = s.created_at;
      } else {
        slot.cash_count += 1;
      }
    }
    const candidates = Object.entries(byPatient)
      .filter(([, v]) => v.credit_count > 0)
      .map(([id, v]) => ({ id, ...v }));

    if (candidates.length === 0) return jsonResponse({ scores: [], summary: "No credit sales recorded." });

    const result = await callAIStructured({
      systemPrompt: "You are a credit-risk analyst for a community pharmacy. Score each patient/customer's likelihood of repaying based on credit history (count, total outstanding-style amount, recency, and ratio of credit-to-cash purchases). Higher cash ratio = lower risk. Many recent credits = higher risk.",
      userPrompt: `Score these ${candidates.length} customers with credit history:\n${JSON.stringify(candidates, null, 2)}`,
      toolName: "score_credit_risk",
      toolDescription: "Return per-customer credit risk score",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string" },
          scores: {
            type: "array",
            items: {
              type: "object",
              properties: {
                customer_id: { type: "string" },
                name: { type: "string" },
                risk: { type: "string", enum: ["low", "medium", "high"] },
                score: { type: "number", description: "0-100, higher = more risky" },
                rationale: { type: "string" },
                recommended_credit_limit_kes: { type: "number" },
              },
              required: ["customer_id", "name", "risk", "score", "rationale", "recommended_credit_limit_kes"],
            },
          },
        },
        required: ["summary", "scores"],
      },
    });
    return jsonResponse(result);
  } catch (e) {
    console.error("ai-credit-risk error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});