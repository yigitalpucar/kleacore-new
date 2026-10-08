import { db } from "@/lib/db";
import { toNumber } from "@/lib/money";
import { formatIban } from "@/lib/payments/bank-transfer/iban";

export interface BankAccountView {
  id: string;
  bankName: string;
  branch: string;
  accountName: string;
  iban: string;
  ibanFormatted: string;
  currency: string;
  isActive: boolean;
  sortOrder: number;
}

function toView(account: {
  id: string;
  bankName: string;
  branch: string;
  accountName: string;
  iban: string;
  currency: string;
  isActive: boolean;
  sortOrder: number;
}): BankAccountView {
  return { ...account, ibanFormatted: formatIban(account.iban) };
}

export async function getBankAccounts(options: { activeOnly?: boolean } = {}) {
  const accounts = await db.bankAccount.findMany({
    where: options.activeOnly ? { isActive: true } : undefined,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return accounts.map(toView);
}

export interface BankTransferNoticeView {
  id: string;
  amount: number;
  transferDate: string;
  senderName: string;
  note: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  bankName: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export async function getInvoiceBankTransferNotices(invoiceId: string): Promise<BankTransferNoticeView[]> {
  const notices = await db.bankTransferNotice.findMany({
    where: { invoiceId },
    include: { bankAccount: { select: { bankName: true } } },
    orderBy: { createdAt: "desc" },
  });
  return notices.map((notice) => ({
    id: notice.id,
    amount: toNumber(notice.amount),
    transferDate: notice.transferDate.toISOString(),
    senderName: notice.senderName,
    note: notice.note,
    status: notice.status,
    rejectionReason: notice.rejectionReason,
    bankName: notice.bankAccount?.bankName ?? null,
    createdAt: notice.createdAt.toISOString(),
    reviewedAt: notice.reviewedAt?.toISOString() ?? null,
  }));
}

/** Admin queue: notices by status, newest first, with invoice and customer context. */
export async function getBankTransferNoticeQueue(status: "PENDING" | "APPROVED" | "REJECTED" = "PENDING") {
  const [notices, counts] = await Promise.all([
    db.bankTransferNotice.findMany({
      where: { status },
      include: {
        bankAccount: { select: { bankName: true } },
        invoice: { select: { id: true, invoiceNumber: true, totalAmount: true, paidAmount: true, status: true } },
        customer: { select: { id: true, name: true, surname: true, email: true, companyName: true } },
      },
      orderBy: { createdAt: status === "PENDING" ? "asc" : "desc" },
      take: 200,
    }),
    db.bankTransferNotice.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const count = (key: string) => counts.find((row) => row.status === key)?._count._all ?? 0;

  return {
    counts: { PENDING: count("PENDING"), APPROVED: count("APPROVED"), REJECTED: count("REJECTED") },
    notices: notices.map((notice) => ({
      id: notice.id,
      amount: toNumber(notice.amount),
      transferDate: notice.transferDate.toISOString(),
      senderName: notice.senderName,
      note: notice.note,
      status: notice.status,
      rejectionReason: notice.rejectionReason,
      bankName: notice.bankAccount?.bankName ?? null,
      createdAt: notice.createdAt.toISOString(),
      reviewedAt: notice.reviewedAt?.toISOString() ?? null,
      invoice: {
        id: notice.invoice.id,
        invoiceNumber: notice.invoice.invoiceNumber,
        status: notice.invoice.status,
        outstanding: Math.max(0, toNumber(notice.invoice.totalAmount) - toNumber(notice.invoice.paidAmount)),
      },
      customer: {
        id: notice.customer.id,
        name: `${notice.customer.name} ${notice.customer.surname}`.trim(),
        companyName: notice.customer.companyName,
        email: notice.customer.email,
      },
    })),
  };
}

export type BankTransferQueue = Awaited<ReturnType<typeof getBankTransferNoticeQueue>>;
