import { db } from "@/lib/db";
import { getSettingValue, isEnabled } from "@/lib/integrations/settings";
import { dispatchSmsNotification, sendSmsNotification } from "@/lib/notifications/sms";
import type { CronJobResult } from "./types";

async function notifyOverdueInvoicesBySms(invoiceIds: string[]) {
  const smsEnabled = isEnabled(
    await getSettingValue("sms_notifications", undefined, "false")
  );
  if (!smsEnabled || invoiceIds.length === 0) {
    return;
  }

  const invoices = await db.invoice.findMany({
    where: { id: { in: invoiceIds } },
    select: {
      invoiceNumber: true,
      customerId: true,
    },
  });

  for (const invoice of invoices) {
    dispatchSmsNotification(() =>
      sendSmsNotification({
        customerId: invoice.customerId,
        message: `Gecikmiş faturanız: ${invoice.invoiceNumber}. Lütfen ödeme yapın.`,
        template: "invoice_overdue",
      })
    );
  }
}

export async function markOverdueInvoices(): Promise<CronJobResult> {
  const now = new Date();

  const pending = await db.invoice.findMany({
    where: {
      status: "PENDING",
      dueDate: { lt: now },
    },
    select: { id: true },
  });

  if (pending.length === 0) {
    return { processed: 0, ids: [] };
  }

  const ids = pending.map((invoice) => invoice.id);

  await db.invoice.updateMany({
    where: { id: { in: ids } },
    data: { status: "OVERDUE" },
  });

  await notifyOverdueInvoicesBySms(ids);

  return { processed: ids.length, ids };
}