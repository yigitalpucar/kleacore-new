/**
 * STUB (fulfil branch) of the shared notification entry point. The notify
 * branch owns the real implementation (templates, NotificationLog, channels);
 * callers only depend on the agreed signature below, which enqueues the
 * "notification.send" job.
 */
import { createLogger } from "@/lib/logger";

const log = createLogger("notifications.send");

export type NotificationChannel = "email" | "sms" | "all";

export interface SendNotificationInput {
  userId: string;
  template: string;
  data?: Record<string, unknown>;
  channel?: NotificationChannel;
}

export async function sendNotification(input: SendNotificationInput) {
  const { enqueue } = await import("@/lib/jobs/enqueue");
  return enqueue("notification.send", {
    userId: input.userId,
    template: input.template,
    data: input.data ?? {},
    channel: input.channel,
  });
}

/** Stub handler of "notification.send" until the notify branch lands. */
export async function deliverNotificationStub(input: {
  userId: string;
  template: string;
  data: Record<string, unknown>;
}) {
  if (input.template === "payment_received" && typeof input.data.invoiceId === "string") {
    const { notifyInvoicePaymentReceived } = await import("@/lib/payments/fulfillment");
    await notifyInvoicePaymentReceived(input.data.invoiceId);
    return { delivered: true };
  }

  log.warn("no handler for notification template (stub)", { template: input.template });
  return { delivered: false };
}
