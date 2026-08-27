import { describe, expect, it } from "vitest";
import { redactMeta } from "./audit";

describe("redactMeta", () => {
  it("returns an empty object for missing meta", () => {
    expect(redactMeta(undefined)).toEqual({});
  });

  it("redacts identifiers and clinical fields", () => {
    expect(
      redactMeta({
        national_id: "12345678",
        sha_number: "SHA-99",
        phone: "+254700000000",
        diagnosis: "malaria",
        county: "Nakuru",
      }),
    ).toEqual({
      national_id: "[redacted]",
      sha_number: "[redacted]",
      phone: "[redacted]",
      diagnosis: "[redacted]",
      county: "Nakuru",
    });
  });

  it("redacts suffixed variants", () => {
    expect(redactMeta({ patient_phone: "0700", guardian_email: "a@b.c" })).toEqual({
      patient_phone: "[redacted]",
      guardian_email: "[redacted]",
    });
  });

  it("recurses into nested objects", () => {
    expect(redactMeta({ patient: { name: "Amina", national_id: "1" } })).toEqual({
      patient: { name: "Amina", national_id: "[redacted]" },
    });
  });

  it("truncates very long strings", () => {
    const out = redactMeta({ reason: "x".repeat(500) }).reason as string;
    expect(out.length).toBe(201);
    expect(out.endsWith("…")).toBe(true);
  });

  it("keeps safe scalars and arrays intact", () => {
    expect(redactMeta({ count: 3, ok: true, channels: ["sms", "whatsapp"] })).toEqual({
      count: 3,
      ok: true,
      channels: ["sms", "whatsapp"],
    });
  });
});
