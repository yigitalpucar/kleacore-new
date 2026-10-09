"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity-log";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { requirePermission } from "@/lib/utils/auth-helpers";

const log = createLogger("actions.admin.backups");

/**
 * Admin side of VDS backups (src/lib/backups/vds.ts). Every action needs
 * `backups.manage` (ADMIN only by default).
 */

async function vds() {
  return import("@/lib/backups/vds");
}

async function failure(error: unknown, fallback: string) {
  const { BackupError } = await vds();
  if (error instanceof BackupError) return { success: false as const, error: error.message };
  log.error(fallback, { error: error instanceof Error ? error.message : String(error) });
  return { success: false as const, error: fallback };
}

function revalidateService(serviceId: string) {
  revalidatePath(`/yonetim/hizmetler/${serviceId}`);
}

const serviceInclude = {
  product: { include: { category: true } },
  customer: { select: { id: true, name: true, surname: true, email: true } },
} as const;

/** "Şimdi yedek al" from the admin page (slots apply, no daily limit). */
export async function adminCreateVdsBackupAction(serviceId: string) {
  const session = await requirePermission("backups.manage");
  try {
    const { requestVdsBackup } = await vds();
    const backup = await requestVdsBackup(serviceId, { trigger: "MANUAL", actorId: session.user.id });
    await logActivity({ userId: session.user.id, action: "VDS_BACKUP_REQUESTED", entity: "Service", entityId: serviceId, details: { backupId: backup?.id } });
    revalidateService(serviceId);
    return { success: true as const };
  } catch (error) {
    return failure(error, "Yedekleme başlatılamadı");
  }
}

/**
 * Restore into the backup's own service, or (final backup of a terminated
 * service) into another active VDS on the same Proxmox instance.
 * `confirmation` = the target server name.
 */
export async function adminRestoreVdsBackupAction(backupId: string, input: { confirmation: string; targetServiceId?: string }) {
  const session = await requirePermission("backups.manage");
  try {
    const { requestVdsRestore } = await vds();
    const targetServiceId = input.targetServiceId?.trim() || undefined;
    const result = await requestVdsRestore(backupId, { confirmation: String(input.confirmation ?? ""), targetServiceId });
    await logActivity({
      userId: session.user.id,
      action: "VDS_BACKUP_RESTORE_REQUESTED",
      entity: "Service",
      entityId: result.targetServiceId,
      details: { backupId, targetServiceId: result.targetServiceId },
    });
    revalidateService(result.targetServiceId);
    return { success: true as const, targetServiceId: result.targetServiceId };
  } catch (error) {
    return failure(error, "Geri yükleme başlatılamadı");
  }
}

export async function adminDeleteVdsBackupAction(backupId: string) {
  const session = await requirePermission("backups.manage");
  const backup = await db.backup.findUnique({ where: { id: backupId }, select: { serviceId: true, trigger: true } });
  if (!backup) return { success: false as const, error: "Yedek bulunamadı" };
  try {
    const { deleteVdsBackup } = await vds();
    await deleteVdsBackup(backupId);
    await logActivity({
      userId: session.user.id,
      action: "VDS_BACKUP_DELETED",
      entity: "Service",
      entityId: backup.serviceId,
      details: { backupId, trigger: backup.trigger },
    });
    revalidateService(backup.serviceId);
    return { success: true as const };
  } catch (error) {
    return failure(error, "Yedek silinemedi");
  }
}

/** Extra slots on top of the product's (e.g. after selling an "ek yedek" add-on). */
export async function setVdsExtraBackupSlotsAction(serviceId: string, extraSlots: number) {
  const session = await requirePermission("backups.manage");
  if (!Number.isFinite(extraSlots) || extraSlots < 0 || extraSlots > 50) {
    return { success: false as const, error: "0 ile 50 arasında bir sayı girin" };
  }
  const { setVdsExtraBackupSlots } = await vds();
  const value = await setVdsExtraBackupSlots(serviceId, extraSlots);
  await logActivity({ userId: session.user.id, action: "VDS_BACKUP_SLOTS_SET", entity: "Service", entityId: serviceId, details: { extraSlots: value } });
  revalidateService(serviceId);
  return { success: true as const, extraSlots: value };
}

/** Keeps a final backup `days` days from now (1–365). */
export async function extendFinalBackupAction(backupId: string, days: number) {
  const session = await requirePermission("backups.manage");
  if (!Number.isInteger(days) || days < 1 || days > 365) return { success: false as const, error: "1 ile 365 gün arasında olmalı" };
  const backup = await db.backup.findUnique({ where: { id: backupId }, select: { serviceId: true } });
  if (!backup) return { success: false as const, error: "Yedek bulunamadı" };
  try {
    const { setFinalBackupExpiry } = await vds();
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await setFinalBackupExpiry(backupId, expiresAt);
    await logActivity({ userId: session.user.id, action: "VDS_FINAL_BACKUP_EXTENDED", entity: "Service", entityId: backup.serviceId, details: { backupId, days } });
    revalidateService(backup.serviceId);
    return { success: true as const, expiresAt: expiresAt.toISOString() };
  } catch (error) {
    return failure(error, "Süre güncellenemedi");
  }
}

async function cancelledVds(serviceId: string) {
  const service = await db.service.findUnique({ where: { id: serviceId }, include: serviceInclude });
  if (!service) return { error: "Hizmet bulunamadı" } as const;
  if (service.status !== "CANCELLED") return { error: "Hizmet iptal edilmemiş" } as const;
  if (!service.remoteId) return { error: "Sunucu zaten silinmiş" } as const;
  return { service } as const;
}

/** Final backup failed: try again (the VM stays until it succeeds). */
export async function retryFinalBackupAction(serviceId: string) {
  const session = await requirePermission("backups.manage");
  const found = await cancelledVds(serviceId);
  if ("error" in found) return { success: false as const, error: found.error };
  const { terminateRemoteService } = await import("@/lib/integrations/provisioning");
  const result = await terminateRemoteService(found.service, { actorId: session.user.id });
  await logActivity({ userId: session.user.id, action: "VDS_FINAL_BACKUP_RETRY", entity: "Service", entityId: serviceId, details: { result: result.error ?? "ok" } });
  revalidateService(serviceId);
  if (result.ok || result.error === "FINAL_BACKUP_PENDING") return { success: true as const, pending: !result.ok };
  return { success: false as const, error: result.error ?? "İşlem başarısız" };
}

/**
 * Destroy the VM of a cancelled service without a final backup. Explicit
 * and irreversible: `confirmation` must be the server name.
 */
export async function terminateWithoutFinalBackupAction(serviceId: string, confirmation: string) {
  const session = await requirePermission("backups.manage");
  await requirePermission("services.manage");
  const found = await cancelledVds(serviceId);
  if ("error" in found) return { success: false as const, error: found.error };
  const { vmNameFor } = await import("@/lib/modules/server/proxmox");
  if (String(confirmation ?? "").trim() !== vmNameFor(serviceId)) {
    return { success: false as const, error: "Onay için sunucu adını doğru yazın" };
  }
  const { terminateRemoteService } = await import("@/lib/integrations/provisioning");
  const result = await terminateRemoteService(found.service, { skipFinalBackup: true, actorId: session.user.id });
  await logActivity({
    userId: session.user.id,
    action: "SERVICE_TERMINATED_WITHOUT_FINAL_BACKUP",
    entity: "Service",
    entityId: serviceId,
    details: { ok: result.ok, error: result.error },
  });
  revalidateService(serviceId);
  return result.ok ? { success: true as const } : { success: false as const, error: result.error ?? "VM silinemedi" };
}
