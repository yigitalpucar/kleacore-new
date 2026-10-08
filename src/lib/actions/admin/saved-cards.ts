"use server";

import { revalidatePath } from "next/cache";
import { updateSettings } from "@/lib/actions/admin/settings";
import { SAVED_CARD_SETTING_KEYS } from "@/lib/payments/saved-cards";
import { requirePermission } from "@/lib/utils/auth-helpers";

const PAGE = "/yonetim/faturalar/otomatik-tahsilat";

function intField(formData: FormData, name: string, fallback: number, min: number, max: number) {
  const value = Number.parseInt(String(formData.get(name) ?? ""), 10);
  return String(Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback);
}

/** Saved cards on/off, max auto-charge attempts per invoice, grace window. */
export async function saveSavedCardSettings(formData: FormData) {
  await requirePermission("invoices.edit");
  const result = await updateSettings([
    { key: SAVED_CARD_SETTING_KEYS.enabled, value: String(formData.get("enabled") === "on") },
    { key: SAVED_CARD_SETTING_KEYS.maxAttempts, value: intField(formData, "maxAttempts", 3, 1, 10) },
    { key: SAVED_CARD_SETTING_KEYS.graceDays, value: intField(formData, "graceDays", 3, 0, 30) },
  ]);
  revalidatePath(PAGE);
  if (!result.success) throw new Error(result.error ?? "Ayarlar kaydedilemedi");
}
