import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  serviceFindMany: vi.fn(),
  serviceUpdate: vi.fn((args: unknown) => args),
  transaction: vi.fn(async (ops: unknown[]) => ops),
  moduleInstanceFindMany: vi.fn(),
  getInstance: vi.fn(),
  createContract: vi.fn(),
  listUsage: vi.fn(),
  enqueue: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    service: { findMany: mocks.serviceFindMany, update: mocks.serviceUpdate, fields: {} },
    moduleInstance: { findMany: mocks.moduleInstanceFindMany },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/modules/instances", () => ({ getInstance: mocks.getInstance, createContract: mocks.createContract }));
vi.mock("@/lib/jobs/enqueue", () => ({ enqueue: mocks.enqueue }));

import { enqueueHostingUsageSync, syncInstanceUsage, usageToServiceData } from "./usage-sync";

const collectedAt = new Date("2026-10-09T01:30:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getInstance.mockResolvedValue({ id: "mi-whm", moduleId: "cpanel-whm" });
  mocks.createContract.mockReturnValue({ listUsage: mocks.listUsage });
});

describe("usageToServiceData", () => {
  it("converts MB to GB and keeps unlimited limits as null", () => {
    const syncedAt = new Date();
    expect(
      usageToServiceData({ diskUsedMB: 1536, diskLimitMB: 5120, bandwidthUsedMB: 512, bandwidthLimitMB: null, collectedAt }, syncedAt)
    ).toEqual({ usageSyncedAt: syncedAt, diskUsed: 1.5, diskLimit: 5, bandwidthUsed: 0.5, bandwidthLimit: null });
  });

  it("leaves fields the panel didn't report untouched", () => {
    const syncedAt = new Date();
    expect(usageToServiceData({ diskUsedMB: 100, collectedAt }, syncedAt)).toEqual({ usageSyncedAt: syncedAt, diskUsed: 0.098 });
  });
});

describe("syncInstanceUsage", () => {
  it("updates each live service from one bulk read, matching by remote id", async () => {
    mocks.listUsage.mockResolvedValue({
      ok: true,
      data: [
        { remoteId: "ornekcom", usage: { diskUsedMB: 2048, diskLimitMB: 4096, bandwidthUsedMB: 0, bandwidthLimitMB: 10240, collectedAt } },
        { remoteId: "baska", usage: { diskUsedMB: 1, collectedAt } },
      ],
    });
    mocks.serviceFindMany.mockResolvedValue([
      { id: "svc-1", remoteId: "OrnekCom", username: null },
      { id: "svc-2", remoteId: null, username: "kayip" },
    ]);

    const result = await syncInstanceUsage("mi-whm");

    expect(result).toEqual({ instanceId: "mi-whm", updated: 1, missing: ["svc-2"] });
    expect(mocks.listUsage).toHaveBeenCalledTimes(1);
    expect(mocks.serviceFindMany.mock.calls[0][0].where).toEqual({
      moduleInstanceId: "mi-whm",
      status: { in: ["ACTIVE", "SUSPENDED"] },
    });
    expect(mocks.serviceUpdate).toHaveBeenCalledWith({
      where: { id: "svc-1" },
      data: expect.objectContaining({ diskUsed: 2, diskLimit: 4, bandwidthUsed: 0, bandwidthLimit: 10, usageSyncedAt: expect.any(Date) }),
    });
  });

  it("throws on a panel error so the job is retried", async () => {
    mocks.listUsage.mockResolvedValue({ ok: false, error: "CPANEL_WHM_TIMEOUT" });
    await expect(syncInstanceUsage("mi-whm")).rejects.toThrow(/USAGE_SYNC_FAILED: CPANEL_WHM_TIMEOUT/);
    expect(mocks.serviceUpdate).not.toHaveBeenCalled();
  });

  it("skips instances that are gone or can't read usage in bulk", async () => {
    mocks.getInstance.mockResolvedValueOnce(null);
    expect(await syncInstanceUsage("mi-x")).toMatchObject({ skipped: "MODULE_INSTANCE_NOT_FOUND" });
    mocks.createContract.mockReturnValueOnce({});
    expect(await syncInstanceUsage("mi-whm")).toMatchObject({ skipped: "BULK_USAGE_NOT_SUPPORTED" });
  });
});

describe("enqueueHostingUsageSync", () => {
  it("queues one deduplicated job per instance whose module reads usage in bulk", async () => {
    mocks.moduleInstanceFindMany.mockResolvedValue([
      { id: "mi-whm", moduleId: "cpanel-whm" },
      { id: "mi-virt", moduleId: "virtualizor" },
      { id: "mi-whm2", moduleId: "cpanel-whm" },
    ]);
    mocks.enqueue.mockResolvedValueOnce({ id: "j1", deduplicated: false }).mockResolvedValueOnce({ id: null, deduplicated: true });

    const result = await enqueueHostingUsageSync();

    expect(mocks.enqueue.mock.calls).toEqual([
      ["hosting.usage-sync", { instanceId: "mi-whm" }, { singletonKey: "mi-whm" }],
      ["hosting.usage-sync", { instanceId: "mi-whm2" }, { singletonKey: "mi-whm2" }],
    ]);
    expect(result).toEqual({ processed: 1, skipped: 1, ids: ["mi-whm", "mi-whm2"] });
  });
});
