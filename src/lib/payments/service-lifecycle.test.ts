import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  unsuspendRemoteService: vi.fn(),
  db: {
    provisioningJob: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    service: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/integrations/provisioning-provider", () => ({
  createRemoteService: vi.fn(),
  unsuspendRemoteService: mocks.unsuspendRemoteService,
}));
vi.mock("@/lib/integrations/registrar", () => ({
  registerDomainWithRegistrar: vi.fn(),
  transferDomainWithRegistrar: vi.fn(),
}));
vi.mock("@/lib/integrations/ssl", () => ({
  mapProductSubTypeToSslType: vi.fn(),
  provisionSslCertificate: vi.fn(),
}));

import type { Prisma } from "@prisma/client";
import { CUSTOMER_STOPPED_REASON } from "@/lib/services/server-power";
import { runPendingUnsuspendJobs } from "@/lib/provisioning/retry-queue";
import {
  NON_PAYMENT_SUSPEND_REASON,
  isNonPaymentSuspension,
  unsuspendServiceIfNeeded,
} from "./service-lifecycle";

function createTx(service: { id: string; status: string; suspendReason: string | null } | null) {
  return {
    service: {
      findUnique: vi.fn().mockResolvedValue(service),
      updateMany: vi.fn().mockResolvedValue({ count: service ? 1 : 0 }),
    },
    provisioningJob: {
      upsert: vi.fn(),
    },
  };
}

describe("isNonPaymentSuspension", () => {
  it("only matches the overdue-invoice suspension reason", () => {
    expect(isNonPaymentSuspension({ status: "SUSPENDED", suspendReason: NON_PAYMENT_SUSPEND_REASON })).toBe(true);
    expect(isNonPaymentSuspension({ status: "SUSPENDED", suspendReason: CUSTOMER_STOPPED_REASON })).toBe(false);
    expect(isNonPaymentSuspension({ status: "SUSPENDED", suspendReason: "Kötüye kullanım" })).toBe(false);
    expect(isNonPaymentSuspension({ status: "ACTIVE", suspendReason: null })).toBe(false);
  });
});

describe("unsuspendServiceIfNeeded", () => {
  it("reactivates a non-payment suspension and queues the remote unsuspend in the same transaction", async () => {
    const tx = createTx({ id: "svc-1", status: "SUSPENDED", suspendReason: NON_PAYMENT_SUSPEND_REASON });

    const result = await unsuspendServiceIfNeeded(
      tx as unknown as Prisma.TransactionClient,
      "svc-1",
      "ord-1"
    );

    expect(result).toEqual({ unsuspended: true });
    expect(tx.service.updateMany).toHaveBeenCalledWith({
      where: { id: "svc-1", status: "SUSPENDED", suspendReason: NON_PAYMENT_SUSPEND_REASON },
      data: { status: "ACTIVE", suspendedAt: null, suspendReason: null },
    });
    expect(tx.provisioningJob.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderId: "ord-1" },
        create: expect.objectContaining({ kind: "UNSUSPEND", serviceId: "svc-1", status: "PENDING" }),
      })
    );
  });

  it("never auto-starts a server the customer stopped", async () => {
    const tx = createTx({ id: "svc-1", status: "SUSPENDED", suspendReason: CUSTOMER_STOPPED_REASON });

    const result = await unsuspendServiceIfNeeded(
      tx as unknown as Prisma.TransactionClient,
      "svc-1",
      "ord-1"
    );

    expect(result).toEqual({ unsuspended: false });
    expect(tx.service.updateMany).not.toHaveBeenCalled();
    expect(tx.provisioningJob.upsert).not.toHaveBeenCalled();
  });

  it("leaves admin suspensions to the admin", async () => {
    const tx = createTx({ id: "svc-1", status: "SUSPENDED", suspendReason: "Kötüye kullanım" });

    await expect(
      unsuspendServiceIfNeeded(tx as unknown as Prisma.TransactionClient, "svc-1", "ord-1")
    ).resolves.toEqual({ unsuspended: false });
    expect(tx.provisioningJob.upsert).not.toHaveBeenCalled();
  });
});

describe("runPendingUnsuspendJobs", () => {
  const job = {
    id: "job-1",
    orderId: "ord-1",
    serviceId: "svc-1",
    kind: "UNSUSPEND",
    status: "PENDING",
    attempts: 0,
    maxAttempts: 5,
    nextRetryAt: new Date(),
    order: { serviceId: "svc-1", product: { category: { slug: "hosting" } } },
  };
  const activeService = { id: "svc-1", status: "ACTIVE", product: {}, customer: {} };

  beforeEach(() => {
    mocks.unsuspendRemoteService.mockReset();
    mocks.db.provisioningJob.findMany.mockResolvedValue([job]);
    mocks.db.provisioningJob.updateMany.mockResolvedValue({ count: 1 });
    mocks.db.provisioningJob.update.mockResolvedValue({});
    mocks.db.service.findUnique.mockResolvedValue(activeService);
  });

  it("calls the provider's unsuspend and completes the job", async () => {
    mocks.unsuspendRemoteService.mockResolvedValue({ ok: true, provider: "cpanel-whm" });

    const results = await runPendingUnsuspendJobs(["inv-1"]);

    expect(mocks.unsuspendRemoteService).toHaveBeenCalledWith(activeService);
    expect(results).toEqual([{ jobId: "job-1", ok: true, error: undefined }]);
    expect(mocks.db.provisioningJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED" }) })
    );
  });

  it("keeps a failed remote unsuspend queued for retry and logs it", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.unsuspendRemoteService.mockResolvedValue({ ok: false, error: "WHM_HTTP_500" });

    const results = await runPendingUnsuspendJobs(["inv-1"]);

    expect(results[0]).toMatchObject({ ok: false, error: "WHM_HTTP_500" });
    expect(mocks.db.provisioningJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PENDING", attempts: 1, lastError: "WHM_HTTP_500" }),
      })
    );
    expect(error).toHaveBeenCalled();
  });

  it("does not unsuspend remotely when the service was suspended again meanwhile", async () => {
    mocks.db.service.findUnique.mockResolvedValue({ ...activeService, status: "SUSPENDED" });

    await runPendingUnsuspendJobs(["inv-1"]);

    expect(mocks.unsuspendRemoteService).not.toHaveBeenCalled();
  });

  it("skips a job the retry cron already claimed", async () => {
    mocks.db.provisioningJob.updateMany.mockResolvedValue({ count: 0 });

    await expect(runPendingUnsuspendJobs(["inv-1"])).resolves.toEqual([]);
    expect(mocks.unsuspendRemoteService).not.toHaveBeenCalled();
  });
});
