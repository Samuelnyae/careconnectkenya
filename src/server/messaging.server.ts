// Server-only: send messages via Twilio (SMS + WhatsApp) and Telegram Bot API.
// Never import this file from browser/client code.

const TWILIO_GATEWAY = "https://connector-gateway.lovable.dev/twilio";
const TELEGRAM_GATEWAY = "https://connector-gateway.lovable.dev/telegram";

export type Channel = "sms" | "whatsapp" | "telegram";

export type SendTarget = {
  phone?: string | null;
  whatsapp?: string | null;
  telegram_chat_id?: string | null;
};

export type ChannelResult = { channel: Channel; ok: boolean; id?: string; error?: string };

function normalizePhone(p: string): string {
  const t = p.trim().replace(/\s+/g, "");
  if (t.startsWith("+")) return t;
  // Assume Kenya (+254) for local numbers starting with 0 or 7/1
  if (t.startsWith("0")) return "+254" + t.slice(1);
  if (/^\d{9,12}$/.test(t)) return "+" + t;
  return t;
}

async function sendTwilioSms(to: string, body: string): Promise<ChannelResult> {
  const apiKey = process.env.LOVABLE_API_KEY;
  const conn = process.env.TWILIO_API_KEY;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!apiKey || !conn) return { channel: "sms", ok: false, error: "Twilio not configured" };
  if (!from) return { channel: "sms", ok: false, error: "TWILIO_FROM_NUMBER not set" };

  const res = await fetch(`${TWILIO_GATEWAY}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "X-Connection-Api-Key": conn,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: normalizePhone(to), From: from, Body: body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { channel: "sms", ok: false, error: `[${res.status}] ${data?.message || JSON.stringify(data)}` };
  return { channel: "sms", ok: true, id: data?.sid };
}

async function sendTwilioWhatsApp(to: string, body: string): Promise<ChannelResult> {
  const apiKey = process.env.LOVABLE_API_KEY;
  const conn = process.env.TWILIO_API_KEY;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!apiKey || !conn) return { channel: "whatsapp", ok: false, error: "Twilio not configured" };
  if (!from) return { channel: "whatsapp", ok: false, error: "TWILIO_WHATSAPP_FROM not set" };

  const toNum = normalizePhone(to);
  const res = await fetch(`${TWILIO_GATEWAY}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "X-Connection-Api-Key": conn,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: toNum.startsWith("whatsapp:") ? toNum : `whatsapp:${toNum}`,
      From: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
      Body: body,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { channel: "whatsapp", ok: false, error: `[${res.status}] ${data?.message || JSON.stringify(data)}` };
  return { channel: "whatsapp", ok: true, id: data?.sid };
}

async function sendTelegram(chatId: string, body: string): Promise<ChannelResult> {
  const apiKey = process.env.LOVABLE_API_KEY;
  const conn = process.env.TELEGRAM_API_KEY;
  if (!apiKey || !conn) return { channel: "telegram", ok: false, error: "Telegram not connected" };

  const res = await fetch(`${TELEGRAM_GATEWAY}/sendMessage`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "X-Connection-Api-Key": conn,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ chat_id: chatId, text: body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { channel: "telegram", ok: false, error: `[${res.status}] ${data?.description || JSON.stringify(data)}` };
  return { channel: "telegram", ok: true, id: String(data?.result?.message_id ?? "") };
}

export async function sendOnChannels(
  target: SendTarget,
  channels: Channel[],
  message: string,
): Promise<ChannelResult[]> {
  const results: ChannelResult[] = [];
  for (const ch of channels) {
    if (ch === "sms") {
      if (!target.phone) { results.push({ channel: "sms", ok: false, error: "No phone on file" }); continue; }
      results.push(await sendTwilioSms(target.phone, message));
    } else if (ch === "whatsapp") {
      const num = target.whatsapp || target.phone;
      if (!num) { results.push({ channel: "whatsapp", ok: false, error: "No WhatsApp number on file" }); continue; }
      results.push(await sendTwilioWhatsApp(num, message));
    } else if (ch === "telegram") {
      if (!target.telegram_chat_id) { results.push({ channel: "telegram", ok: false, error: "Patient not enrolled on Telegram" }); continue; }
      results.push(await sendTelegram(target.telegram_chat_id, message));
    }
  }
  return results;
}