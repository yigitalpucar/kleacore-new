import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.ENCRYPTION_KEY = "test-encryption-key-test-encryption-key";

const mocks = vi.hoisted(() => ({
  serviceUpdate: vi.fn(),
  createService: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: { service: { update: mocks.serviceUpdate } } }));
vi.mock("@/lib/modules/provisioning", () => ({
  getModuleProvisioningProvider: async () => ({ name: "cpanel-whm", createService: mocks.createService }),
}));

import { decryptSecret, isEncryptedValue } from "@/lib/secrets/crypto";
import { createRemoteService } from ".";
import type { ServiceWithProduct } from "./types";

const service = { id: "svc-1", moduleInstanceId: "mi-whm", product: { category: { slug: "hosting" } } } as unknown as ServiceWithProduct;

beforeEach(() => vi.clearAllMocks());

describe("createRemoteService (generated panel password)", () => {
  it("stores the generated password encrypted and strips it from the result", async () => {
    mocks.createService.mockResolvedValue({ ok: true, reference: "ornekcom", data: { reference: "ornekcom", password: "Ilk-Sifre-123" } });

    const result = await createRemoteService(service);

    expect(result).toEqual({ ok: true, reference: "ornekcom", data: { reference: "ornekcom" } });
    expect(JSON.stringify(result)).not.toContain("Ilk-Sifre-123");
    const { where, data } = mocks.serviceUpdate.mock.calls[0][0];
    expect(where).toEqual({ id: "svc-1" });
    expect(isEncryptedValue(data.panelPassword)).toBe(true);
    expect(decryptSecret(data.panelPassword)).toBe("Ilk-Sifre-123");
    expect(data.panelPasswordSetAt).toBeInstanceOf(Date);
  });

  it("stores nothing when the account wasn't created", async () => {
    mocks.createService.mockResolvedValue({ ok: false, error: "Account exists", data: { password: "x" } });
    const result = await createRemoteService(service);
    expect(result).toEqual({ ok: false, error: "Account exists", data: {} });
    expect(mocks.serviceUpdate).not.toHaveBeenCalled();
  });

  it("passes results without a password through unchanged", async () => {
    mocks.createService.mockResolvedValue({ ok: true, skipped: true });
    expect(await createRemoteService(service)).toEqual({ ok: true, skipped: true });
    expect(mocks.serviceUpdate).not.toHaveBeenCalled();
  });
});
