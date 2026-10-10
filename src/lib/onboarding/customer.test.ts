import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  count: vi.fn(),
  twoFactor: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: { user: { findUnique: mocks.findUnique }, service: { count: mocks.count } } }));
vi.mock("@/lib/auth/two-factor-settings", () => ({ isTwoFactorGloballyEnabled: mocks.twoFactor }));

import { buildOnboardingSteps, getCustomerOnboarding, missingBillingFields, type OnboardingUser } from "./customer";

const fresh: OnboardingUser = {
  name: "Ayşe",
  surname: "",
  phone: null,
  address: null,
  city: null,
  customerType: "INDIVIDUAL",
  companyName: null,
  taxNumber: null,
  taxOffice: null,
  emailVerifiedAt: null,
  twoFactorEnabled: false,
};

const complete: OnboardingUser = {
  ...fresh,
  surname: "Yılmaz",
  phone: "+90 555 000 00 00",
  address: "Atatürk Cd. 1",
  city: "İstanbul",
  emailVerifiedAt: new Date(),
  twoFactorEnabled: true,
};

describe("missingBillingFields", () => {
  it("lists what an invoice still needs", () => {
    expect(missingBillingFields(fresh)).toEqual(["ad soyad", "telefon", "adres"]);
    expect(missingBillingFields(complete)).toEqual([]);
  });

  it("asks corporate customers for company and tax details", () => {
    expect(missingBillingFields({ ...complete, customerType: "CORPORATE", taxNumber: "123" })).toEqual(["şirket adı", "vergi bilgileri"]);
  });

  it("treats whitespace as empty", () => {
    expect(missingBillingFields({ ...complete, phone: "   " })).toEqual(["telefon"]);
  });
});

describe("buildOnboardingSteps", () => {
  it("orders steps e-mail → profile → service → 2FA and links each to its page", () => {
    const steps = buildOnboardingSteps(fresh, { serviceCount: 0, twoFactorAvailable: true });
    expect(steps.map((s) => s.id)).toEqual(["email", "profile", "service", "twoFactor"]);
    expect(steps.every((s) => !s.done)).toBe(true);
    expect(steps.find((s) => s.id === "profile")?.href).toBe("/musteri/panel/ayarlar");
    expect(steps.find((s) => s.id === "twoFactor")?.href).toBe("/musteri/panel/ayarlar?sekme=guvenlik");
  });

  it("marks finished steps from real account data", () => {
    const steps = buildOnboardingSteps(complete, { serviceCount: 2, twoFactorAvailable: true });
    expect(steps.every((s) => s.done)).toBe(true);
  });

  it("drops the 2FA step when 2FA is switched off site-wide", () => {
    expect(buildOnboardingSteps(fresh, { serviceCount: 0, twoFactorAvailable: false }).map((s) => s.id)).not.toContain("twoFactor");
  });
});

describe("getCustomerOnboarding", () => {
  beforeEach(() => {
    mocks.findUnique.mockReset();
    mocks.count.mockReset().mockResolvedValue(0);
    mocks.twoFactor.mockReset().mockResolvedValue(true);
  });

  it("returns progress for an unfinished customer", async () => {
    mocks.findUnique.mockResolvedValue({ ...fresh, role: "CUSTOMER", emailVerifiedAt: new Date(), onboardingDismissedAt: null });
    expect(await getCustomerOnboarding("u1")).toMatchObject({ completed: 1, total: 4 });
  });

  it("is hidden once dismissed, when complete, or for staff", async () => {
    mocks.findUnique.mockResolvedValueOnce({ ...fresh, role: "CUSTOMER", onboardingDismissedAt: new Date() });
    expect(await getCustomerOnboarding("u1")).toBeNull();
    mocks.count.mockResolvedValue(1);
    mocks.findUnique.mockResolvedValueOnce({ ...complete, role: "CUSTOMER", onboardingDismissedAt: null });
    expect(await getCustomerOnboarding("u1")).toBeNull();
    mocks.findUnique.mockResolvedValueOnce({ ...fresh, role: "ADMIN", onboardingDismissedAt: null });
    expect(await getCustomerOnboarding("u1")).toBeNull();
  });
});
