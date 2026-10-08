import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { buildPaymentOptions, withoutMethod } from "./payment-options";
import type { ResolvedPaymentMethods } from "@/lib/integrations/payment-gateways/methods-config";

const resolved: ResolvedPaymentMethods = {
  available: ["kuveytturk", "paytr", "iyzico", "bank_transfer", "balance"],
  primaryCard: "kuveytturk",
  otherCards: ["paytr", "iyzico"],
  defaultMethod: "kuveytturk",
};

describe("buildPaymentOptions", () => {
  it("shows one card option for the default gateway and the rest as other card options", () => {
    const options = buildPaymentOptions(resolved, 250);
    expect(options.options.map((option) => [option.id, option.kind])).toEqual([
      ["kuveytturk", "card"],
      ["bank_transfer", "bank_transfer"],
      ["balance", "balance"],
    ]);
    expect(options.options[0].label).toBe("Kredi / banka kartı");
    expect(options.otherCards.map((option) => option.id)).toEqual(["paytr", "iyzico"]);
    expect(options.options[2].description).toContain("250");
  });

  it("drops balance and moves the default away from it", () => {
    const withoutBalance = withoutMethod({ ...resolved, defaultMethod: "balance" }, "balance");
    expect(withoutBalance.available).not.toContain("balance");
    expect(withoutBalance.defaultMethod).toBe("kuveytturk");
  });
});
