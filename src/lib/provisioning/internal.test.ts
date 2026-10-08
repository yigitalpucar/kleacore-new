import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  registerDomainWithRegistrar: vi.fn(),
  transferDomainWithRegistrar: vi.fn(),
  queueProvisioningAttempt: vi.fn(),
  createRemoteService: vi.fn(),
  provisionSslCertificate: vi.fn(),
}));

vi.mock("@/lib/integrations/registrar", () => ({
  registerDomainWithRegistrar: mocks.registerDomainWithRegistrar,
  transferDomainWithRegistrar: mocks.transferDomainWithRegistrar,
}));
vi.mock("@/lib/integrations/provisioning-provider", () => ({ createRemoteService: mocks.createRemoteService }));
vi.mock("@/lib/integrations/ssl", () => ({
  mapProductSubTypeToSslType: vi.fn(() => "DV"),
  provisionSslCertificate: mocks.provisionSslCertificate,
}));
vi.mock("@/lib/provisioning/queue", () => ({
  queueProvisioningAttempt: mocks.queueProvisioningAttempt,
}));

import type { Prisma } from "@prisma/client";
import { encryptSecret } from "@/lib/secrets/crypto";
import { prepareOrderProvisioning, resolveProvisioningDomain, submitDomainToRegistrar } from "./internal";

function order(
  slug: "domain" | "ssl" | "hosting",
  configuration: Record<string, unknown>,
  overrides: Record<string, unknown> = {}
) {
  return {
    id: "ord-1",
    orderNumber: "S-2026-000010",
    customerId: "cus-1",
    productId: "prd-1",
    serviceId: null,
    domain: null as string | null,
    billingPeriod: "yearly",
    basePrice: 300,
    product: { name: "Ürün", sku: "SKU-1", subType: null, category: { slug } },
    customer: { id: "cus-1", name: "Ayşe", surname: "Yılmaz", email: "a@example.com", country: null },
    items: [{ configuration }],
    ...overrides,
  };
}

function createTx(current: ReturnType<typeof order>) {
  return {
    order: { findUnique: vi.fn().mockResolvedValue(current), update: vi.fn() },
    domain: { upsert: vi.fn(), update: vi.fn() },
    sslCertificate: { create: vi.fn().mockResolvedValue({ id: "ssl-1" }) },
    service: { create: vi.fn().mockResolvedValue({ id: "svc-1" }) },
    provisioningJob: {
      upsert: vi.fn(async ({ create }: { create: Record<string, unknown> }) => ({
        id: "pj-1",
        attempts: 0,
        maxAttempts: 5,
        ...create,
      })),
    },
  };
}

const asTx = (tx: ReturnType<typeof createTx>) => tx as unknown as Prisma.TransactionClient;

describe("prepareOrderProvisioning (inside the payment transaction)", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.queueProvisioningAttempt.mockResolvedValue({ queued: true, deduplicated: false });
  });

  it("stores a paid domain as PENDING and queues the registrar call instead of making it", async () => {
    const tx = createTx(order("domain", { domain: "Ornek.com.tr" }));

    const result = await prepareOrderProvisioning(asTx(tx), "ord-1");

    expect(result).toMatchObject({ type: "domain", identifier: "ornek.com.tr", status: "QUEUED" });
    expect(tx.domain.upsert.mock.calls[0][0].create.status).toBe("PENDING");
    expect(tx.provisioningJob.upsert.mock.calls[0][0].create).toMatchObject({
      kind: "PROVISION",
      status: "PENDING",
    });
    expect(mocks.queueProvisioningAttempt).toHaveBeenCalledWith(tx, expect.objectContaining({ id: "pj-1" }));
    expect(mocks.registerDomainWithRegistrar).not.toHaveBeenCalled();
  });

  it("records an SSL order without a domain as a FAILED job with the reason — no throw, nothing queued", async () => {
    const tx = createTx(order("ssl", { type: "ssl" }));

    const result = await prepareOrderProvisioning(asTx(tx), "ord-1");

    expect(result).toMatchObject({ type: "ssl", status: "NEEDS_ACTION" });
    const job = tx.provisioningJob.upsert.mock.calls[0][0].create;
    expect(job.status).toBe("FAILED");
    expect(job.lastError).toMatch(/^DOMAIN_REQUIRED: SSL siparişinde alan adı yok/);
    expect(tx.sslCertificate.create).not.toHaveBeenCalled();
    expect(mocks.queueProvisioningAttempt).not.toHaveBeenCalled();
    expect(mocks.provisionSslCertificate).not.toHaveBeenCalled();
  });

  it("creates the SSL certificate record and queues the vendor order", async () => {
    const tx = createTx(order("ssl", { type: "ssl", domain: "magaza.ornek.com" }));

    const result = await prepareOrderProvisioning(asTx(tx), "ord-1");

    expect(result).toMatchObject({ type: "ssl", identifier: "ssl-1", status: "QUEUED" });
    expect(tx.sslCertificate.create.mock.calls[0][0].data).toMatchObject({
      domain: "magaza.ornek.com",
      status: "PENDING",
    });
    expect(mocks.provisionSslCertificate).not.toHaveBeenCalled();
  });

  it("creates the service locally and queues the WHM account creation", async () => {
    const tx = createTx(order("hosting", { type: "hosting" }, { domain: "ornek.com" }));

    const result = await prepareOrderProvisioning(asTx(tx), "ord-1");

    expect(result).toMatchObject({ type: "service", identifier: "svc-1", status: "QUEUED" });
    expect(tx.service.create.mock.calls[0][0].data).toMatchObject({ domain: "ornek.com", status: "ACTIVE" });
    expect(tx.provisioningJob.upsert.mock.calls[0][0].create).toMatchObject({ serviceId: "svc-1" });
    expect(mocks.createRemoteService).not.toHaveBeenCalled();
  });

  it("leaves orders of an existing service (renewals) alone", async () => {
    const tx = createTx(order("hosting", {}, { serviceId: "svc-9" }));

    const result = await prepareOrderProvisioning(asTx(tx), "ord-1");

    expect(result).toEqual({ type: "service", identifier: "svc-9", status: "EXISTING" });
    expect(tx.provisioningJob.upsert).not.toHaveBeenCalled();
  });
});

describe("resolveProvisioningDomain", () => {
  it("accepts a wildcard name only for wildcard certificates", () => {
    const wildcard = order("ssl", { domain: "*.ornek.com" });
    expect(resolveProvisioningDomain(wildcard).error).toMatch(/^DOMAIN_INVALID/);
    expect(
      resolveProvisioningDomain({ ...wildcard, product: { ...wildcard.product, subType: "wildcard" } }).domain
    ).toBe("*.ornek.com");
  });
});

describe("submitDomainToRegistrar (provisioning.run job)", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = "test-encryption-key";
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  it("activates the domain only after the registrar confirms", async () => {
    const client = createTx(order("domain", {}));
    mocks.registerDomainWithRegistrar.mockResolvedValue({ ok: true, provider: "gri" });

    await submitDomainToRegistrar(asTx(client), order("domain", {}) as never, "ornek.com.tr");

    expect(client.domain.update).toHaveBeenCalledWith({
      where: { name: "ornek.com.tr" },
      data: { registrar: "gri", status: "ACTIVE" },
    });
  });

  it("keeps the domain PENDING when the registrar is disabled or errors", async () => {
    const client = createTx(order("domain", {}));
    mocks.registerDomainWithRegistrar.mockResolvedValue({ ok: false, skipped: true, error: "REGISTRAR_NOT_CONFIGURED" });

    const result = await submitDomainToRegistrar(asTx(client), order("domain", {}) as never, "ornek.com.tr");

    expect(result).toMatchObject({ ok: false, skipped: true });
    expect(client.domain.update).not.toHaveBeenCalled();
  });

  it("starts a paid transfer with the stored EPP code and marks it TRANSFERRING", async () => {
    const client = createTx(order("domain", {}));
    const transferOrder = order("domain", {
      type: "domain_transfer",
      domain: "ornek.com.tr",
      eppCode: encryptSecret("EPP-123"),
    });
    mocks.transferDomainWithRegistrar.mockResolvedValue({ ok: true, provider: "gri" });

    await submitDomainToRegistrar(asTx(client), transferOrder as never, "ornek.com.tr");

    expect(mocks.registerDomainWithRegistrar).not.toHaveBeenCalled();
    expect(mocks.transferDomainWithRegistrar).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: "ornek.com.tr",
        eppCode: "EPP-123",
        customer: expect.objectContaining({ country: "TR" }),
      })
    );
    expect(client.domain.update).toHaveBeenCalledWith({
      where: { name: "ornek.com.tr" },
      data: { registrar: "gri", status: "TRANSFERRING" },
    });
  });
});
