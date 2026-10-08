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

export const DOMAIN_RENEW_JOB = "domain.renew";

/**
 * Registrar renew of a paid DomainRenewal row (src/lib/domains/renew.ts),
 * queued in the payment transaction by onDomainRenewalPaid.
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

export const EFATURA_ISSUE_JOB = "efatura.issue";

/**
 * Issues the official e-invoice of a paid invoice (Uyumsoft / Paraşüt),
 * queued in the payment transaction. `issueEInvoiceForInvoice` is idempotent
 * (one record + stable ETTN per invoice); the EInvoiceRecord row is the admin
 * record (/yonetim/e-fatura). Build errors (bad invoice data) are final and
 * not retried; entegratör/network errors are.
 */
export const efaturaIssueJob = defineJob({
  name: EFATURA_ISSUE_JOB,
  label: "E-fatura kesimi",
  schema: z.object({ invoiceId: z.string().min(1) }).strict(),
  queue: {
    policy: "exclusive",
    retryLimit: 5,
    retryDelay: 5 * 60,
    retryBackoff: true,
    retryDelayMax: 6 * 60 * 60,
    expireInSeconds: 5 * 60,
  },
  handler: async ({ invoiceId }) => {
    const { runEInvoiceIssueJob } = await import("@/lib/payments/follow-ups");
    return runEInvoiceIssueJob(invoiceId);
  },
});

export const PAYMENT_SETTLED_JOB = "payment.settled";

const kleacoreEventSchema = z.object({
  type: z.enum(["payment.completed", "order.paid", "service.renewed"]),
  payload: z.record(z.string(), z.unknown()),
});

/**
 * Side effects of a paid invoice that must not run before the payment
 * committed: outbound webhooks + activity log events and the "ödeme alındı"
 * notification. Queued in the payment transaction.
 */
export const paymentSettledJob = defineJob({
  name: PAYMENT_SETTLED_JOB,
  label: "Ödeme sonrası bildirimler",
  schema: z
    .object({
      invoiceId: z.string().min(1),
      userId: z.string().min(1),
      events: z.array(kleacoreEventSchema),
    })
    .strict(),
  queue: {
    policy: "exclusive",
    retryLimit: 3,
    retryDelay: 60,
    retryBackoff: true,
    expireInSeconds: 5 * 60,
  },
  handler: async (payload) => {
    const { runPaymentSettledJob } = await import("@/lib/payments/follow-ups");
    return runPaymentSettledJob(payload);
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

export const SERVER_REINSTALL_JOB = "server.reinstall";

/**
 * Customer-confirmed VDS reinstall (Proxmox: destroy → re-clone into the same
 * VMID with the same IP). The module's reinstall is resumable through
 * Service.moduleData, so a retry continues instead of starting over; the
 * final failure flags the service for the admin. 3 attempts, 2 / 4 min apart.
 */
export const serverReinstallJob = defineJob({
  name: SERVER_REINSTALL_JOB,
  label: "Sunucu yeniden kurulumu",
  schema: z.object({ serviceId: z.string().min(1) }).strict(),
  queue: {
    policy: "exclusive",
    retryLimit: 2,
    retryDelay: 2 * 60,
    retryBackoff: true,
    expireInSeconds: 10 * 60,
  },
  handler: async ({ serviceId }, context) => {
    const { runServerReinstallJob } = await import("@/lib/modules/server-panel");
    return runServerReinstallJob(serviceId, context);
  },
});

const definitions = [
  provisioningRunJob,
  domainRenewJob,
  efaturaIssueJob,
  paymentSettledJob,
  notificationSendJob,
  serverReinstallJob,
] as const;

export type RegisteredJob = (typeof definitions)[number];
export type JobName = RegisteredJob["name"];
export type JobPayload<N extends JobName> = z.input<Extract<RegisteredJob, { name: N }>["schema"]>;

export const jobRegistry = createRegistry<RegisteredJob>(definitions);
