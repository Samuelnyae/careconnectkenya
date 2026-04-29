import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function pad(n: number) { return n < 10 ? "0" + n : "" + n; }
function timestamp() {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { phone, amount, reference, description } = await req.json();
    if (!phone || !amount) {
      return new Response(JSON.stringify({ error: "phone and amount required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");
    const shortcode = Deno.env.get("MPESA_SHORTCODE") ?? "174379";
    const passkey = Deno.env.get("MPESA_PASSKEY");
    const env = Deno.env.get("MPESA_ENV") ?? "sandbox"; // sandbox | production
    const callbackUrl = Deno.env.get("MPESA_CALLBACK_URL");

    if (!consumerKey || !consumerSecret || !passkey || !callbackUrl) {
      return new Response(JSON.stringify({ error: "M-Pesa secrets not configured (MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_PASSKEY, MPESA_CALLBACK_URL)" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const base = env === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";

    // 1. OAuth token
    const tokenResp = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: "Basic " + btoa(`${consumerKey}:${consumerSecret}`) },
    });
    if (!tokenResp.ok) {
      const t = await tokenResp.text();
      return new Response(JSON.stringify({ error: "Daraja auth failed", detail: t }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { access_token } = await tokenResp.json();

    // 2. STK Push
    const ts = timestamp();
    const password = btoa(`${shortcode}${passkey}${ts}`);
    // Normalize phone: 07... -> 2547..., +2547... -> 2547...
    let msisdn = String(phone).replace(/\D/g, "");
    if (msisdn.startsWith("0")) msisdn = "254" + msisdn.slice(1);
    if (msisdn.startsWith("254") === false && msisdn.length === 9) msisdn = "254" + msisdn;

    const stkBody = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: ts,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.round(Number(amount)),
      PartyA: msisdn,
      PartyB: shortcode,
      PhoneNumber: msisdn,
      CallBackURL: callbackUrl,
      AccountReference: reference || "Pharmacy",
      TransactionDesc: description || "POS Sale",
    };

    const stkResp = await fetch(`${base}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify(stkBody),
    });
    const result = await stkResp.json();
    if (!stkResp.ok) {
      return new Response(JSON.stringify({ error: "STK push failed", detail: result }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("mpesa-stk-push error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});