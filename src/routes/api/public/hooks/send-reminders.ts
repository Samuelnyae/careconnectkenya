import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendOnChannels, type Channel } from "@/server/messaging.server";

function authorize(request: Request): Response | null {
  const expected = process.env['CRON_SECRET'];
  if (!expected) {
    return new Response(JSON.stringify({ ok: false, error: "Dispatcher not configured" }), { status: 503 });
  }
  const provided =
    request.headers.get("x-cron-secret") ??
    (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = new TextEncoder().encode(provided);
  const b = new TextEncoder().encode(expected);
  let same = a.length === b.length;
  for (let i = 0; i < b.length; i++) same = same && a[i] === b[i];
  if (!same) return new Response("Unauthorized", { status: 401 });
  return null;
}

export const Route = createFileRoute("/api/public/hooks/send-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = authorize(request);
        if (denied) return denied;

        const now = new Date().toISOString();

        // Pull pending reminders due now (limit batch).
        const { data: due, error } = await supabaseAdmin
          .from("reminders")
          .select("id, tenant_id, patient_id, message, channels, patients!inner(phone, whatsapp_number, telegram_chat_id)")
          .eq("status", "pending")
          .lte("scheduled_at", now)
          .limit(50);

        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
        }
        if (!due || due.length === 0) {
          return Response.json({ ok: true, processed: 0 });
        }

        let sent = 0, failed = 0;
        for (const r of due) {
          const p = (r as any).patients;
          const results = await sendOnChannels(
            { phone: p?.phone, whatsapp: p?.whatsapp_number, telegram_chat_id: p?.telegram_chat_id },
            ((r.channels as Channel[]) ?? ["sms"]),
            r.message,
          );
          const anyOk = results.some((x) => x.ok);
          if (anyOk) sent++; else failed++;
          await supabaseAdmin.from("reminders").update({
            status: anyOk ? "sent" : "failed",
            sent_at: anyOk ? new Date().toISOString() : null,
            delivery_log: { results },
            error_message: anyOk ? null : results.map((x) => `${x.channel}: ${x.error}`).join("; "),
          }).eq("id", r.id);
        }
        return Response.json({ ok: true, processed: due.length, sent, failed });
      },
      GET: async () => Response.json({ ok: true, message: "POST to trigger reminder dispatch" }),
    },
  },
});