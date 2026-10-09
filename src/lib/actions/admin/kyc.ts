"use server";

import { revalidatePath } from "next/cache";
import { KycError, approveKyc, rejectKyc } from "@/lib/kyc/service";
import { createLogger } from "@/lib/logger";
import { requirePermission } from "@/lib/utils/auth-helpers";

const log = createLogger("admin.kyc");

type ActionResult = { success: true; message: string } | { success: false; error: string };

function revalidateKyc(userId: string) {
  revalidatePath("/yonetim/kyc");
  revalidatePath(`/yonetim/kyc/${userId}`);
  revalidatePath("/yonetim/siparisler/inceleme");
}

export async function approveKycAction(userId: string): Promise<ActionResult> {
  const session = await requirePermission("kyc.review");
  try {
    const { released } = await approveKyc({ userId: String(userId), reviewerId: session.user.id });
    revalidateKyc(userId);
    return {
      success: true,
      message: released > 0 ? `Kimlik doğrulandı; ${released} siparişin kurulumu başlatıldı.` : "Kimlik doğrulandı.",
    };
  } catch (error) {
    if (error instanceof KycError) return { success: false, error: error.message };
    log.error("approve kyc failed", { userId, error });
    return { success: false, error: "Onaylanırken bir hata oluştu." };
  }
}

export async function rejectKycAction(userId: string, reason: string): Promise<ActionResult> {
  const session = await requirePermission("kyc.review");
  try {
    const { deleteAfter } = await rejectKyc({ userId: String(userId), reviewerId: session.user.id, reason: String(reason ?? "") });
    revalidateKyc(userId);
    return {
      success: true,
      message: `Kimlik doğrulaması reddedildi; belgeler ${deleteAfter.toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })} tarihinde silinecek.`,
    };
  } catch (error) {
    if (error instanceof KycError) return { success: false, error: error.message };
    log.error("reject kyc failed", { userId, error });
    return { success: false, error: "Reddedilirken bir hata oluştu." };
  }
}
