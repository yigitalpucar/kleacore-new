/**
 * Customer 360 header figures (UI3 item 12): a few aggregates per customer,
 * each loaded only when the viewer may see it.
 */
import { db } from "@/lib/db";
import { money, sub } from "@/lib/money";

/** Paid invoices of the customer: KDV dahil + KDV hariç. */
export async function getCustomerLifetimeRevenue(customerId: string) {
  const agg = await db.invoice.aggregate({
    where: { customerId, status: "PAID" },
    _sum: { totalAmount: true, subtotal: true, refundedAmount: true },
    _count: { _all: true },
  });
  return {
    gross: money(agg._sum.totalAmount ?? 0).toFixed(2),
    net: money(agg._sum.subtotal ?? 0).toFixed(2),
    refunded: money(agg._sum.refundedAmount ?? 0).toFixed(2),
    count: agg._count._all,
  };
}

/** Overdue invoices: remaining amount (total − paid) and count. */
export async function getCustomerOverdue(customerId: string) {
  const agg = await db.invoice.aggregate({
    where: { customerId, status: "OVERDUE" },
    _sum: { totalAmount: true, paidAmount: true },
    _count: { _all: true },
  });
  const remaining = sub(agg._sum.totalAmount ?? 0, agg._sum.paidAmount ?? 0);
  return { amount: (remaining.isNegative() ? money(0) : remaining).toFixed(2), count: agg._count._all };
}

/** Latest order risk evaluation (score vs threshold) and how many are waiting for review. */
export async function getCustomerRisk(customerId: string) {
  const [latest, inReview] = await Promise.all([
    db.fraudCheck.findFirst({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      select: { score: true, threshold: true, status: true, createdAt: true },
    }),
    db.fraudCheck.count({ where: { customerId, status: "REVIEW" } }),
  ]);
  return latest ? { ...latest, createdAt: latest.createdAt.toISOString(), inReview } : null;
}
