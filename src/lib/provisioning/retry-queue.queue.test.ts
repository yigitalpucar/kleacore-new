import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createRemoteService: vi.fn(),
  abandonModuleProvisioning: vi.fn(),
  unsuspendRemoteService: vi.fn(),
  changeRemoteServicePlan: vi.fn(),
  queueProvisioningAttempt: vi.fn(),
  dismissFailedQueueEntries: vi.fn(),
  db: {
    provisioningJob: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    service: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/provisioning/queue", () => ({
  queueProvisioningAttempt: mocks.queueProvisioningAttempt,
  dismissFailedQueueEntries: mocks.dismissFailedQueueEntries,
}));
vi.mock("@/lib/integrations/provisioning-provider", () => ({
  createRemoteService: mocks.createRemoteService,
  unsuspendRemoteService: mocks.unsuspendRemoteService,
  changeRemoteServicePlan: mocks.changeRemoteServicePlan,
}));
vi.mock("@/lib/modules/provisioning", () => ({ abandonModuleProvisioning: mocks.abandonModuleProvisioning }));
vi.mock("@/lib/integrations/ssl", () => ({ mapProductSubTypeToSslType: vi.fn(), provisionSslCertificate: vi.fn() }));

import {
  enqueueProvisioningRetry,
  reconcileProvisioningQueue,
  runQueuedProvisioningJob,
} from "./retry-queue";

const unsuspendJob = {
  id: "pj-1",
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
const ctx = (retryCount: number, retryLimit = 4) => ({
  jobId: "q-1",
  retryCount,
  retryLimit,
  isFinalAttempt: retryCount >= retryLimit,
});

describe("runQueuedProvisioningJob (provisioning.run handler)", () => {
  beforeEach(() => {
    Object.values(mocks.db.provisioningJob).forEach((fn) => fn.mockReset());
    mocks.db.provisioningJob.findUnique.mockResolvedValue(unsuspendJob);
    mocks.db.provisioningJob.updateMany.mockResolvedValue({ count: 1 });
    mocks.db.provisioningJob.update.mockResolvedValue({});
    mocks.db.service.findUnique.mockResolvedValue(activeService);
    mocks.unsuspendRemoteService.mockReset();
  });

  it("claims the row, runs it and marks it COMPLETED", async () => {
    mocks.unsuspendRemoteService.mockResolvedValue({ ok: true });

    await expect(runQueuedProvisioningJob("pj-1", ctx(0))).resolves.toEqual({ ok: true, orderId: "ord-1" });
    expect(mocks.db.provisioningJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "pj-1" }), data: { status: "PROCESSING" } })
    );
    expect(mocks.db.provisioningJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED", lastError: null }) })
    );
  });

  it("keeps the row PENDING and throws so pg-boss retries with backoff", async () => {
    mocks.unsuspendRemoteService.mockResolvedValue({ ok: false, error: "WHM_HTTP_500" });

    await expect(runQueuedProvisioningJob("pj-1", ctx(1))).rejects.toThrow("WHM_HTTP_500");
    expect(mocks.db.provisioningJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PENDING", attempts: 1, lastError: "WHM_HTTP_500" }),
      })
    );
  });

  it("marks the row FAILED on the final attempt", async () => {
    mocks.unsuspendRemoteService.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(runQueuedProvisioningJob("pj-1", ctx(4))).rejects.toThrow("ECONNREFUSED");
    expect(mocks.db.provisioningJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED", lastError: "ECONNREFUSED" }) })
    );
  });

  it("does nothing for a row that was completed meanwhile (e.g. by the inline run)", async () => {
    mocks.db.provisioningJob.findUnique.mockResolvedValue({ ...unsuspendJob, status: "COMPLETED" });

    await expect(runQueuedProvisioningJob("pj-1", ctx(0))).resolves.toEqual({ skipped: "ALREADY_COMPLETED" });
    expect(mocks.unsuspendRemoteService).not.toHaveBeenCalled();
  });

  it("backs off while another runner holds the row", async () => {
    mocks.db.provisioningJob.updateMany.mockResolvedValue({ count: 0 });

    await expect(runQueuedProvisioningJob("pj-1", ctx(0))).rejects.toThrow("JOB_BUSY");
    expect(mocks.unsuspendRemoteService).not.toHaveBeenCalled();
  });
});

describe("runQueuedProvisioningJob — paid order work moved out of the payment transaction", () => {
  beforeEach(() => {
    Object.values(mocks.db.provisioningJob).forEach((fn) => fn.mockReset());
    mocks.db.provisioningJob.updateMany.mockResolvedValue({ count: 1 });
    mocks.db.provisioningJob.update.mockResolvedValue({});
    mocks.changeRemoteServicePlan.mockReset();
  });

  it("pushes a paid plan change to WHM with the service's new package", async () => {
    mocks.db.provisioningJob.findUnique.mockResolvedValue({ ...unsuspendJob, kind: "PLAN_CHANGE" });
    mocks.db.service.findUnique.mockResolvedValue({ ...activeService, product: { sku: "HOST-PRO" } });
    mocks.changeRemoteServicePlan.mockResolvedValue({ ok: true });

    await expect(runQueuedProvisioningJob("pj-1", ctx(0))).resolves.toEqual({ ok: true, orderId: "ord-1" });
    expect(mocks.changeRemoteServicePlan).toHaveBeenCalledWith(
      expect.objectContaining({ id: "svc-1" }),
      "HOST-PRO"
    );
  });

  it("parks an SSL order without a domain as FAILED for the admin instead of retrying", async () => {
    mocks.db.provisioningJob.findUnique.mockResolvedValue({
      ...unsuspendJob,
      kind: "PROVISION",
      order: {
        serviceId: null,
        domain: null,
        product: { sku: "SSL-DV-01", subType: "standart", category: { slug: "ssl" } },
        items: [{ configuration: { type: "ssl" } }],
      },
    });

    const result = await runQueuedProvisioningJob("pj-1", ctx(0));

    expect(result).toMatchObject({ ok: false, needsAction: expect.stringMatching(/^DOMAIN_REQUIRED/) });
    expect(mocks.db.provisioningJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED", lastError: expect.stringMatching(/^DOMAIN_REQUIRED/) }),
      })
    );
  });
});

describe("enqueueProvisioningRetry", () => {
  beforeEach(() => {
    mocks.queueProvisioningAttempt.mockReset();
  });

  it("writes the row and queues the attempt through the same client (transaction)", async () => {
    const created = { id: "pj-9", attempts: 0, maxAttempts: 5, nextRetryAt: new Date("2026-10-08T12:05:00Z") };
    const tx = {
      provisioningJob: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(created) },
    };

    await enqueueProvisioningRetry("ord-9", "GRI_HTTP_502", tx as never);

    expect(tx.provisioningJob.create).toHaveBeenCalled();
    expect(mocks.queueProvisioningAttempt).toHaveBeenCalledWith(tx, created, { startAfter: created.nextRetryAt });
  });
});

describe("reconcileProvisioningQueue (retry-provisioning cron)", () => {
  beforeEach(() => {
    Object.values(mocks.db.provisioningJob).forEach((fn) => fn.mockReset());
    mocks.queueProvisioningAttempt.mockReset();
    mocks.db.provisioningJob.updateMany.mockResolvedValue({ count: 0 });
  });

  it("queues PENDING rows without a queue job and counts deduplicated ones as skipped", async () => {
    const future = new Date(Date.now() + 60_000);
    mocks.db.provisioningJob.findMany.mockResolvedValue([
      { id: "pj-legacy", attempts: 2, maxAttempts: 5, nextRetryAt: future },
      { id: "pj-queued", attempts: 0, maxAttempts: 5, nextRetryAt: new Date(0) },
    ]);
    mocks.queueProvisioningAttempt
      .mockResolvedValueOnce({ queued: true, deduplicated: false })
      .mockResolvedValueOnce({ queued: false, deduplicated: true });

    const result = await reconcileProvisioningQueue();

    expect(result).toEqual({ processed: 1, skipped: 1, ids: ["pj-legacy"] });
    expect(mocks.queueProvisioningAttempt.mock.calls[0][2]).toEqual({ startAfter: future });
    expect(mocks.queueProvisioningAttempt.mock.calls[1][2]).toEqual({ startAfter: undefined });
  });

  it("closes rows whose retry budget is already used up", async () => {
    mocks.db.provisioningJob.findMany.mockResolvedValue([
      { id: "pj-done", attempts: 5, maxAttempts: 5, nextRetryAt: new Date() },
    ]);

    await reconcileProvisioningQueue();

    expect(mocks.queueProvisioningAttempt).not.toHaveBeenCalled();
    expect(mocks.db.provisioningJob.update).toHaveBeenCalledWith({ where: { id: "pj-done" }, data: { status: "FAILED" } });
  });
});

describe("runQueuedProvisioningJob — giving up a module-bound provisioning", () => {
  const provisionJob = {
    ...unsuspendJob,
    id: "pj-2",
    kind: "PROVISION",
    lastError: null,
    order: { id: "ord-1", serviceId: "svc-1", product: { category: { slug: "vds" } }, customer: {} },
  };

  beforeEach(() => {
    Object.values(mocks.db.provisioningJob).forEach((fn) => fn.mockReset());
    mocks.db.provisioningJob.findUnique.mockResolvedValue(provisionJob);
    mocks.db.provisioningJob.updateMany.mockResolvedValue({ count: 1 });
    mocks.db.provisioningJob.update.mockResolvedValue({});
    mocks.db.service.findUnique.mockResolvedValue({ id: "svc-1", product: {}, customer: {} });
    mocks.createRemoteService.mockReset().mockResolvedValue({ ok: false, error: "PROXMOX_START: KVM not available" });
    mocks.abandonModuleProvisioning.mockReset().mockResolvedValue({ released: ["203.0.113.20"] });
  });

  it("keeps reservations while retries remain", async () => {
    await expect(runQueuedProvisioningJob("pj-2", ctx(1))).rejects.toThrow("PROXMOX_START");
    expect(mocks.abandonModuleProvisioning).not.toHaveBeenCalled();
  });

  it("releases the service's IP (module abandon hook) after the final attempt", async () => {
    await expect(runQueuedProvisioningJob("pj-2", ctx(4))).rejects.toThrow("PROXMOX_START");
    expect(mocks.db.provisioningJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED", lastError: "PROXMOX_START: KVM not available" }) })
    );
    expect(mocks.abandonModuleProvisioning).toHaveBeenCalledWith("svc-1");
  });
});
