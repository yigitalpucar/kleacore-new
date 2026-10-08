import { db } from "@/lib/db";
import { notifyOverdueInvoices } from "@/lib/notifications/billing-notices";
import type { CronJobResult } from "./types";

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

  // "Fatura gecikti" e-mail (+ SMS when configured), once per invoice.
  await notifyOverdueInvoices(ids, now);

  return { processed: ids.length, ids };
}
