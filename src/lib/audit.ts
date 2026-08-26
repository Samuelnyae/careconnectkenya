import { supabase } from "@/integrations/supabase/client";

export type AuditAction =
  | "patient.view"
  | "patient.create"
  | "patient.update"
  | "record.search"
  | "lab_result.view"
  | "lab_result.create"
  | "prescription.create"
  | "prescription.dispense"
  | "message.send"
  | "claim.submit"
  | "export.data";

/** Field names that must never be written into the audit trail. */
const SENSITIVE_KEYS = [
  "national_id",
  "sha_number",
  "password",
  "token",
  "access_token",
  "phone",
  "whatsapp_number",
  "telegram_chat_id",
  "email",
  "notes",
  "diagnosis",
  "allergies",
];

/**
 * Strips personally identifying / clinical values out of audit metadata so the
 * trail records *what happened*, never a second copy of the patient's data.
 * Pure function — unit tested.
 */
export function redactMeta(meta: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!meta) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    const lower = key.toLowerCase();
    if (SENSITIVE_KEYS.some((s) => lower === s || lower.endsWith(`_${s}`))) {
      out[key] = "[redacted]";
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = redactMeta(value as Record<string, unknown>);
      continue;
    }
    if (typeof value === "string" && value.length > 200) {
      out[key] = `${value.slice(0, 200)}…`;
      continue;
    }
    out[key] = value;
  }
  return out;
}

type LogArgs = {
  tenantId: string | null | undefined;
  actorId: string | null | undefined;
  actorEmail?: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  meta?: Record<string, unknown>;
};

/**
 * Appends an audit entry. Never throws — a failed audit write must not break
 * clinical workflow, but it is logged to the console for monitoring.
 */
export async function logAudit(args: LogArgs): Promise<void> {
  if (!args.tenantId || !args.actorId) return;
  try {
    const { error } = await supabase.from("audit_logs").insert({
      tenant_id: args.tenantId,
      actor_id: args.actorId,
      actor_email: args.actorEmail ?? null,
      action: args.action,
      entity: args.entity,
      entity_id: args.entityId ?? null,
      meta: redactMeta(args.meta),
    });
    if (error) console.warn("audit write failed", error.message);
  } catch (e) {
    console.warn("audit write failed", e);
  }
}
