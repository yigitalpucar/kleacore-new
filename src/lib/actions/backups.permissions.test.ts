/**
 * Who may touch VDS backups: customers only their own (never final backups),
 * staff only with backups.manage (ADMIN by default; SUPPORT / BILLING not).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasPermission } from "@/lib/auth/permissions";

const mocks = vi.hoisted(() => ({
  role: "ADMIN" as string,
  backupFindFirst: vi.fn(),
  backupFindUnique: vi.fn(),
  serviceFindFirst: vi.fn(),
  serviceFindUnique: vi.fn(),
  requestVdsRestore: vi.fn(),
  requestVdsBackup: vi.fn(),
  deleteVdsBackup: vi.fn(),
  terminateRemoteService: vi.fn(),
}));

class Forbidden extends Error {}

vi.mock("@/lib/db", () => ({
  db: {
    backup: { findFirst: mocks.backupFindFirst, findUnique: mocks.backupFindUnique },
    service: { findFirst: mocks.serviceFindFirst, findUnique: mocks.serviceFindUnique },
  },
}));
vi.mock("@/lib/utils/auth-helpers", async () => {
  const { hasPermission: allowed } = await import("@/lib/auth/permissions");
  return {
    requireCustomer: vi.fn(async () => ({ user: { id: "cus_1", role: "CUSTOMER" } })),
    requirePermission: vi.fn(async (permission: Parameters<typeof allowed>[1]) => {
      if (!allowed(mocks.role, permission)) throw new Forbidden(permission);
      return { user: { id: "staff_1", role: mocks.role } };
    }),
  };
});
vi.mock("@/lib/backups/vds", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/backups/vds")>();
  return {
    BackupError: actual.BackupError,
    requestVdsRestore: mocks.requestVdsRestore,
    requestVdsBackup: mocks.requestVdsBackup,
    deleteVdsBackup: mocks.deleteVdsBackup,
    checkManualBackupRate: vi.fn(),
    isVdsBackupService: vi.fn(async () => true),
  };
});
vi.mock("@/lib/integrations/provisioning", () => ({ terminateRemoteService: mocks.terminateRemoteService }));
vi.mock("@/lib/integrations/backups", () => ({ restoreServiceBackup: vi.fn(), runServiceBackup: vi.fn() }));
vi.mock("@/lib/activity-log", () => ({ logActivity: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  adminCreateVdsBackupAction,
  adminDeleteVdsBackupAction,
  adminRestoreVdsBackupAction,
  retryFinalBackupAction,
  setVdsExtraBackupSlotsAction,
  terminateWithoutFinalBackupAction,
} from "./admin/backups";
import { createVdsBackupNow, deleteBackup, restoreVdsBackup } from "./customer/backups";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.role = "ADMIN";
  mocks.requestVdsRestore.mockResolvedValue({ targetServiceId: "svc_1" });
  mocks.requestVdsBackup.mockResolvedValue({ id: "bk_new" });
});

describe("customer backup actions", () => {
  it("only finds the customer's own backups", async () => {
    mocks.backupFindFirst.mockResolvedValue(null);
    const result = await restoreVdsBackup("bk_other", "kc-x");
    expect(result).toEqual({ success: false, error: "Yedek bulunamadı" });
    expect(mocks.backupFindFirst.mock.calls[0][0].where).toMatchObject({
      id: "bk_other",
      customerId: "cus_1",
      deletedAt: null,
      service: { customerId: "cus_1" },
    });
    expect(mocks.requestVdsRestore).not.toHaveBeenCalled();
  });

  it("never lets a customer restore or delete a final (termination) backup", async () => {
    mocks.backupFindFirst.mockResolvedValue({ id: "bk_final", serviceId: "svc_1", trigger: "FINAL", status: "COMPLETED" });
    expect((await restoreVdsBackup("bk_final", "kc-x")).success).toBe(false);
    expect((await deleteBackup("bk_final")).success).toBe(false);
    expect(mocks.requestVdsRestore).not.toHaveBeenCalled();
    expect(mocks.deleteVdsBackup).not.toHaveBeenCalled();
  });

  it("passes the typed confirmation to the restore", async () => {
    mocks.backupFindFirst.mockResolvedValue({ id: "bk_1", serviceId: "svc_1", trigger: "MANUAL", status: "COMPLETED" });
    expect(await restoreVdsBackup("bk_1", "kc-abc")).toEqual({ success: true });
    expect(mocks.requestVdsRestore).toHaveBeenCalledWith("bk_1", { confirmation: "kc-abc" });
  });

  it("refuses to back up someone else's service", async () => {
    mocks.serviceFindFirst.mockResolvedValue(null);
    expect(await createVdsBackupNow("svc_other")).toEqual({ success: false, error: "Hizmet bulunamadı" });
    expect(mocks.serviceFindFirst.mock.calls[0][0].where).toEqual({ id: "svc_other", customerId: "cus_1" });
    expect(mocks.requestVdsBackup).not.toHaveBeenCalled();
  });
});

describe("admin backup actions need backups.manage", () => {
  it("is an ADMIN-only permission by default", () => {
    expect(hasPermission("ADMIN", "backups.manage")).toBe(true);
    expect(hasPermission("SUPPORT", "backups.manage")).toBe(false);
    expect(hasPermission("BILLING", "backups.manage")).toBe(false);
  });

  it.each(["SUPPORT", "BILLING"])("%s cannot restore, delete, back up, change slots or skip the final backup", async (role) => {
    mocks.role = role;
    await expect(adminRestoreVdsBackupAction("bk_1", { confirmation: "kc-x" })).rejects.toBeInstanceOf(Forbidden);
    await expect(adminDeleteVdsBackupAction("bk_1")).rejects.toBeInstanceOf(Forbidden);
    await expect(adminCreateVdsBackupAction("svc_1")).rejects.toBeInstanceOf(Forbidden);
    await expect(setVdsExtraBackupSlotsAction("svc_1", 2)).rejects.toBeInstanceOf(Forbidden);
    await expect(retryFinalBackupAction("svc_1")).rejects.toBeInstanceOf(Forbidden);
    await expect(terminateWithoutFinalBackupAction("svc_1", "kc-x")).rejects.toBeInstanceOf(Forbidden);
    expect(mocks.requestVdsRestore).not.toHaveBeenCalled();
    expect(mocks.deleteVdsBackup).not.toHaveBeenCalled();
    expect(mocks.requestVdsBackup).not.toHaveBeenCalled();
    expect(mocks.terminateRemoteService).not.toHaveBeenCalled();
  });

  it("ADMIN restores a final backup into another service", async () => {
    mocks.requestVdsRestore.mockResolvedValue({ targetServiceId: "svc_new" });
    const result = await adminRestoreVdsBackupAction("bk_final", { confirmation: "kc-new", targetServiceId: " svc_new " });
    expect(result).toEqual({ success: true, targetServiceId: "svc_new" });
    expect(mocks.requestVdsRestore).toHaveBeenCalledWith("bk_final", { confirmation: "kc-new", targetServiceId: "svc_new" });
  });

  it("destroying without a final backup needs the typed server name", async () => {
    mocks.serviceFindUnique.mockResolvedValue({ id: "svc_1abcdefghijkl", status: "CANCELLED", remoteId: "1000" });
    const wrong = await terminateWithoutFinalBackupAction("svc_1abcdefghijkl", "kc-wrong");
    expect(wrong.success).toBe(false);
    expect(mocks.terminateRemoteService).not.toHaveBeenCalled();

    mocks.terminateRemoteService.mockResolvedValue({ ok: true });
    const ok = await terminateWithoutFinalBackupAction("svc_1abcdefghijkl", "kc-abcdefghijkl");
    expect(ok).toEqual({ success: true });
    expect(mocks.terminateRemoteService).toHaveBeenCalledWith(expect.objectContaining({ id: "svc_1abcdefghijkl" }), {
      skipFinalBackup: true,
      actorId: "staff_1",
    });
  });
});
