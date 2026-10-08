import { db } from "@/lib/db";
import type { EInvoiceStatus } from "@prisma/client";
import { serializeMoney } from "@/lib/money";

/** Admin list rows; invoice amounts are plain numbers (passed to a client component). */
export async function getEInvoiceRecordsForAdmin(status?: EInvoiceStatus | "all") {
  const records = await db.eInvoiceRecord.findMany({
    where: status && status !== "all" ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      invoice: {
        select: {
          invoiceNumber: true,
          totalAmount: true,
          customer: {
            select: {
              name: true,
              surname: true,
              companyName: true,
            },
          },
        },
      },
    },
  });
  return serializeMoney(records);
}

export async function getEInvoiceStats() {
  const grouped = await db.eInvoiceRecord.groupBy({ by: ["status"], _count: { _all: true } });
  const count = (status: EInvoiceStatus) => grouped.find((row) => row.status === status)?._count._all ?? 0;

  const stats = {
    draft: count("DRAFT"),
    queued: count("QUEUED"),
    sent: count("SENT"),
    accepted: count("ACCEPTED"),
    rejected: count("REJECTED"),
    failed: count("FAILED"),
    cancelled: count("CANCELLED"),
  };

  return { ...stats, total: Object.values(stats).reduce((sum, value) => sum + value, 0) };
}

