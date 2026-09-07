import { describe, expect, it } from "vitest";
import {
  ageBand, ageFromDob, bpStatus, calcBmi, composeName, computePatientStats,
  duplicateScore, findDuplicates, followUpStatus, toCsv, waitMinutes,
} from "./patients";

const NOW = new Date("2026-09-06T12:00:00Z");

describe("ageFromDob", () => {
  it("computes whole years", () => expect(ageFromDob("1988-01-10", NOW)).toBe(38));
  it("handles birthday not yet reached", () => expect(ageFromDob("1988-12-10", NOW)).toBe(37));
  it("returns null for missing or invalid input", () => {
    expect(ageFromDob(null, NOW)).toBeNull();
    expect(ageFromDob("not-a-date", NOW)).toBeNull();
  });
});

describe("ageBand", () => {
  it("buckets ages", () => {
    expect(ageBand(2)).toBe("0-4");
    expect(ageBand(10)).toBe("5-14");
    expect(ageBand(30)).toBe("25-44");
    expect(ageBand(80)).toBe("65+");
    expect(ageBand(null)).toBe("unknown");
  });
});

describe("calcBmi", () => {
  it("rounds to one decimal", () => expect(calcBmi(72, 174)).toBe(23.8));
  it("rejects unusable values", () => {
    expect(calcBmi(0, 174)).toBeNull();
    expect(calcBmi(72, 0)).toBeNull();
    expect(calcBmi(null, null)).toBeNull();
  });
});

describe("bpStatus", () => {
  it("classifies readings", () => {
    expect(bpStatus(120, 80)).toBe("elevated");
    expect(bpStatus(118, 76)).toBe("normal");
    expect(bpStatus(150, 95)).toBe("high");
    expect(bpStatus(85, 55)).toBe("low");
    expect(bpStatus(null, 80)).toBe("unknown");
  });
});

describe("composeName", () => {
  it("joins parts and falls back", () => {
    expect(composeName({ first_name: "John", last_name: "Kamau" })).toBe("John Kamau");
    expect(composeName({}, "Mary Achieng")).toBe("Mary Achieng");
  });
});

describe("duplicate detection", () => {
  const existing = [
    { id: "1", full_name: "John Kamau", date_of_birth: "1988-01-10", phone: "0712345678", national_id: "12345678" },
    { id: "2", full_name: "Mary Achieng", date_of_birth: "1997-05-02", phone: "0722111222", national_id: null },
  ];
  it("flags identical name + phone", () => {
    expect(duplicateScore({ full_name: "john kamau", phone: "+254712345678" }, existing[0])).toBeGreaterThanOrEqual(90);
  });
  it("flags matching national ID alone", () => {
    expect(duplicateScore({ full_name: "J K", national_id: "12345678" }, existing[0])).toBeGreaterThanOrEqual(55);
  });
  it("ignores unrelated people", () => {
    expect(duplicateScore({ full_name: "Peter Otieno", phone: "0799000111" }, existing[0])).toBeLessThan(55);
  });
  it("returns ranked matches", () => {
    const hits = findDuplicates({ full_name: "John Kamau", date_of_birth: "1988-01-10" }, existing);
    expect(hits).toHaveLength(1);
    expect(hits[0].patient.id).toBe("1");
  });
});

describe("computePatientStats", () => {
  it("aggregates counts", () => {
    const stats = computePatientStats([
      { id: "1", full_name: "A", gender: "male", created_at: "2026-09-06T08:00:00Z", status: "active", date_of_birth: "1990-01-01", sha_number: "SHA1" },
      { id: "2", full_name: "B", gender: "female", created_at: "2026-09-02T08:00:00Z", status: "inactive", is_chronic: true },
      { id: "3", full_name: "C", gender: null, created_at: "2026-01-02T08:00:00Z", status: "active" },
    ], NOW);
    expect(stats.total).toBe(3);
    expect(stats.newToday).toBe(1);
    expect(stats.newThisWeek).toBe(2);
    expect(stats.newThisMonth).toBe(2);
    expect(stats.active).toBe(2);
    expect(stats.inactive).toBe(1);
    expect(stats.chronic).toBe(1);
    expect(stats.insured).toBe(1);
    expect(stats.selfPay).toBe(2);
    expect(stats.male).toBe(1);
    expect(stats.female).toBe(1);
    expect(stats.other).toBe(1);
    expect(stats.ageBands["25-44"]).toBe(1);
    expect(stats.ageBands.unknown).toBe(2);
  });
});

describe("queue + follow-ups", () => {
  it("computes wait minutes", () => expect(waitMinutes("2026-09-06T11:30:00Z", NOW)).toBe(30));
  it("derives follow-up status", () => {
    expect(followUpStatus("upcoming", "2026-09-06", NOW)).toBe("due_today");
    expect(followUpStatus("upcoming", "2026-09-01", NOW)).toBe("overdue");
    expect(followUpStatus("upcoming", "2026-09-20", NOW)).toBe("upcoming");
    expect(followUpStatus("completed", "2026-09-01", NOW)).toBe("completed");
  });
});

describe("toCsv", () => {
  it("escapes commas and quotes", () => {
    const csv = toCsv([{ name: 'Kamau, John "JK"', mrn: "HMS-0000001" }], ["name", "mrn"]);
    expect(csv).toBe('name,mrn\n"Kamau, John ""JK""",HMS-0000001');
  });
});
