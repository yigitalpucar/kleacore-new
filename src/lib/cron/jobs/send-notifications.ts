import { sendInvoiceNotices } from "@/lib/notifications/billing-notices";
import { requeueStaleNotifications } from "@/lib/notifications/queue";
import { runInvoiceReminderSchedule } from "@/lib/notifications/reminder-schedule";

/**
 * Hourly (08–21, Europe/Istanbul): "fatura oluştu / gecikti" catch-up
 * (idempotent per invoice and type), the configurable reminder schedule
 * (vade −3/−1, +1/+3/+7, son uyarı; once per invoice and step) and the
 * outbox reconcile for notifications whose queue job was never created.
 */
export async function sendScheduledNotifications() {
  const invoices = await sendInvoiceNotices();
  const reminders = await runInvoiceReminderSchedule();
  const outbox = await requeueStaleNotifications();
  return { invoices, reminders, outbox };
}
