import { supabase } from "@/integrations/supabase/client";
import { listOutbox, removeOp, updateOp, type OutboxOp } from "./db";

export type SyncResult = { processed: number; failed: number };

let syncing = false;

export async function syncOutbox(tenant_id: string): Promise<SyncResult> {
  if (syncing) return { processed: 0, failed: 0 };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { processed: 0, failed: 0 };
  }
  syncing = true;
  let processed = 0;
  let failed = 0;
  try {
    const ops = await listOutbox(tenant_id);
    for (const op of ops) {
      try {
        await execute(op);
        if (op.id != null) await removeOp(op.id);
        processed++;
      } catch (err) {
        failed++;
        const updated: OutboxOp = {
          ...op,
          attempts: (op.attempts ?? 0) + 1,
          last_error: err instanceof Error ? err.message : String(err),
        };
        await updateOp(updated);
      }
    }
  } finally {
    syncing = false;
  }
  return { processed, failed };
}

async function execute(op: OutboxOp) {
  if (op.table === "sales") {
    const { data, error } = await supabase
      .from("sales")
      .insert(op.payload as never)
      .select("id")
      .single();
    if (error) throw error;
    if (op.children && data?.id) {
      const rows = op.children.rows.map((r) => ({ ...r, [op.children!.parentKey]: data.id }));
      const { error: e2 } = await supabase.from("sale_items").insert(rows as never);
      if (e2) throw e2;
    }
    return;
  }
  const { error } = await supabase.from(op.table).insert(op.payload as never);
  if (error) throw error;
}

export function attachSyncTriggers(tenant_id: string, onResult?: (r: SyncResult) => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => {
    void syncOutbox(tenant_id).then((r) => {
      if (r.processed || r.failed) onResult?.(r);
    });
  };
  window.addEventListener("online", handler);
  const interval = window.setInterval(handler, 60_000);
  // initial attempt
  handler();
  return () => {
    window.removeEventListener("online", handler);
    window.clearInterval(interval);
  };
}