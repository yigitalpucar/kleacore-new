import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  registerDomainWithRegistrar: vi.fn(),
  transferDomainWithRegistrar: vi.fn(),
  enqueueProvisioningRetry: vi.fn(),
}));

vi.mock("@/lib/integrations/registrar", () => ({
  registerDomainWithRegistrar: mocks.registerDomainWithRegistrar,
  transferDomainWithRegistrar: mocks.transferDomainWithRegistrar,
}));
vi.mock("@/lib/integrations/provisioning-provider", () => ({ createRemoteService: vi.fn() }));
vi.mock("@/lib/integrations/ssl", () => ({
  mapProductSubTypeToSslType: vi.fn(),
  provisionSslCertificate: vi.fn(),
  serializeSslProvisionResult: vi.fn(),
}));
vi.mock("@/lib/provisioning/retry-queue", () => ({
  enqueueProvisioningRetry: mocks.enqueueProvisioningRetry,
}));

import type { Prisma } from "@prisma/client";
import { encryptSecret } from "@/lib/secrets/crypto";
import { provisionCompletedOrder } from "./internal";

function domainOrder(configuration: Record<string, unknown>) {
  return {
    id: "ord-1",
    orderNumber: "S-2026-000010",
    customerId: "cus-1",
    productId: "prd-domain",
    serviceId: null,
    domain: "ornek.com.tr",
    billingPeriod: "yearly",
    basePrice: 300,
    product: { name: ".com.tr", subType: null, category: { slug: "domain" } },
    customer: { id: "cus-1", name: "Ayşe", surname: "Yılmaz", email: "a@example.com", country: null },
    items: [{ configuration }],
  };
}

function createTx(order: ReturnType<typeof domainOrder>) {
  return {
    order: { findUnique: vi.fn().mockResolvedValue(order) },
    domain: { upsert: vi.fn(), update: vi.fn() },
  };
}

const asTx = (tx: ReturnType<typeof createTx>) => tx as unknown as Prisma.TransactionClient;

describe("provisionCompletedOrder — domains", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = "test-encryption-key";
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  it("stores a new domain as PENDING and only activates it after the registrar confirms", async () => {
    const tx = createTx(domainOrder({ domain: "ornek.com.tr" }));
    mocks.registerDomainWithRegistrar.mockResolvedValue({ ok: true, provider: "gri" });

    const result = await provisionCompletedOrder(asTx(tx), "ord-1");

    expect(tx.domain.upsert.mock.calls[0][0].create.status).toBe("PENDING");
    expect(tx.domain.upsert.mock.calls[0][0].update.status).toBe("PENDING");
    expect(tx.domain.update).toHaveBeenCalledWith({
      where: { name: "ornek.com.tr" },
      data: { registrar: "gri", status: "ACTIVE" },
    });
    expect(result).not.toHaveProperty("partialFailure");
    expect(mocks.enqueueProvisioningRetry).not.toHaveBeenCalled();
  });

  it("keeps the domain PENDING and queues an admin retry when the registrar is disabled", async () => {
    const tx = createTx(domainOrder({ domain: "ornek.com.tr" }));
    mocks.registerDomainWithRegistrar.mockResolvedValue({
      ok: false,
      skipped: true,
      error: "REGISTRAR_NOT_CONFIGURED",
    });

    const result = await provisionCompletedOrder(asTx(tx), "ord-1");

    expect(tx.domain.update).not.toHaveBeenCalled();
    expect(mocks.enqueueProvisioningRetry).toHaveBeenCalledWith("ord-1", "REGISTRAR_NOT_CONFIGURED", tx);
    expect(result).toMatchObject({ type: "domain", partialFailure: true });
  });

  it("keeps the domain PENDING and queues a retry when the registrar errors", async () => {
    const tx = createTx(domainOrder({ domain: "ornek.com.tr" }));
    mocks.registerDomainWithRegistrar.mockResolvedValue({ ok: false, error: "GRI_HTTP_502" });

    await provisionCompletedOrder(asTx(tx), "ord-1");

    expect(tx.domain.update).not.toHaveBeenCalled();
    expect(mocks.enqueueProvisioningRetry).toHaveBeenCalledWith("ord-1", "GRI_HTTP_502", tx);
  });

  it("starts a paid transfer with the stored EPP code and marks it TRANSFERRING", async () => {
    const tx = createTx(
      domainOrder({
        type: "domain_transfer",
        domain: "ornek.com.tr",
        eppCode: encryptSecret("EPP-123"),
      })
    );
    mocks.transferDomainWithRegistrar.mockResolvedValue({ ok: true, provider: "gri" });

    await provisionCompletedOrder(asTx(tx), "ord-1");

    expect(mocks.registerDomainWithRegistrar).not.toHaveBeenCalled();
    expect(mocks.transferDomainWithRegistrar).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: "ornek.com.tr",
        eppCode: "EPP-123",
        customer: expect.objectContaining({ country: "TR" }),
      })
    );
    expect(tx.domain.update).toHaveBeenCalledWith({
      where: { name: "ornek.com.tr" },
      data: { registrar: "gri", status: "TRANSFERRING" },
    });
  });
});
