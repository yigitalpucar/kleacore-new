import type { NotificationType } from "@prisma/client";
import type { z } from "zod";
import {
  NOTIFICATION_SEND_JOB,
  notificationPayloadSchema,
} from "./payload";
import { createLogger } from "@/lib/logger";

/**
 * STUB (domains agent, Faz 1 dalga B) — the notify agent owns this module and
 * replaces the handler with templates, NotificationLog and real delivery.
 * The agreed signature is kept: `sendNotification({ userId, template, data, channel? })`
 * enqueues a "notification.send" job.
 *
 * Until then the handler only writes an in-app `Notification` row when `data`
 * carries `title` + `message`, so nothing is lost silently.
 */

const log = createLogger("notifications");

const NOTIFICATION_TYPES = new Set<string>(["INFO", "WARNING", "ERROR", "SUCCESS"]);

export { NOTIFICATION_SEND_JOB, notificationPayloadSchema };
export type { NotificationChannel } from "./payload";

export type SendNotificationInput = z.input<typeof notificationPayloadSchema>;

export async function sendNotification(input: SendNotificationInput) {
  const { enqueue } = await import("@/lib/jobs/enqueue");
  return enqueue(NOTIFICATION_SEND_JOB, input);
}

/** Queue handler (stub): in-app notification only. */
export async function deliverNotification(payload: z.output<typeof notificationPayloadSchema>) {
  const title = typeof payload.data.title === "string" ? payload.data.title : null;
  const message = typeof payload.data.message === "string" ? payload.data.message : null;
  const link = typeof payload.data.link === "string" ? payload.data.link : null;

  if (!title || !message) {
    log.info("notification stub: no title/message, nothing delivered", {
      template: payload.template,
      userId: payload.userId,
    });
    return { delivered: false };
  }

  const { db } = await import("@/lib/db");
  const user = await db.user.findUnique({ where: { id: payload.userId }, select: { id: true } });
  if (!user) return { delivered: false, reason: "USER_NOT_FOUND" };

  await db.notification.create({
    data: {
      userId: payload.userId,
      type: NOTIFICATION_TYPES.has(String(payload.data.type)) ? (payload.data.type as NotificationType) : "INFO",
      title,
      message,
      link,
    },
  });
  return { delivered: true, channel: "inapp" };
}
