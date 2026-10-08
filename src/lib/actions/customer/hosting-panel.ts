"use server";

/**
 * Customer hosting panel access (Faz 2.6): cPanel / Webmail single sign-on,
 * initial password reveal and password reset. Ownership + ACTIVE checks live
 * in src/lib/services/panel-access.ts. Login URLs and passwords are returned
 * to the requesting customer only; they are never logged.
 */
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity-log";
import { createLogger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  createPanelLoginUrl,
  isPanelLink,
  resetPanelPassword,
  revealPanelPassword,
  type PanelLink,
} from "@/lib/services/panel-access";
import { requireCustomer } from "@/lib/utils/auth-helpers";

const log = createLogger("actions.customer.hosting-panel");

type Result<T> = ({ success: true } & T) | { success: false; error: string };

const RATE_LIMITED = "Çok fazla deneme yaptınız. Lütfen biraz sonra tekrar deneyin.";

async function allowed(key: string, limit: number, windowMs: number) {
  const result = await checkRateLimit({ key, limit, windowMs });
  return result.allowed;
}

/** Fresh one-time login URL; the client opens it right away (valid for seconds). */
export async function openHostingPanel(serviceId: string, link: PanelLink): Promise<Result<{ url: string }>> {
  const session = await requireCustomer();
  if (!isPanelLink(link)) return { success: false, error: "Geçersiz bağlantı." };
  if (!(await allowed(`panel-sso:${session.user.id}`, 30, 10 * 60 * 1000))) return { success: false, error: RATE_LIMITED };

  const result = await createPanelLoginUrl(serviceId, link, { kind: "customer", userId: session.user.id });
  if (!result.ok) return { success: false, error: result.message };
  return { success: true, url: result.data.url };
}

/** Shows the stored panel password after the customer confirmed. */
export async function revealHostingPanelPassword(
  serviceId: string
): Promise<Result<{ username: string | null; password: string }>> {
  const session = await requireCustomer();
  if (!(await allowed(`panel-reveal:${session.user.id}`, 10, 10 * 60 * 1000))) return { success: false, error: RATE_LIMITED };

  const result = await revealPanelPassword(serviceId, { kind: "customer", userId: session.user.id });
  if (!result.ok) return { success: false, error: result.message };

  await logActivity({
    userId: session.user.id,
    action: "SERVICE_PANEL_PASSWORD_REVEAL",
    entity: "Service",
    entityId: serviceId,
  }).catch((error) => log.warn("activity log failed", { serviceId, error }));
  return { success: true, username: result.data.username, password: result.data.password };
}

/** WHM passwd with a new random password; returns it once and stores it encrypted. */
export async function resetHostingPanelPassword(
  serviceId: string
): Promise<Result<{ username: string | null; password: string }>> {
  const session = await requireCustomer();
  if (!(await allowed(`panel-reset:${session.user.id}`, 3, 60 * 60 * 1000))) return { success: false, error: RATE_LIMITED };

  const result = await resetPanelPassword(serviceId, { kind: "customer", userId: session.user.id });
  if (!result.ok) return { success: false, error: result.message };

  await logActivity({
    userId: session.user.id,
    action: "SERVICE_PANEL_PASSWORD_RESET",
    entity: "Service",
    entityId: serviceId,
  }).catch((error) => log.warn("activity log failed", { serviceId, error }));
  revalidatePath(`/musteri/panel/hizmetlerim/${serviceId}`);
  return { success: true, username: result.data.username, password: result.data.password };
}
