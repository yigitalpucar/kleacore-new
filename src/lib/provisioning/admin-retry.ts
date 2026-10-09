/**
 * Staff "Yeniden dene" of a provisioning job, shared by the admin server
 * action (src/lib/actions/admin/provisioning.ts) and the admin API
 * (/api/admin/v1/services/{id}/retry-provisioning). The caller checks
 * provisioning.manage.
 */
import { logActivity } from "@/lib/activity-log";
import { db } from "@/lib/db";
import { manualRetryProvisioningJob } from "@/lib/provisioning/retry-queue";

export const PROVISIONING_RETRY_ERRORS: Record<string, string> = {
  JOB_NOT_FOUND: "Provisioning işi bulunamadı",
  JOB_ALREADY_COMPLETED: "Bu iş zaten tamamlanmış",
  JOB_ALREADY_PROCESSING: "Bu iş şu anda işleniyor",
  JOB_IS_MANUAL: "Manuel kurulum görevi: /yonetim/kurulumlar üzerinden aktifleştirin",
};

export type ProvisioningRetryResult =
  | { success: true }
  | { success: false; error: string; code: string; status: number };

export async function retryProvisioningJobAs(actorId: string, jobId: string): Promise<ProvisioningRetryResult> {
  const job = await db.provisioningJob.findUnique({
    where: { id: jobId },
    include: { order: { select: { orderNumber: true } } },
  });

  if (!job) {
    return { success: false, error: PROVISIONING_RETRY_ERRORS.JOB_NOT_FOUND, code: "JOB_NOT_FOUND", status: 404 };
  }

  const result = await manualRetryProvisioningJob(jobId);

  await logActivity({
    userId: actorId,
    action: "PROVISIONING_RETRY",
    entity: "ProvisioningJob",
    entityId: jobId,
    details: {
      orderNumber: job.order.orderNumber,
      ok: result.ok,
      error: result.error ?? null,
    },
  });

  if (!result.ok) {
    const code = result.error ?? "RETRY_FAILED";
    return {
      success: false,
      code,
      error: PROVISIONING_RETRY_ERRORS[code] ?? result.error ?? "Provisioning yeniden denemesi başarısız",
      status: code in PROVISIONING_RETRY_ERRORS ? 409 : 502,
    };
  }

  return { success: true };
}
