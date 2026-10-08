"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { logActivity } from "@/lib/activity-log";
import { createLogger } from "@/lib/logger";
import {
  activateManualProvisioning,
  ManualProvisioningError,
  type ManualActivationInput,
} from "@/lib/provisioning/manual";
import { requirePermission } from "@/lib/utils/auth-helpers";

const log = createLogger("admin.manual-provisioning");

const errorMessages: Record<ManualProvisioningError["code"], string> = {
  TASK_NOT_FOUND: "Kurulum görevi bulunamadı",
  TASK_NOT_PENDING: "Bu görev zaten tamamlanmış",
  SERVICE_NOT_FOUND: "Göreve bağlı hizmet bulunamadı",
  SERVICE_NOT_PENDING: "Hizmet kurulum bekliyor durumunda değil",
};

/** "Aktifleştir" on /yonetim/kurulumlar/[id]. The password is never logged. */
export async function activateManualProvisioningAction(taskId: string, input: ManualActivationInput) {
  const session = await requirePermission("provisioning.manage");

  try {
    const result = await activateManualProvisioning(taskId, input, session.user.id);

    await logActivity({
      userId: session.user.id,
      action: "MANUAL_PROVISIONING_ACTIVATE",
      entity: "ProvisioningJob",
      entityId: taskId,
      details: {
        orderNumber: result.orderNumber,
        serviceId: result.serviceId,
        passwordDelivery: input.passwordDelivery,
      },
    });

    revalidatePath("/yonetim/kurulumlar");
    revalidatePath(`/yonetim/kurulumlar/${taskId}`);
    revalidatePath("/yonetim/hizmetler");
    revalidatePath(`/yonetim/siparisler/${result.orderId}`);
    revalidatePath("/musteri/panel/hizmetlerim");
    revalidatePath(`/musteri/panel/hizmetlerim/${result.serviceId}`);
    return { success: true as const, serviceId: result.serviceId };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false as const,
        error: error.issues[0]?.message ?? "Geçersiz bilgiler",
        field: String(error.issues[0]?.path[0] ?? ""),
      };
    }
    if (error instanceof ManualProvisioningError) {
      return { success: false as const, error: errorMessages[error.code] };
    }
    log.error("manual provisioning activation failed", { taskId, error });
    return { success: false as const, error: "Hizmet aktifleştirilirken bir hata oluştu" };
  }
}
