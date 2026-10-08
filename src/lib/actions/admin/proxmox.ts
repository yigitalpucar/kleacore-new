"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity-log";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { requireAdmin } from "@/lib/utils/auth-helpers";

const log = createLogger("actions.admin.proxmox");

/**
 * "Proxmox'ta yeniden dene": puts the service's PROVISION job back in the
 * queue with a fresh retry budget. The module resumes on the existing VM
 * (no second clone) and re-allocates the IP if it was released.
 */
export async function retryProxmoxProvisioningAction(serviceId: string) {
  const session = await requireAdmin();
  const job = await db.provisioningJob.findFirst({
    where: { serviceId, kind: "PROVISION" },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, attempts: true, maxAttempts: true },
  });
  if (!job) return { success: false as const, error: "Bu hizmetin kurulum işi bulunamadı" };
  if (job.status === "COMPLETED") return { success: false as const, error: "Kurulum işi zaten tamamlanmış" };
  if (job.status === "PROCESSING") return { success: false as const, error: "Kurulum şu anda çalışıyor" };

  try {
    const { queueProvisioningAttempt } = await import("@/lib/provisioning/queue");
    const updated = await db.provisioningJob.update({
      where: { id: job.id },
      data: { status: "PENDING", attempts: 0, nextRetryAt: new Date() },
      select: { id: true, attempts: true, maxAttempts: true },
    });
    const queued = await queueProvisioningAttempt(db, updated);
    await logActivity({
      userId: session.user.id,
      action: "PROXMOX_PROVISION_RETRY",
      entity: "Service",
      entityId: serviceId,
      details: { jobId: job.id, previousStatus: job.status, queued: queued.queued },
    });
    revalidatePath(`/yonetim/hizmetler/${serviceId}`);
    revalidatePath("/yonetim/provisioning");
    return {
      success: true as const,
      message: queued.queued
        ? "Kurulum kuyruğa alındı; birkaç dakika içinde kaldığı yerden devam eder."
        : "Kuyruk şu anda kapalı; iş bekleyen olarak işaretlendi, zamanlanmış görev kuyruğa alacak.",
    };
  } catch (error) {
    log.error("proxmox retry failed", { serviceId, error: error instanceof Error ? error.message : String(error) });
    return { success: false as const, error: "Yeniden deneme başlatılamadı" };
  }
}

export async function getProxmoxTaskLogAction(serviceId: string) {
  await requireAdmin();
  const service = await db.service.findUnique({
    where: { id: serviceId },
    select: { id: true, moduleInstanceId: true, moduleData: true },
  });
  if (!service) return { success: false as const, error: "Hizmet bulunamadı" };
  const { fetchProxmoxTaskLog } = await import("@/lib/modules/server-panel");
  const result = await fetchProxmoxTaskLog(service as Parameters<typeof fetchProxmoxTaskLog>[0]);
  if ("error" in result) return { success: false as const, error: result.error };
  return { success: true as const, ...result };
}
