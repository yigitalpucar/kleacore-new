import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { finalizeFulfilledInvoices, fulfillInvoicePayment } from "@/lib/payments/fulfillment";
import { emitEvent } from "@/lib/events/emit";
import { isPositive, parseMoney, roundHalfUp, toFixed2, toNumber } from "@/lib/money";
import { getPaymentBlock } from "@/lib/fraud/evaluate";

export class BankTransferError extends Error {}

const OPEN_STATUSES = new Set(["PENDING", "OVERDUE"]);
const MAX_NOTE_LENGTH = 500;
/** Transfer dates more than a day ahead are typos (time zones allow one). */
const FUTURE_TOLERANCE_MS = 24 * 60 * 60 * 1000;

/** The text a customer writes into the transfer description: the invoice number. */
export function bankTransferReference(invoiceNumber: string) {
  return invoiceNumber;
}

/** Gateway-style reference for the Payment row an approved notice settles. */
export function noticePaymentReference(noticeId: string) {
  return `HVL-${noticeId}`;
}

export interface SubmitNoticeInput {
  customerId: string;
  invoiceId: string;
  amount: string | number;
  transferDate: string | Date;
  senderName: string;
  bankAccountId?: string | null;
  note?: string | null;
}

export function parseNoticeInput(input: SubmitNoticeInput, now = new Date()) {
  const parsedAmount = parseMoney(input.amount);
  const amount = parsedAmount ? roundHalfUp(parsedAmount) : null;
  if (!amount || !isPositive(amount)) throw new BankTransferError("Gönderilen tutarı girin.");

  const transferDate = input.transferDate instanceof Date ? input.transferDate : new Date(input.transferDate);
  if (Number.isNaN(transferDate.getTime())) throw new BankTransferError("Ödeme tarihini girin.");
  if (transferDate.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
    throw new BankTransferError("Ödeme tarihi ileri bir tarih olamaz.");
  }

  const senderName = input.senderName.trim();
  if (senderName.length < 3) throw new BankTransferError("Gönderen ad soyad / unvanını girin.");

  const note = input.note?.trim() ? input.note.trim().slice(0, MAX_NOTE_LENGTH) : null;
  return { amount, transferDate, senderName: senderName.slice(0, 120), note };
}

export async function submitBankTransferNotice(input: SubmitNoticeInput) {
  const parsed = parseNoticeInput(input);

  return db.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id: input.invoiceId },
      select: { id: true, customerId: true, status: true, invoiceNumber: true },
    });
    if (!invoice || invoice.customerId !== input.customerId) {
      throw new BankTransferError("Fatura bulunamadı.");
    }
    if (!OPEN_STATUSES.has(invoice.status)) {
      throw new BankTransferError("Bu fatura ödemeye açık değil.");
    }

    // Fraud review block (docs/fraud-kyc.md): no havale notice while the
    // order waits for a reviewer or was rejected — same rule as card/balance.
    const reviewBlock = await getPaymentBlock([invoice.id], tx);
    if (reviewBlock) throw new BankTransferError(reviewBlock);

    const pending = await tx.bankTransferNotice.count({
      where: { invoiceId: invoice.id, status: "PENDING" },
    });
    if (pending > 0) {
      throw new BankTransferError("Bu fatura için onay bekleyen bir ödeme bildiriminiz var.");
    }

    let bankAccountId: string | null = null;
    if (input.bankAccountId) {
      const account = await tx.bankAccount.findFirst({
        where: { id: input.bankAccountId, isActive: true },
        select: { id: true },
      });
      bankAccountId = account?.id ?? null;
    }

    const notice = await tx.bankTransferNotice.create({
      data: {
        invoiceId: invoice.id,
        customerId: input.customerId,
        bankAccountId,
        amount: parsed.amount,
        transferDate: parsed.transferDate,
        senderName: parsed.senderName,
        note: parsed.note,
      },
    });

    // The pending BANK_TRANSFER row is what admin approval settles.
    const unbound = await tx.payment.findFirst({
      where: { invoiceId: invoice.id, method: "BANK_TRANSFER", status: "PENDING", transactionId: null },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    const notes = `Havale bildirimi: ${parsed.senderName}, ${toFixed2(parsed.amount)} TL`;
    if (unbound) {
      await tx.payment.update({ where: { id: unbound.id }, data: { amount: parsed.amount, notes } });
    } else {
      await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          customerId: input.customerId,
          amount: parsed.amount,
          method: "BANK_TRANSFER",
          status: "PENDING",
          notes,
        },
      });
    }

    // Staff alert (admin-alert subscriber) once the notice committed.
    await emitEvent(
      tx,
      "bank_transfer.submitted",
      {
        noticeId: notice.id,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerId: input.customerId,
        amount: toFixed2(parsed.amount),
        senderName: parsed.senderName,
      },
      { actorId: input.customerId }
    );

    return { id: notice.id, invoiceNumber: invoice.invoiceNumber };
  });
}

type NoticeForReview = Prisma.BankTransferNoticeGetPayload<{
  include: { invoice: { select: { id: true; invoiceNumber: true; status: true; customerId: true } } };
}>;

/** Flips PENDING → target exactly once; a repeated click finds nothing to flip. */
async function claimNotice(
  tx: Prisma.TransactionClient,
  noticeId: string,
  data: Prisma.BankTransferNoticeUpdateManyMutationInput
): Promise<NoticeForReview> {
  const claimed = await tx.bankTransferNotice.updateMany({
    where: { id: noticeId, status: "PENDING" },
    data,
  });
  if (claimed.count === 0) {
    throw new BankTransferError("Bu bildirim zaten sonuçlandırılmış.");
  }
  return tx.bankTransferNotice.findUniqueOrThrow({
    where: { id: noticeId },
    include: { invoice: { select: { id: true, invoiceNumber: true, status: true, customerId: true } } },
  });
}

/**
 * Approves a notice and marks the invoice PAID through the shared idempotent
 * fulfilment path (provisioning, renewal, e-fatura, events run there).
 */
export async function approveBankTransferNotice(noticeId: string, adminId: string) {
  const now = new Date();
  const notice = await db.$transaction(async (tx) => {
    const claimed = await claimNotice(tx, noticeId, {
      status: "APPROVED",
      reviewedBy: adminId,
      reviewedAt: now,
    });

    if (!OPEN_STATUSES.has(claimed.invoice.status)) {
      // Rolls the claim back: a paid/cancelled invoice must not take a second payment.
      throw new BankTransferError(
        claimed.invoice.status === "CANCELLED"
          ? "Fatura iptal edilmiş; bildirimi reddedin."
          : "Fatura zaten ödenmiş; bildirimi reddedin veya iade edin."
      );
    }

    // A notice sent before the order was blocked must not pay it either.
    if (await getPaymentBlock([claimed.invoiceId], tx)) {
      throw new BankTransferError(
        "Sipariş güvenlik incelemesinde; önce Siparişler → İnceleme'den onaylayın, sonra bildirimi onaylayın."
      );
    }

    const reference = noticePaymentReference(claimed.id);
    const notes = `Havale/EFT onaylandı: ${claimed.senderName}, ${toFixed2(claimed.amount)} TL`;
    const unbound = await tx.payment.findFirst({
      where: { invoiceId: claimed.invoiceId, method: "BANK_TRANSFER", status: "PENDING", transactionId: null },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (unbound) {
      await tx.payment.update({
        where: { id: unbound.id },
        data: { transactionId: reference, amount: claimed.amount },
      });
    } else {
      await tx.payment.create({
        data: {
          invoiceId: claimed.invoiceId,
          customerId: claimed.customerId,
          amount: claimed.amount,
          method: "BANK_TRANSFER",
          status: "PENDING",
          transactionId: reference,
        },
      });
    }

    const fulfilment = await fulfillInvoicePayment(tx, {
      invoiceId: claimed.invoiceId,
      performedBy: adminId,
      paymentReference: reference,
      notes,
    });

    // Commits with the approval ("havale onaylandı"); "ödeme alındı"
    // follows from the invoice.paid event written by fulfillInvoicePayment.
    await emitEvent(
      tx,
      "bank_transfer.approved",
      {
        noticeId: claimed.id,
        invoiceId: claimed.invoiceId,
        invoiceNumber: claimed.invoice.invoiceNumber,
        customerId: claimed.customerId,
        amount: toFixed2(claimed.amount),
      },
      { actorId: adminId }
    );

    return { ...claimed, fulfilment };
  });

  // Inline unsuspend fast path, and the follow-ups if the queue was down.
  await finalizeFulfilledInvoices([notice.fulfilment]);
  return { invoiceId: notice.invoiceId, invoiceNumber: notice.invoice.invoiceNumber };
}

export async function rejectBankTransferNotice(noticeId: string, adminId: string, reason: string) {
  const trimmed = reason.trim();
  if (trimmed.length < 3) throw new BankTransferError("Ret nedenini yazın.");

  const notice = await db.$transaction(async (tx) => {
    const claimed = await claimNotice(tx, noticeId, {
      status: "REJECTED",
      rejectionReason: trimmed.slice(0, 500),
      reviewedBy: adminId,
      reviewedAt: new Date(),
    });

    await tx.payment.updateMany({
      where: { invoiceId: claimed.invoiceId, method: "BANK_TRANSFER", status: "PENDING", transactionId: null },
      data: { status: "FAILED", notes: `Havale bildirimi reddedildi: ${trimmed.slice(0, 200)}` },
    });

    await emitEvent(
      tx,
      "bank_transfer.rejected",
      {
        noticeId: claimed.id,
        invoiceId: claimed.invoiceId,
        invoiceNumber: claimed.invoice.invoiceNumber,
        customerId: claimed.customerId,
        amount: toFixed2(claimed.amount),
        reason: trimmed,
      },
      { actorId: adminId }
    );

    return claimed;
  });

  return { invoiceId: notice.invoiceId, invoiceNumber: notice.invoice.invoiceNumber };
}
