import { describe, expect, it } from "vitest";
import {
  PAYMENT_METHOD_IDS,
  deriveFromLegacySettings,
  normalizePaymentMethodsSettings,
  parsePaymentMethodsSetting,
  paymentRecordMethod,
  resolvePaymentMethods,
  resolveRequestedMethod,
  serializePaymentMethodsSettings,
  type MethodAvailability,
} from "./methods-config";

const allConfigured: MethodAvailability = {
  kuveytturk: true,
  paytr: true,
  iyzico: true,
  bank_transfer: true,
  balance: true,
  stripe: true,
};

const legacy = {
  provider: "",
  iyzicoEnabled: false,
  paytrEnabled: false,
  kuveytturkEnabled: false,
  kuveytturkConfigured: false,
};

describe("parsePaymentMethodsSetting", () => {
  it("round-trips and appends unknown-order methods at the end", () => {
    const parsed = parsePaymentMethodsSetting(
      JSON.stringify({ order: ["bank_transfer", "kuveytturk", "nope"], enabled: ["kuveytturk"], defaultMethod: "kuveytturk" })
    );
    expect(parsed?.order.slice(0, 2)).toEqual(["bank_transfer", "kuveytturk"]);
    expect(parsed?.order).toHaveLength(PAYMENT_METHOD_IDS.length);
    expect(parsePaymentMethodsSetting(serializePaymentMethodsSettings(parsed!))).toEqual(parsed);
  });

  it("returns null for empty or broken JSON so the legacy fallback applies", () => {
    expect(parsePaymentMethodsSetting("")).toBeNull();
    expect(parsePaymentMethodsSetting("{oops")).toBeNull();
    expect(parsePaymentMethodsSetting('{"order":[]}')).toBeNull();
  });

  it("moves the default to the first enabled method when it is disabled", () => {
    const settings = normalizePaymentMethodsSettings({
      order: ["paytr", "iyzico"],
      enabled: ["iyzico"],
      defaultMethod: "paytr",
    });
    expect(settings.defaultMethod).toBe("iyzico");
  });
});

describe("deriveFromLegacySettings (data migration)", () => {
  it("keeps the active provider and havale; Kuveyt Türk default only when configured", () => {
    const derived = deriveFromLegacySettings({ ...legacy, provider: "iyzico", iyzicoEnabled: true });
    expect(derived.enabled).toEqual(["iyzico", "bank_transfer"]);
    expect(derived.defaultMethod).toBe("iyzico");
  });

  it("makes configured Kuveyt Türk the enabled default", () => {
    const derived = deriveFromLegacySettings({ ...legacy, provider: "paytr", kuveytturkConfigured: true });
    expect(derived.enabled).toEqual(["kuveytturk", "paytr", "bank_transfer"]);
    expect(derived.defaultMethod).toBe("kuveytturk");
  });

  it("keeps gateways whose own 'aktif' switch was on", () => {
    const derived = deriveFromLegacySettings({ ...legacy, provider: "iyzico", paytrEnabled: true });
    expect(derived.enabled).toContain("paytr");
  });

  it("drops the implicit stripe fallback but keeps an explicit stripe choice", () => {
    expect(deriveFromLegacySettings(legacy).enabled).toEqual(["bank_transfer"]);
    expect(deriveFromLegacySettings(legacy).defaultMethod).toBe("bank_transfer");
    expect(deriveFromLegacySettings({ ...legacy, provider: "stripe" }).enabled).toContain("stripe");
  });

  it("never enables balance on its own (it was not offered before)", () => {
    expect(deriveFromLegacySettings({ ...legacy, provider: "kuveytturk" }).enabled).not.toContain("balance");
  });
});

describe("resolvePaymentMethods", () => {
  const settings = normalizePaymentMethodsSettings({
    order: ["kuveytturk", "paytr", "iyzico", "bank_transfer", "balance", "stripe"],
    enabled: ["kuveytturk", "paytr", "iyzico", "bank_transfer", "balance"],
    defaultMethod: "kuveytturk",
  });

  it("puts the default card first and the other cards under 'Diğer kart ödeme seçenekleri'", () => {
    const resolved = resolvePaymentMethods(settings, allConfigured);
    expect(resolved.primaryCard).toBe("kuveytturk");
    expect(resolved.otherCards).toEqual(["paytr", "iyzico"]);
    expect(resolved.available).not.toContain("stripe");
    expect(resolved.defaultMethod).toBe("kuveytturk");
  });

  it("hides enabled but unconfigured methods and falls back to the next card", () => {
    const resolved = resolvePaymentMethods(settings, { ...allConfigured, kuveytturk: false, bank_transfer: false });
    expect(resolved.available).toEqual(["paytr", "iyzico", "balance"]);
    expect(resolved.primaryCard).toBe("paytr");
    expect(resolved.defaultMethod).toBe("paytr");
  });

  it("allows a non-card default such as havale", () => {
    const resolved = resolvePaymentMethods({ ...settings, defaultMethod: "bank_transfer" }, allConfigured);
    expect(resolved.defaultMethod).toBe("bank_transfer");
    expect(resolved.primaryCard).toBe("kuveytturk");
  });

  it("maps legacy client values and rejects unavailable ones", () => {
    const resolved = resolvePaymentMethods(settings, allConfigured);
    expect(resolveRequestedMethod("CREDIT_CARD", resolved)).toBe("kuveytturk");
    expect(resolveRequestedMethod("BANK_TRANSFER", resolved)).toBe("bank_transfer");
    expect(resolveRequestedMethod("paytr", resolved)).toBe("paytr");
    expect(resolveRequestedMethod("stripe", resolved)).toBeNull();
    expect(resolveRequestedMethod("hack", resolved)).toBeNull();
  });

  it("records card gateways as CREDIT_CARD payments", () => {
    expect(paymentRecordMethod("iyzico")).toBe("CREDIT_CARD");
    expect(paymentRecordMethod("bank_transfer")).toBe("BANK_TRANSFER");
    expect(paymentRecordMethod("balance")).toBe("BALANCE");
  });
});
