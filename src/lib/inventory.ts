// Pure inventory domain helpers — no React, no Supabase. Unit-testable.

export type StockStatus = "out" | "low" | "ok";
export type ExpiryStatus = "expired" | "critical" | "soon" | "ok" | "none";

export const MANAGE_ROLES = ["owner", "admin", "pharmacist"] as const;

export function canManageInventory(role: string | null | undefined): boolean {
  return !!role && (MANAGE_ROLES as readonly string[]).includes(role);
}

export function canApproveWrites(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

export function stockStatus(stockQty: number, reorderLevel: number): StockStatus {
  if (stockQty <= 0) return "out";
  if (stockQty <= reorderLevel) return "low";
  return "ok";
}

/** Days until expiry. Negative means already expired. */
export function daysUntil(date: string | null | undefined, now: Date = new Date()): number | null {
  if (!date) return null;
  const target = new Date(`${date.slice(0, 10)}T00:00:00Z`).getTime();
  if (Number.isNaN(target)) return null;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - today) / 86_400_000);
}

export function expiryStatus(date: string | null | undefined, now: Date = new Date()): ExpiryStatus {
  const d = daysUntil(date, now);
  if (d === null) return "none";
  if (d < 0) return "expired";
  if (d <= 30) return "critical";
  if (d <= 90) return "soon";
  return "ok";
}

export const EXPIRY_LABEL: Record<ExpiryStatus, string> = {
  expired: "Expired",
  critical: "Expires ≤30d",
  soon: "Expires ≤90d",
  ok: "In date",
  none: "No expiry",
};

/** Total retail value of stock on hand. */
export function stockValue(items: { stock_qty: number; unit_price: number | string }[]): number {
  return items.reduce((sum, i) => sum + i.stock_qty * Number(i.unit_price), 0);
}

/** Total cost value of stock on hand. */
export function stockCost(items: { stock_qty: number; cost_price: number | string }[]): number {
  return items.reduce((sum, i) => sum + i.stock_qty * Number(i.cost_price), 0);
}

export type MovementType =
  | "stock_in"
  | "stock_out"
  | "transfer"
  | "adjustment"
  | "return"
  | "disposal"
  | "dispense";

export const MOVEMENT_LABEL: Record<MovementType, string> = {
  stock_in: "Stock in",
  stock_out: "Stock out",
  transfer: "Transfer",
  adjustment: "Adjustment",
  return: "Return",
  disposal: "Disposal",
  dispense: "Dispensed",
};

/**
 * Signed quantity delta a movement applies to stock on hand.
 * `qty` is always entered as a positive number by the user, except
 * adjustments where the sign is meaningful.
 */
export function signedQuantity(type: MovementType, qty: number): number {
  const n = Math.abs(qty);
  switch (type) {
    case "stock_in":
    case "return":
      return n;
    case "stock_out":
    case "disposal":
    case "dispense":
      return -n;
    case "transfer":
      return 0; // location change only, net stock unchanged
    case "adjustment":
      return qty; // caller supplies +/-
  }
}

export function stockTakeVariance(systemQty: number, countedQty: number | null): number | null {
  if (countedQty === null || countedQty === undefined) return null;
  return countedQty - systemQty;
}

export function nextPoNumber(existing: string[], now: Date = new Date()): string {
  const prefix = `PO-${now.getUTCFullYear()}`;
  const max = existing
    .filter((n) => n.startsWith(prefix))
    .map((n) => Number(n.split("-")[2] ?? 0))
    .reduce((a, b) => (b > a ? b : a), 0);
  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}
