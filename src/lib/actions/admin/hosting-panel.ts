"use server";

/**
 * Admin "cPanel'e giriş (müşteri olarak)": one-time cPanel / Webmail login
 * for a customer's hosting account. Every login is recorded in the activity
 * log (who, which service, which area) — never the URL, it is a credential.
 */
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity-log";
import { createPanelLoginUrl, isPanelLink, type PanelLink } from "@/lib/services/panel-access";
import { requireAdmin } from "@/lib/utils/auth-helpers";

export async function openServicePanelAsAdmin(
  serviceId: string,
  link: PanelLink
): Promise<{ success: true; url: string } | { success: false; error: string }> {
  const session = await requireAdmin();
  if (!isPanelLink(link)) return { success: false, error: "Geçersiz bağlantı." };

  const result = await createPanelLoginUrl(serviceId, link, { kind: "admin", userId: session.user.id });
  if (!result.ok) return { success: false, error: result.message };

  await logActivity({
    userId: session.user.id,
    action: "SERVICE_PANEL_LOGIN_AS_CUSTOMER",
    entity: "Service",
    entityId: serviceId,
    details: { link, remoteId: result.data.remoteId, customerId: result.data.customerId },
  });
  revalidatePath("/yonetim/aktivite");
  return { success: true, url: result.data.url };
}
