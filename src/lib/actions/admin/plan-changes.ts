"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/utils/auth-helpers";
import { approvePlanChangeDowngrade } from "@/lib/services/plan-change";

export async function approvePendingPlanChangeDowngrade(planChangeId: string) {
  const session = await requireAdmin();

  try {
    const result = await approvePlanChangeDowngrade(planChangeId, session.user.id);

    revalidatePath("/yonetim/siparisler/yukseltme-dusurme");
    revalidatePath("/yonetim/siparisler");

    if (result.serviceId) {
      revalidatePath(`/musteri/panel/hizmetlerim/${result.serviceId}`);
      revalidatePath("/musteri/panel/hizmetlerim");
    }

    return { success: true, data: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";

    const errorMessages: Record<string, string> = {
      PLAN_CHANGE_NOT_FOUND: "Paket değişikliği bulunamadı",
      NOT_A_DOWNGRADE: "Yalnızca düşürme talepleri onaylanabilir",
      PLAN_CHANGE_NOT_PENDING: "Bu talep zaten işlenmiş",
    };

    return {
      success: false,
      error: errorMessages[message] ?? "Paket değişikliği onaylanırken bir hata oluştu",
    };
  }
}