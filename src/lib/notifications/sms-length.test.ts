import { describe, expect, it } from "vitest";
import { smsLength } from "./sms-length";

describe("smsLength", () => {
  it("counts GSM-7 messages at 160 / 306", () => {
    expect(smsLength("a".repeat(160))).toMatchObject({ encoding: "GSM-7", segments: 1, limit: 160 });
    expect(smsLength("a".repeat(161))).toMatchObject({ encoding: "GSM-7", segments: 2, limit: 306 });
    // Extended characters count twice.
    expect(smsLength("€".repeat(80))).toMatchObject({ length: 160, segments: 1 });
  });

  it("switches to UCS-2 (70 / 134) for Turkish-only letters", () => {
    expect(smsLength("Ödeme alındı")).toMatchObject({ encoding: "UCS-2", segments: 1, limit: 70, unicodeChars: ["ı"] });
    expect(smsLength("ş".repeat(71))).toMatchObject({ encoding: "UCS-2", segments: 2, limit: 134 });
    // Ç, Ö, Ü, ö, ü are in the GSM alphabet.
    expect(smsLength("ÇÖÜöü")).toMatchObject({ encoding: "GSM-7" });
  });
});
