"use server";

import { revalidatePath } from "next/cache";
import { setMarketingConsent } from "@/lib/broadcasts/consent";
import { getRequestMeta } from "@/lib/request-meta";
import { requireCustomer } from "@/lib/utils/auth-helpers";

/**
 * "Kampanya ve duyurular" toggle (Hesap ayarları → Bildirimler). Opting in
 * records a ConsentRecord with the consent text; opting out revokes it and
 * takes effect for broadcasts already being sent.
 */
export async function updateMarketingConsent(granted: boolean) {
  const session = await requireCustomer();
  try {
    const meta = await getRequestMeta();
    await setMarketingConsent(session.user.id, Boolean(granted), {
      source: "panel",
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    revalidatePath("/musteri/panel/ayarlar");
    return { success: true as const, granted: Boolean(granted) };
  } catch {
    return { success: false as const, error: "Tercih kaydedilemedi" };
  }
}
