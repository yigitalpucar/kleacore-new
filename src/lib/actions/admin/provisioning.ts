"use server";

import { logActivity } from "@/lib/activity-log";
import { manualRetryProvisioningJob } from "@/lib/provisioning/retry-queue";
import { requireAdmin } from "@/lib/utils/auth-helpers";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin.provisioning");

const errorMessages: Record<string, string> = {
  JOB_NOT_FOUND: "Provisioning işi bulunamadı",
  JOB_ALREADY_COMPLETED: "Bu iş zaten tamamlanmış",
  JOB_ALREADY_PROCESSING: "Bu iş şu anda işleniyor",
  JOB_IS_MANUAL: "Manuel kurulum görevi: /yonetim/kurulumlar üzerinden aktifleştirin",
};

export async function retryProvisioningJobAction(jobId: string) {
  const session = await requireAdmin();

  try {
    const job = await db.provisioningJob.findUnique({
      where: { id: jobId },
      include: {
        order: {
          select: {
            orderNumber: true,
          },
        },
      },
    });

    if (!job) {
      return { success: false, error: errorMessages.JOB_NOT_FOUND };
    }

    const result = await manualRetryProvisioningJob(jobId);

    await logActivity({
      userId: session.user.id,
      action: "PROVISIONING_RETRY",
      entity: "ProvisioningJob",
      entityId: jobId,
      details: {
        orderNumber: job.order.orderNumber,
        ok: result.ok,
        error: result.error ?? null,
      },
    });

    revalidatePath("/yonetim/provisioning");
    revalidatePath("/yonetim/siparisler");
    revalidatePath("/yonetim/hizmetler");

    if (!result.ok) {
      return {
        success: false,
        error: errorMessages[result.error ?? ""] ?? result.error ?? "Provisioning yeniden denemesi başarısız",
      };
    }

    return { success: true };
  } catch (error) {
    log.error("manual provisioning retry failed", { error });
    return { success: false, error: "Provisioning yeniden denenirken bir hata oluştu" };
  }
}