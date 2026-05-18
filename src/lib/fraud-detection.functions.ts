import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Schema = z.object({ tenantId: z.string().uuid() });

type Rx = {
  id: string;
  patient_id: string;
  drug_name: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  quantity: number | null;
  created_at: string;
  prescribed_by: string | null;
};

export const scanDuplicatePrescriptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Schema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // membership check
    const { data: m } = await supabase
      .from("memberships").select("id").eq("user_id", userId).eq("tenant_id", data.tenantId).maybeSingle();
    if (!m) throw new Error("Not a tenant member");

    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: rx, error } = await supabase
      .from("prescriptions")
      .select("id, patient_id, drug_name, dosage, frequency, duration, quantity, created_at, prescribed_by")
      .eq("tenant_id", data.tenantId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const list = (rx ?? []) as Rx[];
    if (list.length < 2) return { scanned: list.length, flagged: 0, flags: [] as Array<{ prescription_id: string; reason: string; severity: string }> };

    // Heuristic pass: identical drug + dose + patient within 14 days
    const flags: Array<{ prescription_id: string; reason: string; severity: "low" | "medium" | "high" | "critical"; details: Record<string, unknown> }> = [];
    const seen = new Map<string, Rx>();
    for (const r of list) {
      const key = `${r.patient_id}|${r.drug_name.toLowerCase()}|${(r.dosage ?? "").toLowerCase()}`;
      const prev = seen.get(key);
      if (prev) {
        const days = Math.abs(new Date(prev.created_at).getTime() - new Date(r.created_at).getTime()) / 86400000;
        if (days <= 14) {
          flags.push({
            prescription_id: r.id,
            reason: `Duplicate of ${prev.id} (same patient, drug, dose within ${Math.round(days)}d)`,
            severity: days <= 3 ? "high" : "medium",
            details: { duplicate_of: prev.id, days_apart: Math.round(days) },
          });
        }
      } else {
        seen.set(key, r);
      }
    }

    // Optional AI pass for cloned-language detection (Lovable AI)
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (LOVABLE_API_KEY && list.length <= 200) {
      try {
        const compact = list.map((r) => ({ id: r.id, p: r.patient_id, d: r.drug_name, ds: r.dosage, fq: r.frequency, du: r.duration, t: r.created_at }));
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "You audit prescriptions for cloned/duplicate/suspicious Rx. Only flag clear concerns. Return JSON." },
              { role: "user", content: `Find suspicious or cloned prescriptions in this JSON list. Output JSON: {flags:[{id,reason,severity:'low|medium|high|critical'}]}. Data:\n${JSON.stringify(compact)}` },
            ],
            response_format: { type: "json_object" },
          }),
        });
        if (resp.ok) {
          const j = await resp.json();
          const content = j.choices?.[0]?.message?.content ?? "{}";
          const parsed = JSON.parse(content) as { flags?: Array<{ id: string; reason: string; severity: string }> };
          for (const f of parsed.flags ?? []) {
            if (!flags.some((x) => x.prescription_id === f.id)) {
              flags.push({
                prescription_id: f.id,
                reason: `AI: ${f.reason}`,
                severity: (["low", "medium", "high", "critical"].includes(f.severity) ? f.severity : "medium") as "low" | "medium" | "high" | "critical",
                details: { source: "ai" },
              });
            }
          }
        }
      } catch (e) {
        console.error("AI fraud scan failed:", e);
      }
    }

    if (flags.length > 0) {
      // Avoid re-inserting open flags for same rx
      const ids = flags.map((f) => f.prescription_id);
      const { data: existing } = await supabase
        .from("rx_fraud_flags").select("prescription_id").eq("tenant_id", data.tenantId).in("prescription_id", ids).eq("status", "open");
      const existingSet = new Set((existing ?? []).map((e: { prescription_id: string }) => e.prescription_id));
      const fresh = flags.filter((f) => !existingSet.has(f.prescription_id));
      if (fresh.length > 0) {
        await supabase.from("rx_fraud_flags").insert(fresh.map((f) => ({
          tenant_id: data.tenantId,
          prescription_id: f.prescription_id,
          flag_type: "duplicate",
          severity: f.severity,
          reason: f.reason,
          details: f.details,
        })));
        // mark the Rx as flagged
        await supabase.from("prescriptions").update({ status: "flagged" }).in("id", fresh.map((f) => f.prescription_id));
      }
    }

    return { scanned: list.length, flagged: flags.length, flags };
  });