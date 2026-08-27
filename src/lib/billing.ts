/**
 * Pure money / stock helpers shared by POS, bookkeeping and inventory.
 * Kept free of React and Supabase so they can be unit tested.
 */

export type CartLine = { qty: number; unitPrice: number | string };

/** Rounds to 2 decimals without floating-point drift (KSh cents). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function lineSubtotal(line: CartLine): number {
  const qty = Number(line.qty);
  const price = Number(line.unitPrice);
  if (!Number.isFinite(qty) || !Number.isFinite(price) || qty <= 0 || price < 0) return 0;
  return round2(qty * price);
}

export function cartTotal(lines: CartLine[]): number {
  return round2(lines.reduce((sum, l) => sum + lineSubtotal(l), 0));
}

export function changeDue(total: number, amountPaid: number): number {
  return round2(Math.max(amountPaid - total, 0));
}

/** Stock is low when it has reached or fallen below the reorder level. */
export function isLowStock(stockQty: number, reorderLevel: number): boolean {
  return stockQty <= reorderLevel;
}

export function stockAfterSale(stockQty: number, quantity: number): number {
  return Math.max(stockQty - quantity, 0);
}

export type JournalLine = { debit: number; credit: number };

/** Mirrors the database rule: a postable entry must balance and be non-zero. */
export function isBalancedEntry(lines: JournalLine[]): boolean {
  const debit = round2(lines.reduce((s, l) => s + Number(l.debit || 0), 0));
  const credit = round2(lines.reduce((s, l) => s + Number(l.credit || 0), 0));
  return debit === credit && debit > 0;
}

/** Days until expiry; negative when already expired. */
export function daysUntil(dateIso: string, now: Date = new Date()): number {
  const target = new Date(`${dateIso}T00:00:00Z`).getTime();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - today) / 86_400_000);
}

export function isExpiringSoon(expiryDate: string | null, withinDays = 90, now: Date = new Date()): boolean {
  if (!expiryDate) return false;
  const d = daysUntil(expiryDate, now);
  return d <= withinDays;
}
