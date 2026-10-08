import { sendInvoiceNotices } from "@/lib/notifications/billing-notices";
import { requeueStaleNotifications } from "@/lib/notifications/queue";

/**
 * Hourly (08–21, Europe/Istanbul): invoice "oluştu / vade -3 / gecikti"
 * notices (idempotent per invoice and type) and the outbox reconcile for
 * notifications whose queue job was never created.
 */
export async function sendScheduledNotifications() {
  const invoices = await sendInvoiceNotices();
  const outbox = await requeueStaleNotifications();
  return { invoices, outbox };
}
