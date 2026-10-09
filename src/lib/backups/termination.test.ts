/**
 * Termination of a backup-capable VDS (terminateRemoteService →
 * finalBackupGate): the VM is never destroyed before a final backup
 * completed, unless the admin explicitly skipped it.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.ENCRYPTION_KEY = "test-encryption-key-test-encryption-key";

const mocks = vi.hoisted(() => ({
  backupFindMany: vi.fn(),
  backupCreate: vi.fn(),
  serviceFindUnique: vi.fn(),
  terminateService: vi.fn(),
  enqueue: vi.fn(),
  patchState: vi.fn(),
  binding: null as unknown,
}));

vi.mock("@/lib/db", () => ({
  db: {
    backup: { findMany: mocks.backupFindMany, create: mocks.backupCreate },
    service: { findUnique: mocks.serviceFindUnique },
  },
}));
vi.mock("@/lib/modules/instances", () => ({ getServerBindingForService: vi.fn(async () => mocks.binding) }));
vi.mock("@/lib/modules/provisioning", () => ({
  getModuleProvisioningProvider: async () => ({ name: "proxmox", terminateService: mocks.terminateService }),
}));
vi.mock("@/lib/provisioning/queue", () => ({ isJobQueueReady: async () => true }));
vi.mock("@/lib/jobs/enqueue", () => ({ enqueue: mocks.enqueue }));
vi.mock("@/lib/modules/service-state", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/modules/service-state")>()),
  patchServiceModuleState: mocks.patchState,
}));

import { terminateRemoteService } from "@/lib/integrations/provisioning";
import type { ServiceWithProduct } from "@/lib/integrations/provisioning/types";
import { proxmoxModule } from "@/lib/modules/server/proxmox";

const service = {
  id: "svc_vds",
  customerId: "cus_1",
  status: "CANCELLED",
  label: "VDS",
  domain: null,
  moduleInstanceId: "mi_pve",
  remoteId: "1000",
  moduleData: { proxmox: { node: "pve" } },
  product: { id: "prd", name: "VDS", sku: "VDS-1", moduleOptions: { templateVmid: 9000 }, moduleInstanceId: "mi_pve", category: { slug: "vds" } },
  customer: { id: "cus_1", name: "A", surname: "B", email: "a@test.local" },
} as unknown as ServiceWithProduct;

const final = (status: string, extra: Record<string, unknown> = {}) => ({
  id: `bk_${status.toLowerCase()}`,
  trigger: "FINAL",
  status,
  deletedAt: null,
  createdAt: new Date("2026-10-09T03:00:00Z"),
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.binding = {
    manifest: proxmoxModule,
    instance: { id: "mi_pve", label: "PVE", moduleId: "proxmox", kind: "server", config: { node: "pve", backupRetention: 2 } },
    module: { createBackup: vi.fn(), restoreBackup: vi.fn(), deleteBackup: vi.fn(), terminate: vi.fn() },
  };
  mocks.serviceFindUnique.mockResolvedValue(service);
  mocks.backupCreate.mockImplementation(async ({ data }) => ({ id: "bk_new", ...data }));
  mocks.terminateService.mockResolvedValue({ ok: true, provider: "proxmox" });
  mocks.enqueue.mockResolvedValue({ id: "job_1", deduplicated: false });
  mocks.patchState.mockResolvedValue(undefined);
});

describe("terminateRemoteService for a VDS with backups", () => {
  it("first takes a final backup and does not destroy the VM", async () => {
    mocks.backupFindMany.mockResolvedValue([]);

    const result = await terminateRemoteService(service);

    expect(result).toMatchObject({ ok: false, skipped: true, error: "FINAL_BACKUP_PENDING", reference: "bk_new" });
    expect(mocks.terminateService).not.toHaveBeenCalled();
    expect(mocks.backupCreate.mock.calls[0][0].data).toMatchObject({
      serviceId: "svc_vds",
      trigger: "FINAL",
      status: "SCHEDULED",
      provider: "proxmox",
      moduleInstanceId: "mi_pve",
      node: "pve",
      vmid: 1000,
    });
    // Queued per Proxmox node (one vzdump at a time per node).
    expect(mocks.enqueue).toHaveBeenCalledWith("backup.run", { backupId: "bk_new" }, { singletonKey: "mi_pve:pve" });
  });

  it("waits while the final backup runs", async () => {
    mocks.backupFindMany.mockResolvedValue([final("IN_PROGRESS")]);
    const result = await terminateRemoteService(service);
    expect(result).toMatchObject({ ok: false, error: "FINAL_BACKUP_PENDING", reference: "bk_in_progress" });
    expect(mocks.backupCreate).not.toHaveBeenCalled();
    expect(mocks.terminateService).not.toHaveBeenCalled();
  });

  it("refuses to destroy after a failed final backup: takes it again instead", async () => {
    mocks.backupFindMany.mockResolvedValue([final("FAILED")]);
    const result = await terminateRemoteService(service);
    expect(result).toMatchObject({ ok: false, error: "FINAL_BACKUP_PENDING" });
    expect(mocks.backupCreate).toHaveBeenCalledTimes(1);
    expect(mocks.terminateService).not.toHaveBeenCalled();
  });

  it("destroys once a final backup completed", async () => {
    mocks.backupFindMany.mockResolvedValue([final("FAILED"), final("COMPLETED")]);
    const result = await terminateRemoteService(service);
    expect(result).toEqual({ ok: true, provider: "proxmox" });
    expect(mocks.terminateService).toHaveBeenCalledTimes(1);
    expect(mocks.backupCreate).not.toHaveBeenCalled();
  });

  it("destroys without a backup only with the admin's explicit skip flag (recorded)", async () => {
    mocks.backupFindMany.mockResolvedValue([final("FAILED")]);
    const result = await terminateRemoteService(service, { skipFinalBackup: true, actorId: "admin_1" });
    expect(result.ok).toBe(true);
    expect(mocks.terminateService).toHaveBeenCalledTimes(1);
    expect(mocks.backupCreate).not.toHaveBeenCalled();
    expect(mocks.patchState).toHaveBeenCalledWith("svc_vds", "_backups", expect.objectContaining({ finalBackupSkippedBy: "admin_1" }));
  });

  it("never destroys when the gate cannot load the module (doubt = keep the VM)", async () => {
    const { getServerBindingForService } = await import("@/lib/modules/instances");
    vi.mocked(getServerBindingForService).mockRejectedValueOnce(new Error("MODULE_INSTANCE_NOT_FOUND"));
    const result = await terminateRemoteService(service);
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/^FINAL_BACKUP_CHECK_FAILED/) });
    expect(mocks.terminateService).not.toHaveBeenCalled();
  });

  it("modules without backups and legacy services terminate as before", async () => {
    mocks.binding = { ...(mocks.binding as object), manifest: { ...proxmoxModule, capabilities: ["provision"] } };
    expect((await terminateRemoteService(service)).ok).toBe(true);
    expect(mocks.backupFindMany).not.toHaveBeenCalled();
  });
});
