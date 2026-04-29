import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  try {
    const payload = await req.json();
    console.log("M-Pesa callback received:", JSON.stringify(payload));
    // TODO: persist receipt to a payments table once schema exists.
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("mpesa-callback error:", e);
    return new Response(JSON.stringify({ ResultCode: 1, ResultDesc: "Error" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
});