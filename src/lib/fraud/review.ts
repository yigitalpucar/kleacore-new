import { db } from "@/lib/db";
import { emitEvent } from "@/lib/events/emit";
import { createLogger } from "@/lib/logger";
import { isPositive, sub } from "@/lib/money";
import { createRefund, RefundError, type RefundOutcome } from "@/lib/payments/refunds";
import { clearProvisioningHold, releaseHeldOrder, type ReleaseResult } from "@/lib/provisioning/hold";

const log = createLogger("fraud.review");

/**
 * Staff decisions on the review queue (/yonetim/siparisler/inceleme).
 *  - approve: FraudCheck APPROVED (payment unblocked). A paid order held for
 *    the review is released → provisioning.run job (same path as a normal
 *    payment); a KYC hold, if any, keeps it waiting.
 *  - reject: FraudCheck REJECTED. Paid → refund through the refunds module
 *    (card / balance / manual) and the order is cancelled; unpaid → order and
 *    invoice cancelled, open payment rows closed.
 * Both are claimed with a conditional update on status REVIEW, so a double
 * click or two reviewers act exactly once.
 */

export class FraudReviewError extends Error {}

export type RefundMethodChoice = "GATEWAY" | "BALANCE" | "MANUAL";

async function loadOrder(orderId: string) {
  return db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      customerId: true,
      status: true,
      provisioningHeldAt: true,
      fraudCheck: { select: { id: true, status: true } },
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          paidAmount: true,
          refundedAmount: true,
          payments: { where: { status: "COMPLETED" }, select: { method: true } },
        },
      },
    },
  });
}

export async function approveFraudReview(input: { orderId: string; reviewerId: string; note?: string }) {
  const order = await loadOrder(input.orderId);
  if (!order?.fraudCheck) throw new FraudReviewError("Bu sipariş için risk kaydı yok.");
  const paid = order.invoice?.status === "PAID";
  const note = input.note?.trim().slice(0, 1000) || undefined;

  await db.$transaction(async (tx) => {
    const claimed = await tx.fraudCheck.updateMany({
      where: { orderId: order.id, status: "REVIEW" },
      data: {
        status: "APPROVED",
        paymentBlocked: false,
        reviewedBy: input.reviewerId,
        reviewedAt: new Date(),
        reviewNote: note ?? null,
      },
    });
    if (claimed.count === 0) throw new FraudReviewError("Sipariş inceleme beklemiyor (başka biri karar vermiş olabilir).");

    await tx.orderActivity.create({
      data: {
        orderId: order.id,
        action: "FRAUD_APPROVED",
        description: `Risk incelemesi onaylandı${note ? `: ${note}` : ""}`,
        performedBy: input.reviewerId,
      },
    });
    await emitEvent(
      tx,
      "order.review_approved",
      { orderId: order.id, orderNumber: order.orderNumber, customerId: order.customerId, paid, note },
      { actorId: input.reviewerId }
    );
  });

  let release: ReleaseResult | null = null;
  if (order.provisioningHeldAt) {
    release = await releaseHeldOrder(order.id, input.reviewerId);
  }
  return { paid, release };
}

function defaultRefundMethod(payments: Array<{ method: string }>): RefundMethodChoice {
  return payments.some((payment) => payment.method === "CREDIT_CARD") ? "GATEWAY" : "BALANCE";
}

export async function rejectFraudReview(input: {
  orderId: string;
  reviewerId: string;
  reason: string;
  refundMethod?: RefundMethodChoice;
  manualReference?: string | null;
}): Promise<{ paid: boolean; refund: RefundOutcome | null }> {
  const reason = input.reason.trim().slice(0, 1000);
  if (reason.length < 3) throw new FraudReviewError("Ret nedenini yazın.");

  const order = await loadOrder(input.orderId);
  if (!order?.fraudCheck) throw new FraudReviewError("Bu sipariş için risk kaydı yok.");
  if (order.fraudCheck.status !== "REVIEW") {
    throw new FraudReviewError("Sipariş inceleme beklemiyor (başka biri karar vermiş olabilir).");
  }

  const invoice = order.invoice;
  const paid = invoice?.status === "PAID";
  const now = new Date();

  // 1) Decision + hold cleared, so nothing provisions from here on.
  await db.$transaction(async (tx) => {
    const claimed = await tx.fraudCheck.updateMany({
      where: { orderId: order.id, status: "REVIEW" },
      data: { status: "REJECTED", reviewedBy: input.reviewerId, reviewedAt: now, reviewNote: reason },
    });
    if (claimed.count === 0) throw new FraudReviewError("Sipariş inceleme beklemiyor (başka biri karar vermiş olabilir).");
    await clearProvisioningHold(tx, order.id);
    await tx.orderActivity.create({
      data: {
        orderId: order.id,
        action: "FRAUD_REJECTED",
        description: `Risk incelemesi reddedildi: ${reason}`,
        performedBy: input.reviewerId,
      },
    });

    if (!paid) {
      await tx.order.update({
        where: { id: order.id },
        data: { status: "CANCELLED", cancelledAt: now, cancellationReason: `İnceleme reddi: ${reason}` },
      });
      await emitEvent(
        tx,
        "order.cancelled",
        { orderId: order.id, orderNumber: order.orderNumber, customerId: order.customerId, reason },
        { actorId: input.reviewerId }
      );
      if (invoice && invoice.status !== "CANCELLED" && invoice.status !== "REFUNDED") {
        await tx.invoice.update({ where: { id: invoice.id }, data: { status: "CANCELLED" } });
        await tx.payment.updateMany({
          where: { invoiceId: invoice.id, status: "PENDING" },
          data: { status: "FAILED", notes: "Sipariş inceleme sonucu reddedildi" },
        });
        await emitEvent(
          tx,
          "invoice.cancelled",
          { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, customerId: order.customerId, reason },
          { actorId: input.reviewerId }
        );
      }
    }
  });

  // 2) Paid: money goes back through the refunds module (its own idempotency).
  let refund: RefundOutcome | null = null;
  if (paid && invoice) {
    const amount = sub(invoice.paidAmount, invoice.refundedAmount);
    if (isPositive(amount)) {
      try {
        refund = await createRefund({
          invoiceId: invoice.id,
          amount,
          reason: `Sipariş inceleme reddi: ${reason}`.slice(0, 500),
          method: input.refundMethod ?? defaultRefundMethod(invoice.payments),
          serviceAction: "KEEP",
          idempotencyKey: `fraud-reject:${order.id}`,
          createdBy: input.reviewerId,
          manualReference: input.manualReference ?? null,
        });
      } catch (error) {
        log.error("refund after fraud rejection failed", { orderId: order.id, error });
        refund = {
          refundId: "",
          status: "FAILED",
          duplicate: false,
          message: error instanceof RefundError ? error.message : "İade başlatılamadı; fatura sayfasından manuel iade yapın.",
          eInvoiceAction: null,
        };
      }
    }

    await db.$transaction(async (tx) => {
      // A completed full refund already moved the order to REFUNDED.
      await tx.order.updateMany({
        where: { id: order.id, status: { notIn: ["REFUNDED", "CANCELLED"] } },
        data: { status: "CANCELLED", cancelledAt: now, cancellationReason: `İnceleme reddi: ${reason}` },
      });
      await emitEvent(
        tx,
        "order.cancelled",
        { orderId: order.id, orderNumber: order.orderNumber, customerId: order.customerId, reason },
        { actorId: input.reviewerId }
      );
    });
  }

  await emitEvent(
    db,
    "order.review_rejected",
    {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      reason,
      paid,
      refundStatus: refund?.status ?? "NONE",
    },
    { actorId: input.reviewerId }
  );

  return { paid, refund };
}
