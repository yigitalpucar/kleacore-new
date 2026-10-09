"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity-log";
import {
  restoreServiceBackup,
  runServiceBackup,
} from "@/lib/integrations/backups";
import { requireCustomer } from "@/lib/utils/auth-helpers";
import { createLogger } from "@/lib/logger";
import { revalidatePath } from "next/cache";

const log = createLogger("actions.customer.backups");

type BackupActionResult = {
  success: boolean;
  error?: string;
  backupId?: string;
  isActive?: boolean;
  nextRunAt?: string | null;
};

/**
 * Customer backups. Services on a module with the "backups" capability
 * (Proxmox VDS) go through src/lib/backups/vds.ts (queued vzdump, slots,
 * typed confirmation for restore); the rest keep the legacy provider path.
 */

function revalidateBackups(serviceId?: string) {
  revalidatePath("/musteri/panel/yedekleme");
  if (serviceId) revalidatePath(`/musteri/panel/hizmetlerim/${serviceId}`);
}

async function vds() {
  return import("@/lib/backups/vds");
}

/** BackupError → the customer-facing message; anything else is logged and generic. */
async function failure(error: unknown, fallback: string): Promise<BackupActionResult> {
  const { BackupError } = await vds();
  if (error instanceof BackupError) return { success: false as const, error: error.message };
  log.error(fallback, { error: error instanceof Error ? error.message : String(error) });
  return { success: false as const, error: fallback };
}

async function ownedService(serviceId: string, userId: string) {
  return db.service.findFirst({ where: { id: serviceId, customerId: userId }, select: { id: true } });
}

async function ownedBackup(backupId: string, userId: string) {
  return db.backup.findFirst({
    where: { id: backupId, customerId: userId, deletedAt: null, service: { customerId: userId } },
  });
}

/** "Şimdi yedek al" for a VDS: slot + in-flight checks, then the daily manual limit. */
export async function createVdsBackupNow(serviceId: string): Promise<BackupActionResult> {
  const session = await requireCustomer();
  const userId = session.user.id;
  if (!(await ownedService(serviceId, userId))) return { success: false, error: "Hizmet bulunamadı" };

  try {
    const { checkManualBackupRate, requestVdsBackup } = await vds();
    const backup = await requestVdsBackup(serviceId, {
      trigger: "MANUAL",
      actorId: userId,
      beforeCreate: (binding) => checkManualBackupRate(serviceId, binding.policy.manualPerDay),
    });
    await logActivity({ userId, action: "VDS_BACKUP_REQUESTED", entity: "Service", entityId: serviceId, details: { backupId: backup?.id } });
    revalidateBackups(serviceId);
    return { success: true, backupId: backup?.id };
  } catch (error) {
    return failure(error, "Yedekleme başlatılamadı");
  }
}

/**
 * Restores a VDS backup over the server (all data written after the backup
 * is lost). `confirmation` must be the server name (kc-…).
 */
export async function restoreVdsBackup(backupId: string, confirmation: string): Promise<BackupActionResult> {
  const session = await requireCustomer();
  const userId = session.user.id;
  const backup = await ownedBackup(backupId, userId);
  if (!backup || backup.trigger === "FINAL") return { success: false, error: "Yedek bulunamadı" };

  try {
    const { requestVdsRestore } = await vds();
    await requestVdsRestore(backupId, { confirmation: String(confirmation ?? "") });
    await logActivity({ userId, action: "VDS_BACKUP_RESTORE_REQUESTED", entity: "Service", entityId: backup.serviceId, details: { backupId } });
    revalidateBackups(backup.serviceId);
    return { success: true };
  } catch (error) {
    return failure(error, "Geri yükleme başlatılamadı");
  }
}

const scheduleSchema = z.object({
  frequency: z.enum(["off", "daily", "weekly"]),
  hour: z.coerce.number().int().min(0).max(23),
  weekday: z.coerce.number().int().min(0).max(6).nullable().optional(),
});

/** Automatic VDS backups: off / daily / weekly at an hour (Türkiye saati). */
export async function saveVdsBackupScheduleAction(serviceId: string, input: z.input<typeof scheduleSchema>): Promise<BackupActionResult> {
  const session = await requireCustomer();
  const userId = session.user.id;
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Geçersiz zamanlama" };
  const service = await db.service.findFirst({
    where: { id: serviceId, customerId: userId },
    select: { id: true, status: true, remoteId: true, moduleInstanceId: true, moduleData: true, product: { select: { moduleOptions: true, moduleInstanceId: true } } },
  });
  if (!service) return { success: false, error: "Hizmet bulunamadı" };

  try {
    const { getVdsBackupBinding, saveVdsBackupSchedule } = await vds();
    const binding = await getVdsBackupBinding(service);
    if (!binding) return { success: false, error: "Bu hizmet için yedekleme desteklenmiyor" };
    if (parsed.data.frequency !== "off" && binding.policy.quota <= 0) {
      return { success: false, error: "Paketinizde yedekleme hakkı yok" };
    }
    const schedule = await saveVdsBackupSchedule(serviceId, parsed.data);
    revalidateBackups(serviceId);
    return { success: true, nextRunAt: schedule?.nextRunAt?.toISOString() ?? null };
  } catch (error) {
    return failure(error, "Zamanlama kaydedilemedi");
  }
}

export async function triggerManualBackup(serviceId: string): Promise<BackupActionResult> {
  const session = await requireCustomer();
  const userId = session.user.id;

  const service = await db.service.findFirst({
    where: { id: serviceId, customerId: userId },
  });

  if (!service) {
    return { success: false, error: "Hizmet bulunamadı" };
  }

  if (await (await vds()).isVdsBackupService(serviceId)) {
    return createVdsBackupNow(serviceId);
  }

  const backup = await db.backup.create({
    data: {
      serviceId,
      customerId: userId,
      type: "FULL",
      status: "IN_PROGRESS",
      startedAt: new Date(),
    },
  });

  const result = await runServiceBackup(serviceId, {
    backupId: backup.id,
    customerId: userId,
    type: "FULL",
  });

  revalidatePath("/musteri/panel/yedekleme");

  if (!result.ok) {
    return {
      success: false,
      error: result.error || "Yedekleme başlatılamadı",
      backupId: backup.id,
    };
  }

  return { success: true, backupId: backup.id };
}

export async function deleteBackup(backupId: string): Promise<BackupActionResult> {
  const session = await requireCustomer();
  const userId = session.user.id;

  const backup = await ownedBackup(backupId, userId);

  if (!backup || backup.trigger === "FINAL") {
    return { success: false, error: "Yedek bulunamadı" };
  }

  if (backup.status === "IN_PROGRESS") {
    return { success: false, error: "Devam eden yedek silinemez" };
  }

  if (backup.provider && backup.moduleInstanceId) {
    try {
      await (await vds()).deleteVdsBackup(backupId);
      await logActivity({ userId, action: "VDS_BACKUP_DELETED", entity: "Service", entityId: backup.serviceId, details: { backupId } });
      revalidateBackups(backup.serviceId);
      return { success: true };
    } catch (error) {
      return failure(error, "Yedek silinemedi");
    }
  }

  await db.backup.delete({ where: { id: backupId } });

  revalidatePath("/musteri/panel/yedekleme");
  return { success: true };
}

export async function restoreBackup(backupId: string): Promise<BackupActionResult> {
  const session = await requireCustomer();
  const userId = session.user.id;

  const backup = await db.backup.findFirst({
    where: { id: backupId, customerId: userId, status: "COMPLETED", deletedAt: null },
  });

  if (!backup) {
    return { success: false, error: "Geri yüklenecek yedek bulunamadı" };
  }

  if (backup.provider && backup.moduleInstanceId) {
    // Overwrites the whole server: only with the typed confirmation on the server page.
    return { success: false, error: "Sunucu yedeklerini hizmet sayfasındaki Yedekler bölümünden, sunucu adını yazarak geri yükleyin." };
  }

  const result = await restoreServiceBackup(backupId);

  revalidatePath("/musteri/panel/yedekleme");

  if (!result.ok) {
    return {
      success: false,
      error: result.error || "Geri yükleme başlatılamadı",
    };
  }

  return { success: true };
}

export async function retryBackup(backupId: string): Promise<BackupActionResult> {
  const session = await requireCustomer();
  const userId = session.user.id;

  const backup = await db.backup.findFirst({
    where: { id: backupId, customerId: userId, status: "FAILED", deletedAt: null },
  });

  if (!backup) {
    return { success: false, error: "Tekrar denenecek yedek bulunamadı" };
  }

  if (backup.provider && backup.moduleInstanceId) {
    // A failed VDS backup is not re-run in place: start a new one (same checks and limits).
    return createVdsBackupNow(backup.serviceId);
  }

  const result = await runServiceBackup(backup.serviceId, {
    backupId,
    customerId: userId,
    type: backup.type,
  });

  revalidatePath("/musteri/panel/yedekleme");

  if (!result.ok) {
    return {
      success: false,
      error: result.error || "Yedek tekrar denenemedi",
    };
  }

  return { success: true };
}

export async function toggleSchedule(scheduleId: string): Promise<BackupActionResult> {
  const session = await requireCustomer();
  const userId = session.user.id;

  const schedule = await db.backupSchedule.findFirst({
    where: { id: scheduleId },
  });

  if (!schedule) {
    return { success: false, error: "Zamanlama bulunamadı" };
  }

  // Verify ownership via service
  const service = await db.service.findFirst({
    where: { id: schedule.serviceId, customerId: userId },
  });

  if (!service) {
    return { success: false, error: "Bu zamanlama size ait değil" };
  }

  if (await (await vds()).isVdsBackupService(schedule.serviceId)) {
    const frequency = schedule.isActive ? "off" : schedule.frequency === "weekly" ? "weekly" : "daily";
    const result = await saveVdsBackupScheduleAction(schedule.serviceId, { frequency, hour: schedule.hour, weekday: schedule.weekday });
    return result.success ? { success: true, isActive: frequency !== "off" } : result;
  }

  await db.backupSchedule.update({
    where: { id: scheduleId },
    data: { isActive: !schedule.isActive },
  });

  revalidatePath("/musteri/panel/yedekleme");
  return { success: true, isActive: !schedule.isActive };
}
