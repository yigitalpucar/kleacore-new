import { z } from "zod";
import { createRegistry, defineJob } from "./registry";

/**
 * Every background job the app knows about. Handlers import their domain code
 * lazily so this module (and `enqueue`) stays cheap to import and free of
 * import cycles (provisioning code enqueues jobs itself).
 */

export const PROVISIONING_RUN_JOB = "provisioning.run";

/**
 * One attempt of a ProvisioningJob row (remote create / registrar / SSL /
 * unsuspend). The row stays the admin-visible record; pg-boss owns scheduling,
 * backoff and the terminal failed state. 5 attempts in total like the old cron
 * retry; backoff (pg-boss, with jitter) ≈ 10–20m, 20–40m, 40–80m, 80–160m.
 */
export const provisioningRunJob = defineJob({
  name: PROVISIONING_RUN_JOB,
  label: "Provisioning (kurulum / askı kaldırma)",
  schema: z.object({ provisioningJobId: z.string().min(1) }).strict(),
  queue: {
    policy: "exclusive",
    retryLimit: 4,
    retryDelay: 10 * 60,
    retryBackoff: true,
    retryDelayMax: 6 * 60 * 60,
    expireInSeconds: 10 * 60,
  },
  handler: async ({ provisioningJobId }, context) => {
    const { runQueuedProvisioningJob } = await import("@/lib/provisioning/retry-queue");
    return runQueuedProvisioningJob(provisioningJobId, context);
  },
});

export const NOTIFICATION_SEND_JOB = "notification.send";

/**
 * Delivers one NotificationLog row (one channel, one recipient) written by
 * sendNotification(). The row is the admin-visible record (/yonetim/bildirimler);
 * 5 attempts, backoff ≈ 1, 2, 4, 8 min (SMTP hiccups, provider timeouts).
 */
export const notificationSendJob = defineJob({
  name: NOTIFICATION_SEND_JOB,
  label: "Bildirim gönderimi (e-posta / SMS)",
  schema: z.object({ notificationLogId: z.string().min(1) }).strict(),
  queue: {
    policy: "exclusive",
    retryLimit: 4,
    retryDelay: 60,
    retryBackoff: true,
    retryDelayMax: 60 * 60,
    expireInSeconds: 2 * 60,
  },
  handler: async ({ notificationLogId }, context) => {
    const { deliverNotificationLog } = await import("@/lib/notifications/deliver");
    return deliverNotificationLog(notificationLogId, context);
  },
});

const definitions = [provisioningRunJob, notificationSendJob] as const;

export type RegisteredJob = (typeof definitions)[number];
export type JobName = RegisteredJob["name"];
export type JobPayload<N extends JobName> = z.input<Extract<RegisteredJob, { name: N }>["schema"]>;

export const jobRegistry = createRegistry<RegisteredJob>(definitions);
