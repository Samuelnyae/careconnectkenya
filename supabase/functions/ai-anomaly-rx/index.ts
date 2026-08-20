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

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: rx } = await supabase
      .from("prescriptions")
      .select("id, drug_name, dosage, frequency, duration, instructions, created_at, patient_id, patients:patient_id(full_name, date_of_birth, allergies, chronic_conditions)")
      .eq("tenant_id", tenant_id)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(200);

    if (!rx || rx.length === 0) return jsonResponse({ anomalies: [], summary: "No prescriptions in the last 30 days." });

    const compact = rx.map((r: any) => ({
      id: r.id,
      drug: r.drug_name,
      dosage: r.dosage,
      frequency: r.frequency,
      duration: r.duration,
      patient: r.patients?.full_name,
      dob: r.patients?.date_of_birth,
      allergies: r.patients?.allergies,
      conditions: r.patients?.chronic_conditions,
    }));

    const result = await callAIStructured({
      systemPrompt: "You are a clinical pharmacist auditing prescriptions for anomalies: unusual dosages for age, suspiciously high quantities, conflicts with patient allergies/conditions, duplicate therapy, and missing critical info. Only flag genuine concerns.",
      userPrompt: `Audit these ${compact.length} recent prescriptions:\n${JSON.stringify(compact, null, 2)}`,
      toolName: "report_anomalies",
      toolDescription: "Return prescription anomalies",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string" },
          anomalies: {
            type: "array",
            items: {
              type: "object",
              properties: {
                prescription_id: { type: "string" },
                drug: { type: "string" },
                patient: { type: "string" },
                severity: { type: "string", enum: ["low", "medium", "high"] },
                issue: { type: "string" },
                recommendation: { type: "string" },
              },
              required: ["prescription_id", "drug", "severity", "issue", "recommendation"],
            },
          },
        },
        required: ["summary", "anomalies"],
      },
    });
    return jsonResponse(result);
  } catch (e) {
    console.error("ai-anomaly-rx error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});