/**
 * Admin refunds of paid invoices (full or partial).
 *
 * 1. reserve  — under a row lock on the invoice, check the bounds and insert a
 *               PENDING Refund (unique idempotency key: a double click inserts
 *               nothing and returns the first refund).
 * 2. execute  — gateway call (Kuveyt Türk / PayTR / iyzico / Stripe) outside
 *               any transaction; BALANCE and MANUAL need no remote call.
 * 3. finalize — COMPLETED: invoice refundedAmount/status, payment/order state,
 *               balance credit, service cancel. FAILED: nothing else changes.
 *               Unknown gateway outcome (timeout): stays PENDING, still counts
 *               against the refundable amount, and is resolved by an admin.
 * 4. after    — e-Arşiv cancel within the legal window, otherwise "iade
 *               faturası gerekli" flag; customer notification; activity log.
 */
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity-log";
import { createLogger } from "@/lib/logger";
import { cancelEInvoiceRecord } from "@/lib/integrations/efatura";
import { getPaymentGatewayConfig } from "@/lib/integrations/payment-gateways/config";
import type { GatewayRefundResult } from "@/lib/integrations/payment-gateways/types";
import { terminateRemoteService } from "@/lib/integrations/provisioning";
import { sendNotification } from "@/lib/notifications/send";
import { add, sum, toFixed2, toNumber } from "@/lib/money";
import { detectCardGateway, executeGatewayRefund } from "./refunds-gateways";
import {
  COUNTED_REFUND_STATUSES,
  decideEInvoiceAction,
  invoiceStatusAfterRefunds,
  isRefundableInvoiceStatus,
  refundableAmount,
  validateRefundAmount,
} from "./refunds-math";

const log = createLogger("payments.refunds");

export type RefundMethodInput = "GATEWAY" | "BALANCE" | "MANUAL";
export type RefundServiceAction = "CANCEL" | "KEEP";

export class RefundError extends Error {}

export interface CreateRefundInput {
  invoiceId: string;
  amount: Prisma.Decimal | number | string;
  reason: string;
  method: RefundMethodInput;
  serviceAction: RefundServiceAction;
  idempotencyKey: string;
  createdBy: string;
  /** MANUAL: bank transfer reference / dekont no of the money sent back. */
  manualReference?: string | null;
}

export interface RefundOutcome {
  refundId: string;
  status: "PENDING" | "COMPLETED" | "FAILED";
  duplicate: boolean;
  message: string;
  eInvoiceAction: string | null;
}

const invoiceForRefund = {
  payments: {
    where: { status: { in: ["COMPLETED", "REFUNDED"] } },
    orderBy: { paidAt: "desc" },
  },
  refunds: true,
  order: { select: { id: true, serviceId: true } },
} satisfies Prisma.InvoiceInclude;

type InvoiceForRefund = Prisma.InvoiceGetPayload<{ include: typeof invoiceForRefund }>;

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function existingOutcome(idempotencyKey: string): Promise<RefundOutcome | null> {
  const existing = await db.refund.findUnique({ where: { idempotencyKey } });
  if (!existing) return null;
  return {
    refundId: existing.id,
    status: existing.status,
    duplicate: true,
    message: "Bu iade isteği zaten işlendi.",
    eInvoiceAction: existing.eInvoiceAction,
  };
}

/** The card payment a GATEWAY refund goes back to: the newest completed card payment with a reference. */
function pickCardPayment(invoice: InvoiceForRefund) {
  return invoice.payments.find(
    (payment) => payment.method === "CREDIT_CARD" && payment.status === "COMPLETED" && payment.transactionId
  );
}

async function reserveRefund(input: CreateRefundInput) {
  return db.$transaction(async (tx) => {
    // Serialises refunds of one invoice: the bound check below sees every
    // refund committed before us.
    await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${input.invoiceId} FOR UPDATE`;

    const invoice = await tx.invoice.findUnique({ where: { id: input.invoiceId }, include: invoiceForRefund });
    if (!invoice) throw new RefundError("Fatura bulunamadı.");
    if (!isRefundableInvoiceStatus(invoice.status)) {
      throw new RefundError("Yalnızca ödenmiş faturalar iade edilebilir.");
    }

    const check = validateRefundAmount(input.amount, refundableAmount(invoice.paidAmount, invoice.refunds));
    if (!check.ok) throw new RefundError(check.error);

    let paymentId: string | null = null;
    let gateway: string | null = null;
    if (input.method === "GATEWAY") {
      const payment = pickCardPayment(invoice);
      const detected = payment ? detectCardGateway(payment) : null;
      if (!payment || !detected) {
        throw new RefundError("Bu fatura kartla ödenmemiş; bakiyeye veya manuel iade seçin.");
      }
      paymentId = payment.id;
      gateway = detected;
    } else {
      paymentId = invoice.payments.find((payment) => payment.status === "COMPLETED")?.id ?? null;
    }

    const refund = await tx.refund.create({
      data: {
        invoiceId: invoice.id,
        paymentId,
        customerId: invoice.customerId,
        amount: check.amount,
        reason: input.reason.trim().slice(0, 500),
        method: input.method,
        gateway,
        gatewayRef: input.method === "MANUAL" ? input.manualReference?.trim().slice(0, 120) || null : null,
        serviceAction: input.serviceAction,
        idempotencyKey: input.idempotencyKey,
        createdBy: input.createdBy,
      },
    });

    return { refund, invoice };
  });
}

/** Sum of other refunds (in flight or done) against the same gateway session. */
async function sessionTotals(transactionId: string, excludeRefundId: string) {
  const sessionPayments = await db.payment.findMany({
    where: { transactionId, method: "CREDIT_CARD", status: { in: ["COMPLETED", "REFUNDED"] } },
    select: { id: true, amount: true },
  });
  const refunds = await db.refund.findMany({
    where: {
      paymentId: { in: sessionPayments.map((payment) => payment.id) },
      method: "GATEWAY",
      status: { in: [...COUNTED_REFUND_STATUSES] },
      id: { not: excludeRefundId },
    },
    select: { amount: true },
  });
  return {
    sessionAmount: sum(sessionPayments.map((payment) => payment.amount)),
    sessionRefunded: sum(refunds.map((refund) => refund.amount)),
  };
}

async function executeRefund(
  refund: { id: string; method: string; amount: Prisma.Decimal; idempotencyKey: string; paymentId: string | null; gateway: string | null },
  invoice: InvoiceForRefund
): Promise<GatewayRefundResult> {
  if (refund.method !== "GATEWAY") {
    return { ok: true, message: refund.method === "BALANCE" ? "Tutar müşteri bakiyesine aktarıldı." : "Manuel iade kaydedildi." };
  }

  const payment = invoice.payments.find((candidate) => candidate.id === refund.paymentId);
  if (!payment?.transactionId) {
    return { ok: false, message: "İade edilecek kart ödemesi bulunamadı." };
  }

  try {
    const config = await getPaymentGatewayConfig();
    const totals = await sessionTotals(payment.transactionId, refund.id);
    return await executeGatewayRefund(config, {
      gateway: refund.gateway as Parameters<typeof executeGatewayRefund>[1]["gateway"],
      refundId: refund.id,
      idempotencyKey: refund.idempotencyKey,
      amount: refund.amount,
      payment,
      sessionAmount: totals.sessionAmount,
      sessionRefunded: totals.sessionRefunded,
      now: new Date(),
    });
  } catch (error) {
    log.error("gateway refund threw", { refundId: refund.id, error });
    return {
      ok: false,
      uncertain: true,
      message: "Ağ geçidinden yanıt alınamadı; iade durumunu sağlayıcı panelinden kontrol edin.",
    };
  }
}

/**
 * Applies a successful refund. The conditional PENDING → COMPLETED flip makes
 * this safe to call twice: only the first call changes balances and totals.
 */
async function completeRefund(refundId: string, result: GatewayRefundResult, now = new Date()) {
  return db.$transaction(async (tx) => {
    const flipped = await tx.refund.updateMany({
      where: { id: refundId, status: "PENDING" },
      data: {
        status: "COMPLETED",
        completedAt: now,
        errorMessage: null,
        ...(result.operation ? { operation: result.operation } : {}),
        ...(result.gatewayRef ? { gatewayRef: result.gatewayRef } : {}),
        ...(result.data ? { gatewayData: result.data as Prisma.InputJsonValue } : {}),
      },
    });
    if (flipped.count === 0) return null;

    const refund = await tx.refund.findUniqueOrThrow({ where: { id: refundId } });
    await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${refund.invoiceId} FOR UPDATE`;
    const invoice = await tx.invoice.findUniqueOrThrow({
      where: { id: refund.invoiceId },
      include: { order: { select: { id: true, serviceId: true } } },
    });

    const refundedAmount = add(invoice.refundedAmount, refund.amount);
    const status = invoiceStatusAfterRefunds(invoice.paidAmount, refundedAmount);
    await tx.invoice.update({ where: { id: invoice.id }, data: { refundedAmount, status } });

    if (status === "REFUNDED") {
      await tx.payment.updateMany({
        where: { invoiceId: invoice.id, status: "COMPLETED" },
        data: { status: "REFUNDED" },
      });
    }

    if (invoice.order) {
      await tx.order.update({
        where: { id: invoice.order.id },
        data: {
          refundedAt: now,
          refundAmount: refundedAmount,
          ...(status === "REFUNDED" ? { status: "REFUNDED" } : {}),
        },
      });
    }

    if (refund.method === "BALANCE") {
      const customer = await tx.user.update({
        where: { id: refund.customerId },
        data: { balance: { increment: refund.amount } },
        select: { balance: true },
      });
      await tx.transaction.create({
        data: {
          customerId: refund.customerId,
          type: "REFUND",
          amount: refund.amount,
          balanceBefore: customer.balance.minus(refund.amount),
          balanceAfter: customer.balance,
          description: `${invoice.invoiceNumber} fatura iadesi: ${toFixed2(refund.amount)} TL`,
          referenceId: refund.id,
        },
      });
    }

    let cancelledServiceId: string | null = null;
    if (refund.serviceAction === "CANCEL" && invoice.order?.serviceId) {
      const cancelled = await tx.service.updateMany({
        where: { id: invoice.order.serviceId, status: { not: "CANCELLED" } },
        data: { status: "CANCELLED", cancelledAt: now },
      });
      if (cancelled.count > 0) cancelledServiceId = invoice.order.serviceId;
    }

    return { refund, invoice: { ...invoice, refundedAmount, status }, cancelledServiceId };
  });
}

async function failRefund(refundId: string, result: GatewayRefundResult) {
  await db.refund.updateMany({
    where: { id: refundId, status: "PENDING" },
    data: {
      status: "FAILED",
      errorMessage: result.message.slice(0, 1000),
      ...(result.operation ? { operation: result.operation } : {}),
      ...(result.data ? { gatewayData: result.data as Prisma.InputJsonValue } : {}),
    },
  });
}

/** Customer wording of the refund channel (billing.refund-issued template). */
const REFUND_NOTICE_METHOD: Record<string, string | undefined> = {
  GATEWAY: "CARD",
  BALANCE: "BALANCE",
  MANUAL: undefined,
};

/** e-Arşiv cancel / return-invoice flag, notification, activity log, remote service cancel. */
async function afterRefundCompleted(
  completed: NonNullable<Awaited<ReturnType<typeof completeRefund>>>
): Promise<string | null> {
  const { refund, invoice, cancelledServiceId } = completed;
  const now = new Date();

  const record = await db.eInvoiceRecord.findUnique({ where: { invoiceId: invoice.id } });
  const decision = decideEInvoiceAction({
    record,
    fullyRefunded: invoice.status === "REFUNDED",
    now,
  });

  let eInvoiceAction: string | null = null;
  if (decision === "EARSIV_CANCEL" && record) {
    try {
      await cancelEInvoiceRecord(record.id, `İade: ${refund.reason}`);
      eInvoiceAction = "EARSIV_CANCELLED";
    } catch (error) {
      log.error("e-Arşiv cancel after refund failed", { refundId: refund.id, error });
      eInvoiceAction = "RETURN_INVOICE_REQUIRED";
    }
  } else if (decision === "RETURN_INVOICE_REQUIRED") {
    eInvoiceAction = "RETURN_INVOICE_REQUIRED";
  }
  if (eInvoiceAction) {
    await db.refund.update({ where: { id: refund.id }, data: { eInvoiceAction } });
  }

  if (cancelledServiceId) {
    try {
      const service = await db.service.findUnique({
        where: { id: cancelledServiceId },
        include: {
          product: { include: { category: true } },
          customer: { select: { id: true, name: true, surname: true, email: true } },
        },
      });
      if (service) await terminateRemoteService(service);
    } catch (error) {
      log.error("remote service termination after refund failed", { refundId: refund.id, error });
    }
  }

  await logActivity({
    userId: refund.createdBy,
    action: "INVOICE_REFUNDED",
    entity: "Invoice",
    entityId: invoice.id,
    details: {
      invoiceNumber: invoice.invoiceNumber,
      refundId: refund.id,
      amount: toNumber(refund.amount),
      method: refund.method,
      gateway: refund.gateway,
      status: invoice.status,
      eInvoiceAction,
      serviceAction: refund.serviceAction,
    },
  });

  await sendNotification({
    userId: refund.customerId,
    template: "billing.refund-issued",
    data: {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amount: toFixed2(refund.amount),
      method: REFUND_NOTICE_METHOD[refund.method],
      refundedAt: refund.completedAt ?? now,
      reason: refund.reason,
    },
    dedupeKey: `refund.issued:${refund.id}`,
  });

  return eInvoiceAction;
}

export function parseRefundInput(input: CreateRefundInput) {
  if (!input.idempotencyKey || input.idempotencyKey.length > 100) {
    throw new RefundError("Geçersiz istek anahtarı.");
  }
  if (input.reason.trim().length < 3) throw new RefundError("İade nedenini yazın.");
  if (!["GATEWAY", "BALANCE", "MANUAL"].includes(input.method)) throw new RefundError("İade yöntemi geçersiz.");
  if (!["CANCEL", "KEEP"].includes(input.serviceAction)) throw new RefundError("Hizmet seçeneği geçersiz.");
}

export async function createRefund(input: CreateRefundInput): Promise<RefundOutcome> {
  parseRefundInput(input);

  const duplicate = await existingOutcome(input.idempotencyKey);
  if (duplicate) return duplicate;

  let reserved: Awaited<ReturnType<typeof reserveRefund>>;
  try {
    reserved = await reserveRefund(input);
  } catch (error) {
    if (isUniqueViolation(error)) {
      const raced = await existingOutcome(input.idempotencyKey);
      if (raced) return raced;
    }
    throw error;
  }

  const { refund, invoice } = reserved;
  const result = await executeRefund(refund, invoice);

  if (result.ok) {
    const completed = await completeRefund(refund.id, result);
    const eInvoiceAction = completed ? await afterRefundCompleted(completed) : null;
    return { refundId: refund.id, status: "COMPLETED", duplicate: false, message: result.message, eInvoiceAction };
  }

  if (result.uncertain) {
    await db.refund.update({
      where: { id: refund.id },
      data: {
        errorMessage: result.message.slice(0, 1000),
        ...(result.operation ? { operation: result.operation } : {}),
      },
    });
    return { refundId: refund.id, status: "PENDING", duplicate: false, message: result.message, eInvoiceAction: null };
  }

  await failRefund(refund.id, result);
  return { refundId: refund.id, status: "FAILED", duplicate: false, message: result.message, eInvoiceAction: null };
}

/**
 * Settles a refund left PENDING by an unknown gateway outcome, after the admin
 * checked the gateway panel.
 */
export async function resolvePendingRefund(
  refundId: string,
  outcome: "COMPLETED" | "FAILED",
  adminId: string,
  note?: string
): Promise<RefundOutcome> {
  const refund = await db.refund.findUnique({ where: { id: refundId } });
  if (!refund) throw new RefundError("İade kaydı bulunamadı.");
  if (refund.status !== "PENDING") throw new RefundError("Bu iade zaten sonuçlanmış.");

  const message = `${outcome === "COMPLETED" ? "Tamamlandı" : "Başarısız"} olarak işaretlendi (${adminId})${note?.trim() ? `: ${note.trim()}` : ""}`;

  if (outcome === "FAILED") {
    await failRefund(refundId, { ok: false, message });
    return { refundId, status: "FAILED", duplicate: false, message, eInvoiceAction: null };
  }

  const completed = await completeRefund(refundId, { ok: true, message });
  const eInvoiceAction = completed ? await afterRefundCompleted(completed) : null;
  return { refundId, status: "COMPLETED", duplicate: false, message, eInvoiceAction };
}

/** Refund history of an invoice plus what may still be refunded. */
export async function getInvoiceRefundSummary(invoiceId: string) {
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      status: true,
      paidAmount: true,
      refunds: { orderBy: { createdAt: "desc" } },
      payments: {
        where: { status: { in: ["COMPLETED", "REFUNDED"] } },
        select: { id: true, method: true, status: true, transactionId: true, notes: true, gatewayData: true },
      },
    },
  });
  if (!invoice) return null;

  const cardPayment = invoice.payments.find(
    (payment) => payment.method === "CREDIT_CARD" && payment.status === "COMPLETED" && payment.transactionId
  );
  const refundable = refundableAmount(invoice.paidAmount, invoice.refunds);

  return {
    refundable: isRefundableInvoiceStatus(invoice.status) ? toNumber(refundable) : 0,
    cardGateway: cardPayment ? detectCardGateway(cardPayment) : null,
    refunds: invoice.refunds.map((refund) => ({
      id: refund.id,
      amount: toNumber(refund.amount),
      reason: refund.reason,
      method: refund.method,
      gateway: refund.gateway,
      operation: refund.operation,
      gatewayRef: refund.gatewayRef,
      status: refund.status,
      errorMessage: refund.errorMessage,
      serviceAction: refund.serviceAction,
      eInvoiceAction: refund.eInvoiceAction,
      createdBy: refund.createdBy,
      createdAt: refund.createdAt.toISOString(),
      completedAt: refund.completedAt?.toISOString() ?? null,
    })),
    returnInvoiceRequired: invoice.refunds.some(
      (refund) => refund.status === "COMPLETED" && refund.eInvoiceAction === "RETURN_INVOICE_REQUIRED"
    ),
  };
}

export type InvoiceRefundSummary = NonNullable<Awaited<ReturnType<typeof getInvoiceRefundSummary>>>;

