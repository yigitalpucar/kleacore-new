import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.ENCRYPTION_KEY = "test-encryption-key-test-encryption-key";

const mocks = vi.hoisted(() => ({
  serviceFindUnique: vi.fn(),
  serviceUpdate: vi.fn(),
  moduleInstanceFindUnique: vi.fn(),
  getServerBindingForService: vi.fn(),
  getSsoUrl: vi.fn(),
  resetPassword: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    service: { findUnique: mocks.serviceFindUnique, update: mocks.serviceUpdate },
    moduleInstance: { findUnique: mocks.moduleInstanceFindUnique },
  },
}));
vi.mock("@/lib/modules/instances", () => ({ getServerBindingForService: mocks.getServerBindingForService }));
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: mocks.logWarn, error: vi.fn() }),
}));

import { decryptSecret, encryptSecret, isEncryptedValue } from "@/lib/secrets/crypto";
import {
  createPanelLoginUrl,
  generatePanelPassword,
  getPanelCapabilities,
  readStoredPanelPassword,
  resetPanelPassword,
  revealPanelPassword,
} from "./panel-access";

const SSO_URL = "https://whm.test:2083/cpsess4567890123/login/?session=ornekcom%3aAbCd";

function service(overrides: Record<string, unknown> = {}) {
  return {
    id: "svc-1",
    customerId: "cus-1",
    status: "ACTIVE",
    label: "Hosting",
    domain: "ornek.com.tr",
    username: "ornekcom",
    remoteId: "ornekcom",
    ipAddress: null,
    moduleInstanceId: "mi-whm",
    panelPassword: null,
    panelPasswordSetAt: null,
    productId: "prd-1",
    product: { id: "prd-1", sku: "HOST-1", name: "Starter", moduleOptions: {}, moduleInstanceId: "mi-whm", category: { slug: "hosting" } },
    customer: { id: "cus-1", name: "Ayşe", surname: "Yılmaz", email: "a@test.local" },
    ...overrides,
  };
}

const binding = {
  manifest: { id: "cpanel-whm", kind: "server", capabilities: ["sso", "password"], productOptionsSchema: undefined },
  instance: { id: "mi-whm", label: "WHM", moduleId: "cpanel-whm" },
  module: { getSsoUrl: mocks.getSsoUrl, resetPassword: mocks.resetPassword },
};

const customer = { kind: "customer" as const, userId: "cus-1" };
const otherCustomer = { kind: "customer" as const, userId: "cus-2" };
const admin = { kind: "admin" as const, userId: "adm-1" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.serviceFindUnique.mockResolvedValue(service());
  mocks.getServerBindingForService.mockResolvedValue(binding);
  mocks.getSsoUrl.mockResolvedValue({ ok: true, data: { url: SSO_URL } });
  mocks.resetPassword.mockResolvedValue({ ok: true, reference: "ornekcom" });
});

describe("createPanelLoginUrl", () => {
  it("returns a fresh login URL for the owner of an active service", async () => {
    const result = await createPanelLoginUrl("svc-1", "panel", customer);
    expect(result).toEqual({ ok: true, data: { url: SSO_URL, remoteId: "ornekcom", customerId: "cus-1" } });
    expect(mocks.getSsoUrl).toHaveBeenCalledWith(
      expect.objectContaining({ service: expect.objectContaining({ remoteId: "ornekcom" }) }),
      "panel",
      undefined
    );
  });

  it("maps quick links to webmail / cPanel apps", async () => {
    await createPanelLoginUrl("svc-1", "webmail", customer);
    await createPanelLoginUrl("svc-1", "phpMyAdmin", customer);
    expect(mocks.getSsoUrl.mock.calls[0].slice(1)).toEqual(["webmail", undefined]);
    expect(mocks.getSsoUrl.mock.calls[1].slice(1)).toEqual(["panel", { app: "phpMyAdmin" }]);
  });

  it("hides another customer's service as not found and never calls the panel", async () => {
    const result = await createPanelLoginUrl("svc-1", "panel", otherCustomer);
    expect(result).toMatchObject({ ok: false, error: "NOT_FOUND" });
    expect(mocks.getSsoUrl).not.toHaveBeenCalled();
  });

  it("requires an ACTIVE service for customers; admins may open suspended accounts", async () => {
    mocks.serviceFindUnique.mockResolvedValue(service({ status: "SUSPENDED" }));
    expect(await createPanelLoginUrl("svc-1", "panel", customer)).toMatchObject({ ok: false, error: "NOT_ACTIVE" });
    expect(await createPanelLoginUrl("svc-1", "panel", admin)).toMatchObject({ ok: true });

    mocks.serviceFindUnique.mockResolvedValue(service({ status: "CANCELLED" }));
    expect(await createPanelLoginUrl("svc-1", "panel", admin)).toMatchObject({ ok: false, error: "NOT_ACTIVE" });
  });

  it("is not supported for legacy services that aren't bound to a module", async () => {
    mocks.serviceFindUnique.mockResolvedValue(service({ moduleInstanceId: null }));
    expect(await createPanelLoginUrl("svc-1", "panel", customer)).toMatchObject({ ok: false, error: "NOT_SUPPORTED" });
    expect(mocks.getServerBindingForService).not.toHaveBeenCalled();
  });

  it("is not supported when the module has no SSO", async () => {
    mocks.getServerBindingForService.mockResolvedValue({ ...binding, module: {} });
    expect(await createPanelLoginUrl("svc-1", "panel", customer)).toMatchObject({ ok: false, error: "NOT_SUPPORTED" });
  });

  it("turns panel failures into a generic message and never logs a URL", async () => {
    mocks.getSsoUrl.mockResolvedValue({ ok: false, error: "Access denied" });
    const result = await createPanelLoginUrl("svc-1", "panel", customer);
    expect(result).toMatchObject({ ok: false, error: "REMOTE_ERROR" });
    expect(JSON.stringify(result)).not.toContain("Access denied");

    mocks.getSsoUrl.mockRejectedValue(new Error(`boom ${SSO_URL}`));
    expect(await createPanelLoginUrl("svc-1", "panel", customer)).toMatchObject({ ok: false, error: "REMOTE_ERROR" });
    expect(JSON.stringify(mocks.logWarn.mock.calls)).not.toContain("cpsess");
  });
});

describe("panel password", () => {
  it("generates strong passwords with every character class", () => {
    for (let i = 0; i < 20; i += 1) {
      const password = generatePanelPassword();
      expect(password).toHaveLength(18);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[0-9]/);
      expect(password).toMatch(/[!@#%*\-_]/);
    }
  });

  it("reveals the stored password to its owner only", async () => {
    mocks.serviceFindUnique.mockResolvedValue(service({ panelPassword: encryptSecret("Ilk-Sifre-123"), panelPasswordSetAt: new Date("2026-10-08") }));
    expect(await revealPanelPassword("svc-1", customer)).toMatchObject({
      ok: true,
      data: { username: "ornekcom", password: "Ilk-Sifre-123" },
    });
    expect(await revealPanelPassword("svc-1", otherCustomer)).toMatchObject({ ok: false, error: "NOT_FOUND" });
  });

  it("says when there is no stored password", async () => {
    expect(await revealPanelPassword("svc-1", customer)).toMatchObject({ ok: false, error: "NO_PASSWORD" });
    expect(readStoredPanelPassword("enc:v1:bozuk:veri:x")).toBeNull();
  });

  it("resets on the panel, then stores the new password encrypted", async () => {
    const result = await resetPanelPassword("svc-1", customer);
    expect(result.ok).toBe(true);
    const password = result.ok ? result.data.password : "";
    expect(mocks.resetPassword).toHaveBeenCalledWith(expect.anything(), password);

    const stored = mocks.serviceUpdate.mock.calls[0][0].data.panelPassword as string;
    expect(isEncryptedValue(stored)).toBe(true);
    expect(stored).not.toContain(password);
    expect(decryptSecret(stored)).toBe(password);
  });

  it("keeps the stored password when the panel refuses the reset", async () => {
    mocks.resetPassword.mockResolvedValue({ ok: false, error: "The password is too weak." });
    expect(await resetPanelPassword("svc-1", customer)).toMatchObject({ ok: false, error: "REMOTE_ERROR" });
    expect(mocks.serviceUpdate).not.toHaveBeenCalled();
    // The new password never reaches the logs.
    const password = mocks.resetPassword.mock.calls[0][1] as string;
    expect(JSON.stringify(mocks.logWarn.mock.calls)).not.toContain(password);
  });

  it("refuses resets for other customers and inactive services", async () => {
    expect(await resetPanelPassword("svc-1", otherCustomer)).toMatchObject({ ok: false, error: "NOT_FOUND" });
    mocks.serviceFindUnique.mockResolvedValue(service({ status: "SUSPENDED" }));
    expect(await resetPanelPassword("svc-1", customer)).toMatchObject({ ok: false, error: "NOT_ACTIVE" });
    expect(mocks.resetPassword).not.toHaveBeenCalled();
  });
});

describe("getPanelCapabilities", () => {
  it("reads sso / password from the bound module's manifest", async () => {
    mocks.moduleInstanceFindUnique.mockResolvedValue({ moduleId: "cpanel-whm", label: "WHM .10" });
    expect(await getPanelCapabilities({ moduleInstanceId: "mi-whm" })).toEqual({ sso: true, passwordReset: true, instanceLabel: "WHM .10" });
    expect(await getPanelCapabilities({ moduleInstanceId: null })).toMatchObject({ sso: false, passwordReset: false });
  });
});
