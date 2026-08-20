import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendOnChannels, type Channel } from "./messaging.server";

const SendNowSchema = z.object({
  reminderId: z.string().uuid(),
});

export const sendReminderNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SendNowSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: r, error } = await supabase
      .from("reminders")
      .select("id, tenant_id, patient_id, message, channels, status, patients!inner(phone, whatsapp_number, telegram_chat_id, full_name)")
      .eq("id", data.reminderId)
      .single();
    if (error || !r) throw new Error(error?.message || "Reminder not found");

    const patient = (r as any).patients;
    const results = await sendOnChannels(
      { phone: patient.phone, whatsapp: patient.whatsapp_number, telegram_chat_id: patient.telegram_chat_id },
      (r.channels as Channel[]) ?? ["sms"],
      r.message,
    );
    const anyOk = results.some((x) => x.ok);
    await supabase.from("reminders").update({
      status: anyOk ? "sent" : "failed",
      sent_at: anyOk ? new Date().toISOString() : null,
      delivery_log: { results },
      error_message: anyOk ? null : results.map((x) => `${x.channel}: ${x.error}`).join("; "),
    }).eq("id", r.id);
    return { ok: anyOk, results };
  });

const QuickSendSchema = z.object({
  patientId: z.string().uuid(),
  message: z.string().min(1).max(1000),
  channels: z.array(z.enum(["sms", "whatsapp", "telegram"])).min(1),
});

export const sendQuickMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => QuickSendSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: p, error } = await supabase
      .from("patients")
      .select("id, tenant_id, phone, whatsapp_number, telegram_chat_id")
      .eq("id", data.patientId)
      .single();
    if (error || !p) throw new Error("Patient not found");

    const results = await sendOnChannels(
      { phone: p.phone, whatsapp: p.whatsapp_number, telegram_chat_id: p.telegram_chat_id },
      data.channels,
      data.message,
    );
    const anyOk = results.some((x) => x.ok);
    // Log as a sent reminder for audit
    await supabase.from("reminders").insert({
      tenant_id: p.tenant_id,
      patient_id: p.id,
      reminder_type: "custom",
      message: data.message,
      channels: data.channels,
      scheduled_at: new Date().toISOString(),
      sent_at: anyOk ? new Date().toISOString() : null,
      status: anyOk ? "sent" : "failed",
      delivery_log: { results },
      error_message: anyOk ? null : results.map((x) => `${x.channel}: ${x.error}`).join("; "),
    });
    return { ok: anyOk, results };
  });