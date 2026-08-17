import { db } from "@/lib/db";
import type { EInvoiceStatus } from "@prisma/client";

export async function getEInvoiceRecordsForAdmin(status?: EInvoiceStatus | "all") {
  return db.eInvoiceRecord.findMany({
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
}

export async function getEInvoiceStats() {
  const [draft, queued, sent, accepted, rejected, failed] = await Promise.all([
    db.eInvoiceRecord.count({ where: { status: "DRAFT" } }),
    db.eInvoiceRecord.count({ where: { status: "QUEUED" } }),
    db.eInvoiceRecord.count({ where: { status: "SENT" } }),
    db.eInvoiceRecord.count({ where: { status: "ACCEPTED" } }),
    db.eInvoiceRecord.count({ where: { status: "REJECTED" } }),
    db.eInvoiceRecord.count({ where: { status: "FAILED" } }),
  ]);

  return {
    draft,
    queued,
    sent,
    accepted,
    rejected,
    failed,
    total: draft + queued + sent + accepted + rejected + failed,
  };
}