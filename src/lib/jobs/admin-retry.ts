/**
 * Staff "Yeniden dene" of a failed queue job, shared by the admin server
 * action (src/lib/actions/admin/jobs.ts) and the admin API
 * (/api/admin/v1/jobs/{name}/{id}/retry). The caller checks jobs.manage.
 */
import { logActivity } from "@/lib/activity-log";
import { findQueueJob, retryQueueJob } from "@/lib/jobs/admin";
import { drainJobs } from "@/lib/jobs/worker";

/** How long "Yeniden dene" waits for the retried job to run in-request. */
const RETRY_INLINE_BUDGET_MS = 25_000;

export const QUEUE_JOB_ERRORS: Record<string, string> = {
  JOB_NOT_FOUND: "İş bulunamadı (silinmiş veya saklama süresi dolmuş olabilir)",
  JOB_NOT_FAILED: "Yalnızca başarısız işler yeniden denenebilir",
  JOB_ACTIVE: "Çalışmakta olan bir iş iptal edilemez",
  JOB_FINISHED: "Bu iş zaten sonuçlanmış",
};

export type QueueRetryResult =
  | { success: true; state: string | null; message: string }
  | { success: false; error: string; code: string; status: number };

/**
 * Puts a failed queue job back in the queue and immediately runs that queue
 * in this request (bounded), so the caller sees the outcome without waiting
 * for the next drain / worker poll.
 */
export async function retryFailedQueueJob(actorId: string, name: string, id: string): Promise<QueueRetryResult> {
  const retried = await retryQueueJob(name, id);
  if (!retried.ok) {
    return {
      success: false,
      code: retried.error,
      error: QUEUE_JOB_ERRORS[retried.error] ?? "İş yeniden denenemedi",
      status: retried.error === "JOB_NOT_FOUND" ? 404 : 409,
    };
  }

  await drainJobs({ names: [name], budgetMs: RETRY_INLINE_BUDGET_MS, maxJobs: 10 });
  const after = await findQueueJob(name, id);

  await logActivity({
    userId: actorId,
    action: "QUEUE_JOB_RETRY",
    entity: "QueueJob",
    entityId: id,
    details: { name, state: after?.state ?? null },
  });

  const state = after?.state ?? null;
  if (state === "completed") {
    return { success: true, state, message: "İş yeniden denendi ve tamamlandı" };
  }
  if (state === "failed") {
    const output = after?.output as { message?: string } | null;
    return {
      success: false,
      code: "RETRY_FAILED",
      error: `Yeniden deneme başarısız: ${output?.message ?? "bilinmeyen hata"}`,
      status: 502,
    };
  }
  return { success: true, state, message: "İş kuyruğa alındı; birazdan işlenecek" };
}
