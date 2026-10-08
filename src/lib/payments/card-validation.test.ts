import { describe, expect, it } from "vitest";
import { formatCardNumber, formatExpiry, parseExpiry, passesLuhn, validateCard } from "./card-validation";

const NOW = new Date("2026-10-08T12:00:00Z");

describe("card validation", () => {
  it("checks Luhn", () => {
    expect(passesLuhn("5188961939192544")).toBe(true);
    expect(passesLuhn("4508034508034509")).toBe(true);
    expect(passesLuhn("5188961939192545")).toBe(false);
    expect(passesLuhn("12ab")).toBe(false);
  });

  it("masks input", () => {
    expect(formatCardNumber("5188961939192544")).toBe("5188 9619 3919 2544");
    expect(formatCardNumber("5188-96x19")).toBe("5188 9619");
    expect(formatCardNumber("378282246310005")).toBe("3782 822463 10005");
    expect(formatExpiry("0629")).toBe("06/29");
    expect(formatExpiry("1")).toBe("1");
  });

  it("accepts the current month and rejects past or invalid expiry", () => {
    expect(parseExpiry("10/26", NOW)).toEqual({ month: "10", year: "26" });
    expect(parseExpiry("09/26", NOW)).toBeNull();
    expect(parseExpiry("13/29", NOW)).toBeNull();
    expect(parseExpiry("06/2029", NOW)).toEqual({ month: "06", year: "29" });
  });

  it("validates a full card and reports each bad field", () => {
    expect(
      validateCard({ holderName: " Test  Kart ", number: "5188 9619 3919 2544", expiry: "06/29", cvv: "588" }, NOW)
    ).toEqual({
      ok: true,
      card: { holderName: "Test Kart", number: "5188961939192544", expireMonth: "06", expireYear: "29", cvv: "588" },
    });

    expect(validateCard({ holderName: "A1", number: "1234", expiry: "01/20", cvv: "5a8" }, NOW)).toEqual({
      ok: false,
      errors: ["holder", "number", "expiry", "cvv"],
    });
  });
});
