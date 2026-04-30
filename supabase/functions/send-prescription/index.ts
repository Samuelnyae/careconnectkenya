// Generates a share token + delivery record for a prescription.
// If channel='sms' and AT_USERNAME/AT_API_KEY are set, sends via Africa's Talking.
// Otherwise records the delivery as 'pending_provider'.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { prescriptionId, channels, phone, appOrigin } = await req.json();
    const { data: rx, error: rxErr } = await supabase
      .from("prescriptions")
      .select("id, tenant_id, patient_id, drug_name, dosage, frequency, duration, instructions")
      .eq("id", prescriptionId)
      .maybeSingle();
    if (rxErr || !rx) throw new Error("Prescription not found");

    const { data: patient } = await supabase
      .from("patients").select("full_name, phone").eq("id", rx.patient_id).maybeSingle();

    const { data: { user } } = await supabase.auth.getUser();
    const results: Array<{ channel: string; status: string; share_url?: string; error?: string }> = [];

    for (const channel of channels as string[]) {
      const token = crypto.randomUUID().replace(/-/g, "");
      const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const shareUrl = `${appOrigin}/rx/${token}`;
      const destination = channel === "sms" ? (phone ?? patient?.phone ?? null) : null;

      let status: string = "sent";
      let errorMsg: string | null = null;

      if (channel === "sms") {
        const atUser = Deno.env.get("AT_USERNAME");
        const atKey = Deno.env.get("AT_API_KEY");
        const atSender = Deno.env.get("AT_SENDER_ID") ?? "";
        if (!destination) { status = "failed"; errorMsg = "No phone number"; }
        else if (!atUser || !atKey) { status = "pending_provider"; errorMsg = "SMS provider not configured"; }
        else {
          const msg = `Afya Cloud Rx for ${patient?.full_name ?? "you"}: ${rx.drug_name} ${rx.dosage ?? ""}. Details: ${shareUrl}`;
          const body = new URLSearchParams({ username: atUser, to: destination, message: msg });
          if (atSender) body.set("from", atSender);
          const r = await fetch("https://api.africastalking.com/version1/messaging", {
            method: "POST",
            headers: { apiKey: atKey, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
            body,
          });
          if (!r.ok) { status = "failed"; errorMsg = `AT ${r.status}`; }
        }
      }

      await admin.from("prescription_deliveries").insert({
        tenant_id: rx.tenant_id,
        prescription_id: rx.id,
        patient_id: rx.patient_id,
        channel,
        destination,
        status,
        share_token: token,
        share_expires_at: expires,
        sent_at: status === "sent" ? new Date().toISOString() : null,
        error_message: errorMsg,
        created_by: user?.id ?? null,
      });
      results.push({ channel, status, share_url: shareUrl, error: errorMsg ?? undefined });
    }

    return Response.json({ results }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500, headers: corsHeaders });
  }
});