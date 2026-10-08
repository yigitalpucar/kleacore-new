import { describe, expect, it } from "vitest";
import { formatIban, ibanChecksumValid, normalizeIban, validateTrIban } from "./iban";

describe("validateTrIban", () => {
  it("accepts a valid Turkish IBAN with spaces and lowercase", () => {
    const result = validateTrIban("tr33 0006 1005 1978 6457 8413 26");
    expect(result).toEqual({ ok: true, iban: "TR330006100519786457841326" });
  });

  it("rejects a wrong check digit", () => {
    expect(validateTrIban("TR340006100519786457841326")).toEqual({
      ok: false,
      error: "IBAN kontrol basamakları hatalı",
    });
  });

  it("rejects a single changed account digit", () => {
    expect(validateTrIban("TR330006100519786457841327").ok).toBe(false);
  });

  it("rejects foreign and short IBANs", () => {
    expect(validateTrIban("DE89370400440532013000").ok).toBe(false);
    expect(validateTrIban("TR33000610051978645784132").ok).toBe(false);
  });

  it("checks other countries' checksums generically", () => {
    expect(ibanChecksumValid(normalizeIban("DE89 3704 0044 0532 0130 00"))).toBe(true);
  });
});

describe("formatIban", () => {
  it("groups by four", () => {
    expect(formatIban("TR330006100519786457841326")).toBe("TR33 0006 1005 1978 6457 8413 26");
  });
});
