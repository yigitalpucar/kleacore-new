"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/lib/activity-log";
import { db } from "@/lib/db";
import { cancelQueueJob, findQueueJob } from "@/lib/jobs/admin";
import { QUEUE_JOB_ERRORS, retryFailedQueueJob } from "@/lib/jobs/admin-retry";
import { jobRegistry, PROVISIONING_RUN_JOB } from "@/lib/jobs/definitions";
import { createLogger } from "@/lib/logger";
import { requirePermission } from "@/lib/utils/auth-helpers";

const log = createLogger("admin.jobs");

const inputSchema = z.object({
  name: z.string().refine((name) => jobRegistry.has(name), "Bilinmeyen iş türü"),
  id: z.string().uuid(),
});

const errorMessages = QUEUE_JOB_ERRORS;

type ActionResult = { success: true; message: string } | { success: false; error: string };

function revalidate() {
  revalidatePath("/yonetim/isler");
  revalidatePath("/yonetim/provisioning");
}

export async function retryQueueJobAction(name: string, id: string): Promise<ActionResult> {
  const session = await requirePermission("jobs.manage");
  const parsed = inputSchema.safeParse({ name, id });
  if (!parsed.success) return { success: false, error: "Geçersiz iş" };

  try {
    const result = await retryFailedQueueJob(session.user.id, name, id);
    if (result.success || result.code === "RETRY_FAILED") revalidate();
    return result.success ? { success: true, message: result.message } : { success: false, error: result.error };
  } catch (error) {
    log.error("queue job retry failed", { name, id, error });
    return { success: false, error: "İş yeniden denenirken bir hata oluştu" };
  }
}

export async function cancelQueueJobAction(name: string, id: string): Promise<ActionResult> {
  const session = await requirePermission("jobs.manage");
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
