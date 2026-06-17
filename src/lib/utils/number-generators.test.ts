import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateAffiliateCode,
  generateInvoiceNumber,
  generateOrderNumber,
  generateTicketNumber,
} from "./number-generators";

describe("number generators", () => {
  beforeEach(() => {
    vi.spyOn(Date.prototype, "getFullYear").mockReturnValue(2026);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("generates order numbers with year and five-digit suffix", () => {
    expect(generateOrderNumber()).toBe("S-2026-55000");
  });

  it("generates invoice numbers with year and four-digit suffix", () => {
    expect(generateInvoiceNumber()).toBe("F-2026-5500");
  });

  it("generates ticket numbers with six-digit suffix", () => {
    expect(generateTicketNumber()).toBe("T-550000");
  });

  it("generates affiliate codes from name slug and three-digit suffix", () => {
    expect(generateAffiliateCode("Alice Smith")).toBe("alices550");
    expect(generateAffiliateCode("B0b!")).toBe("b0b550");
  });

  it("truncates long names to six alphanumeric characters", () => {
    expect(generateAffiliateCode("Christopher")).toBe("christ550");
  });
});