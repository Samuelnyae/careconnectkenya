import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export type OutboxOp = {
  id?: number;
  table: "patients" | "sales" | "patient_visits" | "reminders";
  payload: Record<string, unknown>;
  // For sales we need related items inserted after the sale row
  children?: { table: "sale_items"; rows: Record<string, unknown>[]; parentKey: string };
  tenant_id: string;
  created_at: number;
  attempts: number;
  last_error?: string;
};

interface CCDB extends DBSchema {
  outbox: { key: number; value: OutboxOp; indexes: { by_tenant: string } };
  cache_patients: { key: string; value: { tenant_id: string; data: unknown[]; updated_at: number } };
  cache_products: { key: string; value: { tenant_id: string; data: unknown[]; updated_at: number } };
}

let dbPromise: Promise<IDBPDatabase<CCDB>> | null = null;

export function getDB() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable on server"));
  }
  if (!dbPromise) {
    dbPromise = openDB<CCDB>("careconnect-offline", 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("outbox")) {
          const store = db.createObjectStore("outbox", { keyPath: "id", autoIncrement: true });
          store.createIndex("by_tenant", "tenant_id");
        }
        if (!db.objectStoreNames.contains("cache_patients")) {
          db.createObjectStore("cache_patients", { keyPath: "tenant_id" });
        }
        if (!db.objectStoreNames.contains("cache_products")) {
          db.createObjectStore("cache_products", { keyPath: "tenant_id" });
        }
      },
    });
  }
  return dbPromise;
}

export async function enqueue(op: Omit<OutboxOp, "id" | "created_at" | "attempts">) {
  const db = await getDB();
  await db.add("outbox", { ...op, created_at: Date.now(), attempts: 0 } as OutboxOp);
}

export async function listOutbox(tenant_id: string) {
  const db = await getDB();
  const all = await db.getAllFromIndex("outbox", "by_tenant", tenant_id);
  return all;
}

export async function removeOp(id: number) {
  const db = await getDB();
  await db.delete("outbox", id);
}

export async function updateOp(op: OutboxOp) {
  const db = await getDB();
  await db.put("outbox", op);
}

export async function cacheList(
  store: "cache_patients" | "cache_products",
  tenant_id: string,
  data: unknown[],
) {
  try {
    const db = await getDB();
    await db.put(store, { tenant_id, data, updated_at: Date.now() });
  } catch {
    /* ignore — cache is best-effort */
  }
}

export async function readCache(
  store: "cache_patients" | "cache_products",
  tenant_id: string,
): Promise<unknown[] | null> {
  try {
    const db = await getDB();
    const row = await db.get(store, tenant_id);
    return row?.data ?? null;
  } catch {
    return null;
  }
}