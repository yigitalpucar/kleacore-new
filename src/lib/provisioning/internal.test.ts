import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  registerDomainWithRegistrar: vi.fn(),
  transferDomainWithRegistrar: vi.fn(),
  enqueueProvisioningRetry: vi.fn(),
  createRemoteService: vi.fn(),
  sendNotification: vi.fn(),
  requiresManualProvisioning: vi.fn(),
  openManualProvisioningTask: vi.fn(),
  queueServiceActivatedNotice: vi.fn(),
}));

vi.mock("@/lib/integrations/registrar", () => ({
  registerDomainWithRegistrar: mocks.registerDomainWithRegistrar,
  transferDomainWithRegistrar: mocks.transferDomainWithRegistrar,
}));
vi.mock("@/lib/integrations/provisioning-provider", () => ({ createRemoteService: mocks.createRemoteService }));
vi.mock("@/lib/notifications/send", () => ({ sendNotification: mocks.sendNotification }));
vi.mock("@/lib/provisioning/manual", () => ({
  requiresManualProvisioning: mocks.requiresManualProvisioning,
  openManualProvisioningTask: mocks.openManualProvisioningTask,
}));
vi.mock("@/lib/provisioning/activation-notice", () => ({
  activationKindForCategory: (slug: string) => (slug === "hosting" ? "hosting" : "server"),
  queueServiceActivatedNotice: mocks.queueServiceActivatedNotice,
}));
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
    expect(mocks.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ template: "domain.registered", dedupeKey: "domain.registered:ord-1", tx })
    );
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

function serviceOrder(slug: string) {
  return {
    id: "ord-2",
    orderNumber: "S-2026-000011",
    customerId: "cus-1",
    productId: "prd-vds",
    serviceId: null,
    domain: null,
    billingPeriod: "monthly",
    basePrice: 500,
    product: { name: "VDS Pro", subType: null, category: { slug } },
    customer: { id: "cus-1", name: "Ayşe", surname: "Yılmaz", email: "a@example.com", companyName: null, country: null },
    items: [{ configuration: {} }],
  };
}

function createServiceTx(order: ReturnType<typeof serviceOrder>) {
  return {
    order: { findUnique: vi.fn().mockResolvedValue(order), update: vi.fn() },
    service: {
      create: vi.fn().mockImplementation(async ({ data }) => ({ id: "svc-1", ...data })),
      update: vi.fn(),
    },
  };
}

describe("provisionCompletedOrder — services", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.openManualProvisioningTask.mockResolvedValue({ id: "task-1" });
  });

  it("creates a PENDING service and an admin task when there is no automation module", async () => {
    mocks.requiresManualProvisioning.mockResolvedValue(true);
    const tx = createServiceTx(serviceOrder("vds"));

    const result = await provisionCompletedOrder(tx as unknown as Prisma.TransactionClient, "ord-2");

    const created = tx.service.create.mock.calls[0][0].data;
    expect(created).toMatchObject({ status: "PENDING", nextDueDate: null, expiresAt: null });
    expect(mocks.openManualProvisioningTask).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ orderId: "ord-2", serviceId: "svc-1", productName: "VDS Pro", customerName: "Ayşe Yılmaz" })
    );
    expect(mocks.createRemoteService).not.toHaveBeenCalled();
    expect(result).toEqual({ type: "service", identifier: "svc-1", manual: true, taskId: "task-1" });
  });

  it("activates automatically provisioned services and queues the 'hizmet aktif' mail", async () => {
    mocks.requiresManualProvisioning.mockResolvedValue(false);
    mocks.createRemoteService.mockResolvedValue({ ok: true, reference: "srv-9" });
    const tx = createServiceTx(serviceOrder("hosting"));

    await provisionCompletedOrder(tx as unknown as Prisma.TransactionClient, "ord-2");

    expect(tx.service.create.mock.calls[0][0].data.status).toBe("ACTIVE");
    expect(mocks.queueServiceActivatedNotice).toHaveBeenCalledWith(tx, expect.objectContaining({ kind: "hosting" }));
    expect(mocks.openManualProvisioningTask).not.toHaveBeenCalled();
  });

  it("doesn't announce a service whose remote creation failed", async () => {
    mocks.requiresManualProvisioning.mockResolvedValue(false);
    mocks.createRemoteService.mockResolvedValue({ ok: false, error: "WHM_DOWN" });
    const tx = createServiceTx(serviceOrder("hosting"));

    await provisionCompletedOrder(tx as unknown as Prisma.TransactionClient, "ord-2");

    expect(mocks.queueServiceActivatedNotice).not.toHaveBeenCalled();
    expect(mocks.enqueueProvisioningRetry).toHaveBeenCalledWith("ord-2", "WHM_DOWN", tx, "svc-1");
  });
});
