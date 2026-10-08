"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/lib/activity-log";
import { db } from "@/lib/db";
import { cancelQueueJob, findQueueJob, retryQueueJob } from "@/lib/jobs/admin";
import { jobRegistry, PROVISIONING_RUN_JOB } from "@/lib/jobs/definitions";
import { drainJobs } from "@/lib/jobs/worker";
import { createLogger } from "@/lib/logger";
import { requireAdmin } from "@/lib/utils/auth-helpers";

const log = createLogger("admin.jobs");

/** How long "Yeniden dene" waits for the retried job to run in-request. */
const RETRY_INLINE_BUDGET_MS = 25_000;

const inputSchema = z.object({
  name: z.string().refine((name) => jobRegistry.has(name), "Bilinmeyen iş türü"),
  id: z.string().uuid(),
});

const errorMessages: Record<string, string> = {
  JOB_NOT_FOUND: "İş bulunamadı (silinmiş veya saklama süresi dolmuş olabilir)",
  JOB_NOT_FAILED: "Yalnızca başarısız işler yeniden denenebilir",
  JOB_ACTIVE: "Çalışmakta olan bir iş iptal edilemez",
  JOB_FINISHED: "Bu iş zaten sonuçlanmış",
};

type ActionResult = { success: true; message: string } | { success: false; error: string };

function revalidate() {
  revalidatePath("/yonetim/isler");
  revalidatePath("/yonetim/provisioning");
}

/**
 * Puts a failed queue job back in the queue and immediately runs that queue
 * in this request (bounded), so the admin sees the outcome without waiting
 * for the next drain / worker poll.
 */
export async function retryQueueJobAction(name: string, id: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = inputSchema.safeParse({ name, id });
  if (!parsed.success) return { success: false, error: "Geçersiz iş" };

  try {
    const retried = await retryQueueJob(name, id);
    if (!retried.ok) {
      return { success: false, error: errorMessages[retried.error] ?? "İş yeniden denenemedi" };
    }

    await drainJobs({ names: [name], budgetMs: RETRY_INLINE_BUDGET_MS, maxJobs: 10 });
    const after = await findQueueJob(name, id);

    await logActivity({
      userId: session.user.id,
      action: "QUEUE_JOB_RETRY",
      entity: "QueueJob",
      entityId: id,
      details: { name, state: after?.state ?? null },
    });
    revalidate();

    if (after?.state === "completed") {
      return { success: true, message: "İş yeniden denendi ve tamamlandı" };
    }
    if (after?.state === "failed") {
      const output = after.output as { message?: string } | null;
      return { success: false, error: `Yeniden deneme başarısız: ${output?.message ?? "bilinmeyen hata"}` };
    }
    return { success: true, message: "İş kuyruğa alındı; birazdan işlenecek" };
  } catch (error) {
    log.error("queue job retry failed", { name, id, error });
    return { success: false, error: "İş yeniden denenirken bir hata oluştu" };
  }
}

export async function cancelQueueJobAction(name: string, id: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = inputSchema.safeParse({ name, id });
  if (!parsed.success) return { success: false, error: "Geçersiz iş" };

  try {
    const job = await findQueueJob(name, id);
    const cancelled = await cancelQueueJob(name, id);
    if (!cancelled.ok) {
      return { success: false, error: errorMessages[cancelled.error] ?? "İş iptal edilemedi" };
    }

    // Keep the admin-visible provisioning record consistent, and stop the
    // retry-provisioning reconcile from queueing the row again.
    const provisioningJobId =
      name === PROVISIONING_RUN_JOB ? (job?.data as { provisioningJobId?: string } | undefined)?.provisioningJobId : undefined;
    if (provisioningJobId) {
      await db.provisioningJob.updateMany({
        where: { id: provisioningJobId, status: { in: ["PENDING", "PROCESSING"] } },
        data: { status: "FAILED", lastError: "Kuyruktaki iş yönetici tarafından iptal edildi" },
      });
    }

    await logActivity({
      userId: session.user.id,
      action: "QUEUE_JOB_CANCEL",
      entity: "QueueJob",
      entityId: id,
      details: { name, previousState: job?.state ?? null },
    });
    revalidate();

    return { success: true, message: job?.state === "failed" ? "İş listeden kaldırıldı" : "İş iptal edildi" };
  } catch (error) {
    log.error("queue job cancel failed", { name, id, error });
    return { success: false, error: "İş iptal edilirken bir hata oluştu" };
  }
}
