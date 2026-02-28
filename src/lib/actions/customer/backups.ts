"use server";

import { db } from "@/lib/db";
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

  revalidatePath("/musteri/panel/yedekleme");
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

  // In production, this would trigger actual restore process.
  // For now, mark as a restore request.
  revalidatePath("/musteri/panel/yedekleme");
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

  await db.backup.update({
    where: { id: backupId },
    data: { status: "IN_PROGRESS", startedAt: new Date(), completedAt: null },
  });

  revalidatePath("/musteri/panel/yedekleme");
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
