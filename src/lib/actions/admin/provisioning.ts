"use server";

import { retryProvisioningJobAs } from "@/lib/provisioning/admin-retry";
import { requirePermission } from "@/lib/utils/auth-helpers";
import { revalidatePath } from "next/cache";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin.provisioning");

export async function retryProvisioningJobAction(jobId: string) {
  const session = await requirePermission("provisioning.manage");

  try {
    const result = await retryProvisioningJobAs(session.user.id, jobId);

    revalidatePath("/yonetim/provisioning");
    revalidatePath("/yonetim/siparisler");
    revalidatePath("/yonetim/hizmetler");

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true };
  } catch (error) {
    log.error("manual provisioning retry failed", { error });
    return { success: false, error: "Provisioning yeniden denenirken bir hata oluştu" };
  }
}
