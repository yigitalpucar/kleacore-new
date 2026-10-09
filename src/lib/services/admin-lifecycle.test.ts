import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  service: {
    id: "svc-1",
    customerId: "cus-1",
    status: "ACTIVE",
    label: "VDS",
    domain: null,
    product: { name: "VDS-1", category: { slug: "vds" } },
    customer: { id: "cus-1", name: "A", surname: "B", email: "a@b.test" },
  } as Record<string, unknown>,
  terminateRemoteService: vi.fn(),
  logActivity: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const db = {
    service: {
      findUnique: vi.fn(async () => mocks.service),
      update: vi.fn(async () => ({ ...mocks.service, status: "CANCELLED" })),
    },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(db),
  };
  return { db };
});
vi.mock("@/lib/events/emit", () => ({ emitEvent: vi.fn() }));
vi.mock("@/lib/activity-log", () => ({ logActivity: mocks.logActivity }));
vi.mock("@/lib/integrations/provisioning-provider", () => ({
  terminateRemoteService: mocks.terminateRemoteService,
  suspendRemoteService: vi.fn(),
  unsuspendRemoteService: vi.fn(),
}));

import { terminateServiceAs } from "./admin-lifecycle";

beforeEach(() => {
  mocks.terminateRemoteService.mockReset();
  mocks.logActivity.mockReset();
});

describe("terminateServiceAs (panel + admin API) and the final-backup policy", () => {
  it("goes through the final-backup gate by default (no skip)", async () => {
    mocks.terminateRemoteService.mockResolvedValue({ ok: false, skipped: true, error: "FINAL_BACKUP_PENDING" });
    const result = await terminateServiceAs("adm-1", "svc-1", "müşteri talebi");
    expect(mocks.terminateRemoteService).toHaveBeenCalledWith(expect.objectContaining({ id: "svc-1" }), {
      skipFinalBackup: false,
      actorId: "adm-1",
    });
    expect(result).toMatchObject({ success: true, integration: { error: "FINAL_BACKUP_PENDING" } });
    expect(mocks.logActivity).not.toHaveBeenCalledWith(expect.objectContaining({ action: "SERVICE_TERMINATED_WITHOUT_FINAL_BACKUP" }));
  });

  it("passes the explicit skip flag and records it", async () => {
    mocks.terminateRemoteService.mockResolvedValue({ ok: true });
    await terminateServiceAs("adm-1", "svc-1", undefined, { skipFinalBackup: true });
    expect(mocks.terminateRemoteService).toHaveBeenCalledWith(expect.anything(), { skipFinalBackup: true, actorId: "adm-1" });
    expect(mocks.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "SERVICE_TERMINATED_WITHOUT_FINAL_BACKUP", entityId: "svc-1", userId: "adm-1" })
    );
  });
});

describe("admin API terminate: skipFinalBackup needs the backups.manage scope", () => {
  it("refuses the skip flag without backups.manage and never calls the module", async () => {
    const { terminateService } = await import("@/lib/admin-api/operations/services");
    const context = {
      token: { id: "tok", name: "t", rateLimitPerMinute: 60 },
      owner: { id: "adm-1", role: "ADMIN" as const, name: "A", email: "a@b.test" },
      scopes: ["services.manage" as const],
      ip: null,
    };
    await expect(
      terminateService.handler({ params: { id: "svc-1" }, body: { reason: "test", skipFinalBackup: true }, query: {}, context } as never)
    ).rejects.toMatchObject({ status: 403, code: "insufficient_scope" });
    expect(mocks.terminateRemoteService).not.toHaveBeenCalled();
  });
});
