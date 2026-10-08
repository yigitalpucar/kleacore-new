import { z } from "zod";

/** "notification.send" job payload (shared by the job registry and send.ts). */
export const NOTIFICATION_SEND_JOB = "notification.send";

export const notificationPayloadSchema = z.object({
  userId: z.string().min(1),
  template: z.string().min(1),
  data: z.record(z.string(), z.unknown()).default({}),
  channel: z.enum(["email", "sms", "inapp"]).optional(),
});

export type NotificationChannel = "email" | "sms" | "inapp";
