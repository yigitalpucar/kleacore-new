import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getSettingValue: vi.fn(),
  twoFactorGlobal: vi.fn(),
  userFindUnique: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ db: { user: { findUnique: mocks.userFindUnique } } }));
vi.mock("@/lib/auth/two-factor-settings", () => ({ isTwoFactorGloballyEnabled: mocks.twoFactorGlobal }));
vi.mock("@/lib/integrations/settings", () => ({
  getSettingValue: mocks.getSettingValue,
  isEnabled: (v: string) => v === "true",
}));
// Mirror Next's interrupts: both throw so execution stops like in the app.
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  forbidden: () => {
    throw new Error("FORBIDDEN");
  },
}));

import {
  STAFF_TWO_FACTOR_SETUP_PATH,
  checkApiPermission,
  requireAdmin,
  requireAnyPermission,
  requirePermission,
  requireStaff,
} from "./auth-helpers";

const as = (role: string | null) => mocks.auth.mockResolvedValue(role ? { user: { id: `u-${role}`, role } } : null);

describe("staff guards", () => {
  beforeEach(() => {
    mocks.getSettingValue.mockResolvedValue("false");
    mocks.twoFactorGlobal.mockResolvedValue(true);
    mocks.userFindUnique.mockResolvedValue({ twoFactorEnabled: false });
  });

  it("ADMIN passes every permission and requireAdmin", async () => {
    as("ADMIN");
    await expect(requirePermission("staff.manage")).resolves.toMatchObject({ user: { role: "ADMIN" } });
    await expect(requireAdmin()).resolves.toBeTruthy();
  });

  it("SUPPORT on an invoices page gets 403, not a redirect or crash", async () => {
    as("SUPPORT");
    await expect(requirePermission("invoices.view")).rejects.toThrow("FORBIDDEN");
    await expect(requirePermission("tickets.reply")).resolves.toBeTruthy();
    await expect(requireAdmin()).rejects.toThrow("FORBIDDEN");
  });

  it("BILLING passes invoices, 403 on tickets", async () => {
    as("BILLING");
    await expect(requirePermission("invoices.edit")).resolves.toBeTruthy();
    await expect(requirePermission("tickets.view")).rejects.toThrow("FORBIDDEN");
  });

  it("requireAnyPermission accepts any one", async () => {
    as("SUPPORT");
    await expect(requireAnyPermission("activity.view", "activity.view_own")).resolves.toBeTruthy();
    as("BILLING");
    await expect(requireAnyPermission("activity.view", "activity.view_own")).rejects.toThrow("FORBIDDEN");
  });

  it("customers and anonymous users are sent to login (unchanged)", async () => {
    as("CUSTOMER");
    await expect(requirePermission("tickets.view")).rejects.toThrow("REDIRECT:/musteri/giris");
    await expect(requireStaff()).rejects.toThrow("REDIRECT:/musteri/giris");
    as(null);
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/musteri/giris");
  });

  it("require_staff_2fa sends staff without 2FA to setup", async () => {
    as("SUPPORT");
    mocks.getSettingValue.mockResolvedValue("true");
    await expect(requireStaff()).rejects.toThrow(`REDIRECT:${STAFF_TWO_FACTOR_SETUP_PATH}`);
    await expect(requirePermission("tickets.view")).rejects.toThrow("REDIRECT:");

    mocks.userFindUnique.mockResolvedValue({ twoFactorEnabled: true });
    await expect(requireStaff()).resolves.toBeTruthy();
  });

  it("require_staff_2fa is ignored while 2FA is off globally", async () => {
    as("ADMIN");
    mocks.getSettingValue.mockResolvedValue("true");
    mocks.twoFactorGlobal.mockResolvedValue(false);
    await expect(requireStaff()).resolves.toBeTruthy();
  });

  it("checkApiPermission answers 401 / 403 / ok", async () => {
    as(null);
    await expect(checkApiPermission("reports.view")).resolves.toEqual({ ok: false, status: 401 });
    as("CUSTOMER");
    await expect(checkApiPermission("reports.view")).resolves.toEqual({ ok: false, status: 403 });
    as("SUPPORT");
    await expect(checkApiPermission("reports.view")).resolves.toEqual({ ok: false, status: 403 });
    as("BILLING");
    await expect(checkApiPermission("reports.view")).resolves.toMatchObject({ ok: true });
  });
});
