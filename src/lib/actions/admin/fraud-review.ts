"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity-log";
import { FRAUD_RULE_IDS } from "@/lib/fraud/rules";
import { FraudReviewError, approveFraudReview, rejectFraudReview, type RefundMethodChoice } from "@/lib/fraud/review";
import { FRAUD_SETTING_KEYS, ruleWeightSettingKey } from "@/lib/fraud/settings";
import { KYC_SETTING_KEYS, parseCategoryList } from "@/lib/kyc/settings";
import { createLogger } from "@/lib/logger";
import { requirePermission } from "@/lib/utils/auth-helpers";

const log = createLogger("admin.fraud-review");

type ActionResult = { success: true; message: string } | { success: false; error: string };

function revalidateOrder(orderId: string) {
  revalidatePath("/yonetim/siparisler/inceleme");
  revalidatePath(`/yonetim/siparisler/${orderId}`);
  revalidatePath("/yonetim/siparisler");
}

/** "Onayla" on a reviewed order: payment unblocked; a paid order goes to provisioning (unless KYC still holds it). */
export async function approveOrderReviewAction(orderId: string, note?: string): Promise<ActionResult> {
  const session = await requirePermission("orders.manage");
  try {
    const { paid, release } = await approveFraudReview({ orderId: String(orderId), reviewerId: session.user.id, note });
    revalidateOrder(orderId);
    if (release?.released) return { success: true, message: "Sipariş onaylandı, kurulum başlatıldı." };
    if (release && !release.released && release.reasons.includes("KYC")) {
      return { success: true, message: "Sipariş onaylandı; kurulum müşterinin kimlik doğrulamasını bekliyor." };
    }
    return { success: true, message: paid ? "Sipariş onaylandı." : "Sipariş onaylandı; müşteri ödemeyi tamamlayabilir." };
  } catch (error) {
    if (error instanceof FraudReviewError) return { success: false, error: error.message };
    log.error("approve review failed", { orderId, error });
    return { success: false, error: "Onaylanırken bir hata oluştu." };
  }
}

/** "Reddet": unpaid → order + invoice cancelled; paid → refund (chosen method) and order cancelled. */
export async function rejectOrderReviewAction(
  orderId: string,
  input: { reason: string; refundMethod?: RefundMethodChoice; manualReference?: string }
): Promise<ActionResult> {
  const session = await requirePermission("orders.manage");
  const refundMethod = input.refundMethod && ["GATEWAY", "BALANCE", "MANUAL"].includes(input.refundMethod) ? input.refundMethod : undefined;
  // A paid order is refunded on rejection: that needs the refund permission,
  // as on the invoice page (outside try: forbidden() must propagate).
  const invoice = await db.invoice.findFirst({ where: { orderId: String(orderId) }, select: { status: true } });
  if (invoice?.status === "PAID") await requirePermission("payments.refund");
  try {
    const { paid, refund } = await rejectFraudReview({
      orderId: String(orderId),
      reviewerId: session.user.id,
      reason: String(input.reason ?? ""),
      refundMethod,
      manualReference: input.manualReference?.trim() || null,
    });
    revalidateOrder(orderId);
    if (!paid) return { success: true, message: "Sipariş reddedildi; sipariş ve fatura iptal edildi." };
    if (refund?.status === "COMPLETED") return { success: true, message: "Sipariş reddedildi ve ödeme iade edildi." };
    if (refund?.status === "PENDING") {
      return { success: true, message: `Sipariş reddedildi; iade sonucu belirsiz, fatura sayfasından kontrol edin. ${refund.message}` };
    }
    return {
      success: true,
      message: `Sipariş reddedildi ancak iade yapılamadı: ${refund?.message ?? "bilinmeyen hata"}. Fatura sayfasından iade edin.`,
    };
  } catch (error) {
    if (error instanceof FraudReviewError) return { success: false, error: error.message };
    log.error("reject review failed", { orderId, error });
    return { success: false, error: "Reddedilirken bir hata oluştu." };
  }
}

function clampInt(value: FormDataEntryValue | null, min: number, max: number) {
  const parsed = Number(String(value ?? "").trim());
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return null;
  return String(parsed);
}

/** Siparişler → İnceleme → Ayarlar (rules, thresholds, KYC categories / retention). */
export async function saveFraudSettingsAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("settings.manage");

  const values: Record<string, string> = {
    [FRAUD_SETTING_KEYS.enabled]: formData.get("enabled") === "on" ? "true" : "false",
    [FRAUD_SETTING_KEYS.trustCfHeader]: formData.get("trustCfHeader") === "on" ? "true" : "false",
  };
  const numeric: Array<[string, string, number, number]> = [
    [FRAUD_SETTING_KEYS.reviewThreshold, "reviewThreshold", 1, 1000],
    [FRAUD_SETTING_KEYS.blockThreshold, "blockThreshold", 0, 1000],
    [FRAUD_SETTING_KEYS.sameIpLimit, "sameIpLimit", 0, 100],
    [KYC_SETTING_KEYS.rejectedRetentionDays, "rejectedRetentionDays", 0, 3650],
    [KYC_SETTING_KEYS.approvedRetentionDaysAfterServiceEnd, "approvedRetentionDays", 0, 3650],
    ...FRAUD_RULE_IDS.map((rule) => [ruleWeightSettingKey(rule), `weight_${rule}`, 0, 100] as [string, string, number, number]),
  ];
  for (const [key, field, min, max] of numeric) {
    const value = clampInt(formData.get(field), min, max);
    if (value === null) return { success: false, error: `Geçersiz değer: ${field} (${min}–${max} arası tam sayı)` };
    values[key] = value;
  }
  const categories = parseCategoryList(String(formData.get("kycCategories") ?? ""));
  values[KYC_SETTING_KEYS.requiredCategories] = categories.length > 0 ? categories.join(",") : "-";

  try {
    await db.$transaction(
      Object.entries(values).map(([key, value]) =>
        db.setting.upsert({ where: { key }, create: { key, value }, update: { value } })
      )
    );
    await logActivity({ userId: session.user.id, action: "FRAUD_SETTINGS_UPDATED", entity: "Setting", details: values });
    revalidatePath("/yonetim/siparisler/inceleme/ayarlar");
    return { success: true, message: "Ayarlar kaydedildi." };
  } catch (error) {
    log.error("save fraud settings failed", { error });
    return { success: false, error: "Ayarlar kaydedilemedi." };
  }
}
