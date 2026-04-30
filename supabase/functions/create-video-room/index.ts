// Creates a video consultation room. Uses Daily.co if DAILY_API_KEY is set,
// otherwise falls back to a public Jitsi room (no key required).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { appointmentId, patientName } = await req.json();
    const slug = `afya-${(appointmentId ?? crypto.randomUUID()).slice(0, 8)}-${Date.now().toString(36)}`;
    const dailyKey = Deno.env.get("DAILY_API_KEY");

    if (dailyKey) {
      const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 4; // 4h
      const r = await fetch("https://api.daily.co/v1/rooms", {
        method: "POST",
        headers: { Authorization: `Bearer ${dailyKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: slug,
          privacy: "public",
          properties: { exp, enable_chat: true, enable_screenshare: true, start_video_off: false },
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Daily API error");
      return Response.json(
        { provider: "daily", url: data.url, name: data.name },
        { headers: corsHeaders },
      );
    }

    // Fallback: Jitsi public room
    const name = `AfyaCloud-${slug}`;
    const url = `https://meet.jit.si/${name}#userInfo.displayName=%22${encodeURIComponent(patientName ?? "Patient")}%22`;
    return Response.json({ provider: "jitsi", url, name }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500, headers: corsHeaders });
  }
});