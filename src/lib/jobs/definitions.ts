import { z } from "zod";
import { notificationPayloadSchema, NOTIFICATION_SEND_JOB } from "@/lib/notifications/payload";
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

export const DOMAIN_RENEW_JOB = "domain.renew";

/**
 * Registrar renew of a paid DomainRenewal row (src/lib/domains/renew.ts).
 * Exclusive per renewal id. 5 attempts in total, backoff ≈ 10m, 20m, 40m, 80m
 * (capped at 6h); the final failure marks the row FAILED and notifies admins.
 */
export const domainRenewJob = defineJob({
  name: DOMAIN_RENEW_JOB,
  label: "Alan adı yenileme (registrar)",
  schema: z.object({ renewalId: z.string().min(1) }).strict(),
  queue: {
    policy: "exclusive",
    retryLimit: 4,
    retryDelay: 10 * 60,
    retryBackoff: true,
    retryDelayMax: 6 * 60 * 60,
    expireInSeconds: 5 * 60,
  },
  handler: async ({ renewalId }, context) => {
    const { runDomainRenewal } = await import("@/lib/domains/renew");
    return runDomainRenewal(renewalId, context);
  },
});

/**
 * Customer/admin notification. STUB handler (src/lib/notifications/send.ts);
 * the notify agent owns the real implementation.
 */
export const notificationSendJob = defineJob({
  name: NOTIFICATION_SEND_JOB,
  label: "Bildirim gönderimi",
  schema: notificationPayloadSchema,
  queue: { retryLimit: 3, retryDelay: 60, retryBackoff: true },
  handler: async (payload) => {
    const { deliverNotification } = await import("@/lib/notifications/send");
    return deliverNotification(payload);
  },
});

const definitions = [provisioningRunJob, domainRenewJob, notificationSendJob] as const;

export type RegisteredJob = (typeof definitions)[number];
export type JobName = RegisteredJob["name"];
export type JobPayload<N extends JobName> = z.input<Extract<RegisteredJob, { name: N }>["schema"]>;

export const jobRegistry = createRegistry<RegisteredJob>(definitions);
