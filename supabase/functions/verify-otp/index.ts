// Verifies the OTP challenge issued by send-otp and creates / signs in a phone-based user.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { phone, code, challenge } = await req.json();
    if (!phone || !code || !challenge) throw new Error("Missing fields");

    const decoded = atob(challenge);
    const [expStr, sig] = decoded.split(".");
    const exp = Number(expStr);
    if (!exp || Date.now() > exp) throw new Error("Code expired");

    const secret = Deno.env.get("OTP_SIGNING_SECRET") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const expected = await hmac(secret, `${phone}.${code}.${exp}`);
    if (expected !== sig) throw new Error("Invalid code");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Synthesize a deterministic email from phone for password-less account
    const email = `${phone.replace(/\D/g, "")}@phone.afyacloud.local`;
    const password = `Otp!${crypto.randomUUID()}`;

    // Try to find existing user via listUsers + filter (small tenants)
    const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const found = existing?.users?.find((u) => u.email === email);

    if (!found) {
      const { error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, phone, user_metadata: { phone, registered_via: "phone_otp" },
      });
      if (error) throw error;
    } else {
      await admin.auth.admin.updateUserById(found.id, { password });
    }

    // Issue a session by signing in with that password
    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: sess, error: signErr } = await anon.auth.signInWithPassword({ email, password });
    if (signErr) throw signErr;

    return Response.json({ session: sess.session, user: sess.user }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400, headers: corsHeaders });
  }
});

async function hmac(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}