import { describe, expect, it } from "vitest";
import {
  cartTotal,
  changeDue,
  daysUntil,
  isBalancedEntry,
  isExpiringSoon,
  isLowStock,
  lineSubtotal,
  round2,
  stockAfterSale,
} from "./billing";

describe("round2", () => {
  it("avoids floating point drift", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(1234.005)).toBe(1234.01);
  });
});

describe("lineSubtotal", () => {
  it("multiplies quantity by price", () => {
    expect(lineSubtotal({ qty: 3, unitPrice: 250 })).toBe(750);
  });
  it("accepts numeric strings from the database", () => {
    expect(lineSubtotal({ qty: 2, unitPrice: "199.50" })).toBe(399);
  });
  it("rejects invalid or negative input", () => {
    expect(lineSubtotal({ qty: 0, unitPrice: 100 })).toBe(0);
    expect(lineSubtotal({ qty: -2, unitPrice: 100 })).toBe(0);
    expect(lineSubtotal({ qty: 1, unitPrice: Number.NaN })).toBe(0);
  });
});

describe("cartTotal", () => {
  it("sums lines", () => {
    expect(cartTotal([{ qty: 2, unitPrice: 120.5 }, { qty: 1, unitPrice: 79.5 }])).toBe(320.5);
  });
  it("is zero for an empty cart", () => {
    expect(cartTotal([])).toBe(0);
  });
});

describe("changeDue", () => {
  it("returns the difference", () => {
    expect(changeDue(870, 1000)).toBe(130);
  });
  it("never goes negative on underpayment", () => {
    expect(changeDue(1000, 500)).toBe(0);
  });
});

describe("stock helpers", () => {
  it("flags low stock at or below reorder level", () => {
    expect(isLowStock(5, 10)).toBe(true);
    expect(isLowStock(10, 10)).toBe(true);
    expect(isLowStock(11, 10)).toBe(false);
  });
  it("never lets stock go negative", () => {
    expect(stockAfterSale(3, 10)).toBe(0);
    expect(stockAfterSale(10, 3)).toBe(7);
  });
});

describe("isBalancedEntry", () => {
  it("accepts a balanced non-zero entry", () => {
    expect(isBalancedEntry([{ debit: 1000, credit: 0 }, { debit: 0, credit: 1000 }])).toBe(true);
  });
  it("rejects unbalanced entries", () => {
    expect(isBalancedEntry([{ debit: 1000, credit: 0 }, { debit: 0, credit: 900 }])).toBe(false);
  });
  it("rejects an all-zero entry", () => {
    expect(isBalancedEntry([{ debit: 0, credit: 0 }])).toBe(false);
  });
});

describe("expiry helpers", () => {
  const now = new Date("2026-08-21T09:00:00Z");
  it("counts days until a date", () => {
    expect(daysUntil("2026-08-31", now)).toBe(10);
    expect(daysUntil("2026-08-11", now)).toBe(-10);
  });
  it("flags stock expiring within the window and already expired stock", () => {
    expect(isExpiringSoon("2026-09-30", 90, now)).toBe(true);
    expect(isExpiringSoon("2026-07-01", 90, now)).toBe(true);
    expect(isExpiringSoon("2027-06-01", 90, now)).toBe(false);
    expect(isExpiringSoon(null, 90, now)).toBe(false);
  });
});
