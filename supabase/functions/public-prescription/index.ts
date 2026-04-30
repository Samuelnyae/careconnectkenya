// Public endpoint: returns a single prescription using a share token.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) throw new Error("Token required");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: delivery } = await admin
      .from("prescription_deliveries")
      .select("prescription_id, share_expires_at, tenant_id, patient_id")
      .eq("share_token", token)
      .maybeSingle();
    if (!delivery) return Response.json({ error: "Invalid link" }, { status: 404, headers: corsHeaders });
    if (delivery.share_expires_at && new Date(delivery.share_expires_at) < new Date()) {
      return Response.json({ error: "Link expired" }, { status: 410, headers: corsHeaders });
    }

    const { data: rx } = await admin
      .from("prescriptions")
      .select("drug_name, dosage, frequency, duration, instructions, created_at")
      .eq("id", delivery.prescription_id)
      .maybeSingle();
    const { data: patient } = await admin
      .from("patients").select("full_name").eq("id", delivery.patient_id).maybeSingle();
    const { data: tenant } = await admin
      .from("tenants").select("name").eq("id", delivery.tenant_id).maybeSingle();

    return Response.json({ rx, patient, tenant }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500, headers: corsHeaders });
  }
});