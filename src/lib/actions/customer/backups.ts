"use server";

import { db } from "@/lib/db";
import {
  restoreServiceBackup,
  runServiceBackup,
} from "@/lib/integrations/backups";
import { requireCustomer } from "@/lib/utils/auth-helpers";
import { revalidatePath } from "next/cache";

export async function triggerManualBackup(serviceId: string) {
  const session = await requireCustomer();
  const userId = session.user.id;

  const service = await db.service.findFirst({
    where: { id: serviceId, customerId: userId },
  });

  if (!service) {
    return { success: false, error: "Hizmet bulunamadı" };
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

export async function deleteBackup(backupId: string) {
  const session = await requireCustomer();
  const userId = session.user.id;

  const backup = await db.backup.findFirst({
    where: { id: backupId, customerId: userId },
  });

  if (!backup) {
    return { success: false, error: "Yedek bulunamadı" };
  }

  if (backup.status === "IN_PROGRESS") {
    return { success: false, error: "Devam eden yedek silinemez" };
  }

  await db.backup.delete({ where: { id: backupId } });

  revalidatePath("/musteri/panel/yedekleme");
  return { success: true };
}

export async function restoreBackup(backupId: string) {
  const session = await requireCustomer();
  const userId = session.user.id;

  const backup = await db.backup.findFirst({
    where: { id: backupId, customerId: userId, status: "COMPLETED" },
  });

  if (!backup) {
    return { success: false, error: "Geri yüklenecek yedek bulunamadı" };
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

export async function retryBackup(backupId: string) {
  const session = await requireCustomer();
  const userId = session.user.id;

  const backup = await db.backup.findFirst({
    where: { id: backupId, customerId: userId, status: "FAILED" },
  });

  if (!backup) {
    return { success: false, error: "Tekrar denenecek yedek bulunamadı" };
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

export async function toggleSchedule(scheduleId: string) {
  const session = await requireCustomer();
  const userId = session.user.id;

  const schedule = await db.backupSchedule.findFirst({
    where: { id: scheduleId },
    include: { backups: { select: { customerId: true }, take: 1 } },
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

  await db.backupSchedule.update({
    where: { id: scheduleId },
    data: { isActive: !schedule.isActive },
  });

  revalidatePath("/musteri/panel/yedekleme");
  return { success: true, isActive: !schedule.isActive };
}
