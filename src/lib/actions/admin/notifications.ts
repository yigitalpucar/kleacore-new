"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity-log";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { revealSensitive } from "@/lib/notifications/render";
import { sendNotification } from "@/lib/notifications/send";
import { getTemplate, hasTemplate, type TemplateKey } from "@/lib/notifications/templates";
import { requirePermission } from "@/lib/utils/auth-helpers";

const log = createLogger("admin.notifications");

/**
 * "Yeniden gönder": queues a new log row with the same template, data,
 * channel and recipient (the original row stays as history). Sensitive
 * fields are decrypted only to be re-encrypted by sendNotification.
 */
export async function resendNotificationAction(logId: string) {
  const session = await requirePermission("settings.manage");

  try {
    const original = await db.notificationLog.findUnique({ where: { id: logId } });
    if (!original) return { success: false as const, error: "Bildirim kaydı bulunamadı" };
    if (!hasTemplate(original.template)) {
      return { success: false as const, error: "Bu bildirimin şablonu artık yok" };
    }
    if (original.status === "QUEUED") {
      return { success: false as const, error: "Bildirim zaten gönderim sırasında" };
    }

    const template = getTemplate(original.template);
    const data = revealSensitive(template, (original.data ?? {}) as Record<string, unknown>);

    const result = await sendNotification({
      userId: original.userId,
      template: original.template as TemplateKey,
      data: data as never,
      channel: original.channel,
      to: original.channel === "EMAIL" ? original.to : undefined,
      phone: original.channel === "SMS" ? original.to : undefined,
      resendOfId: original.id,
    });

    if (!result.ok || result.logIds.length === 0) {
      return {
        success: false as const,
        error:
          result.error ??
          (original.channel === "SMS" ? "SMS gönderimi kapalı veya yapılandırılmamış" : "Bildirim kuyruğa alınamadı"),
      };
    }

    await logActivity({
      userId: session.user.id,
      action: "NOTIFICATION_RESEND",
      entity: "NotificationLog",
      entityId: original.id,
      details: { template: original.template, channel: original.channel, newLogId: result.logIds[0] },
    });

    revalidatePath("/yonetim/bildirimler");
    return { success: true as const, logId: result.logIds[0] };
  } catch (error) {
    log.error("notification resend failed", { error, logId });
    return { success: false as const, error: "Bildirim yeniden gönderilemedi" };
  }
}
