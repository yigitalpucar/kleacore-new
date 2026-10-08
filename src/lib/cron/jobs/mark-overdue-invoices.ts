import { db } from "@/lib/db";
import { emitEvent } from "@/lib/events/emit";
import { getSuspendGraceDays } from "./suspend-overdue-services";
import type { CronJobResult } from "./types";

/**
 * PENDING invoices past their due date become OVERDUE. Each flip and its
 * invoice.overdue event commit together; the outbox notifications subscriber
 * sends "fatura gecikti" (e-mail + SMS when configured) once per invoice.
 */
export async function markOverdueInvoices(now = new Date()): Promise<CronJobResult> {
  const pending = await db.invoice.findMany({
    where: {
      status: "PENDING",
      dueDate: { lt: now },
    },
    select: { id: true, invoiceNumber: true, customerId: true, totalAmount: true, dueDate: true },
  });

  if (pending.length === 0) {
    return { processed: 0, ids: [] };
  }

  const suspendAfterDays = await getSuspendGraceDays();
  const ids: string[] = [];

  for (const invoice of pending) {
    const flipped = await db.$transaction(async (tx) => {
      // Conditional: a payment that landed meanwhile keeps the invoice PAID.
      const updated = await tx.invoice.updateMany({
        where: { id: invoice.id, status: "PENDING" },
        data: { status: "OVERDUE" },
      });
      if (updated.count === 0) return false;
      await emitEvent(tx, "invoice.overdue", {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerId: invoice.customerId,
        totalAmount: invoice.totalAmount,
        dueDate: invoice.dueDate,
        suspendAfterDays,
      });
      return true;
    });
    if (flipped) ids.push(invoice.id);
  }

  return { processed: ids.length, ids };
}
