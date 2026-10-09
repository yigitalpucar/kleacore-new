import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    fraudCheck: { updateMany: vi.fn() },
    orderActivity: { create: vi.fn() },
    order: { update: vi.fn(), updateMany: vi.fn() },
    invoice: { update: vi.fn() },
    payment: { updateMany: vi.fn() },
  };
  return {
    tx,
    db: {
      order: { findUnique: vi.fn() },
      $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
    },
    emitEvent: vi.fn(),
    createRefund: vi.fn(),
    releaseHeldOrder: vi.fn(),
    clearProvisioningHold: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/events/emit", () => ({ emitEvent: mocks.emitEvent }));
vi.mock("@/lib/payments/refunds", () => ({
  createRefund: mocks.createRefund,
  RefundError: class RefundError extends Error {},
}));
vi.mock("@/lib/provisioning/hold", () => ({
  releaseHeldOrder: mocks.releaseHeldOrder,
  clearProvisioningHold: mocks.clearProvisioningHold,
}));

import { approveFraudReview, FraudReviewError, rejectFraudReview } from "./review";

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: "ord-1",
    orderNumber: "S-1",
    customerId: "cus-1",
    status: "PROCESSING",
    provisioningHeldAt: new Date(),
    fraudCheck: { id: "fc-1", status: "REVIEW" },
    invoice: {
      id: "inv-1",
      invoiceNumber: "F-1",
      status: "PAID",
      paidAmount: "120.00",
      refundedAmount: "0",
      payments: [{ method: "CREDIT_CARD" }],
    },
    ...overrides,
  };
}

const eventTypes = () => mocks.emitEvent.mock.calls.map((call) => call[1]);

beforeEach(() => {
  mocks.tx.fraudCheck.updateMany.mockResolvedValue({ count: 1 });
  mocks.emitEvent.mockResolvedValue({ id: "evt" });
  mocks.releaseHeldOrder.mockResolvedValue({ released: true, provisioned: {} });
  mocks.createRefund.mockResolvedValue({ refundId: "ref-1", status: "COMPLETED", duplicate: false, message: "ok", eInvoiceAction: null });
});

describe("approveFraudReview", () => {
  it("claims the REVIEW check, unblocks payment and releases a paid, held order", async () => {
    mocks.db.order.findUnique.mockResolvedValue(order());
    const result = await approveFraudReview({ orderId: "ord-1", reviewerId: "adm-1", note: "telefonla teyit" });

    expect(mocks.tx.fraudCheck.updateMany).toHaveBeenCalledWith({
      where: { orderId: "ord-1", status: "REVIEW" },
      data: expect.objectContaining({ status: "APPROVED", paymentBlocked: false, reviewedBy: "adm-1", reviewNote: "telefonla teyit" }),
    });
    expect(eventTypes()).toEqual(["order.review_approved"]);
    expect(mocks.releaseHeldOrder).toHaveBeenCalledWith("ord-1", "adm-1");
    expect(result.paid).toBe(true);
  });

  it("does not release an unpaid order (nothing held yet)", async () => {
    mocks.db.order.findUnique.mockResolvedValue(order({ provisioningHeldAt: null, invoice: { ...order().invoice, status: "PENDING" } }));
    const result = await approveFraudReview({ orderId: "ord-1", reviewerId: "adm-1" });
    expect(result).toEqual({ paid: false, release: null });
    expect(mocks.releaseHeldOrder).not.toHaveBeenCalled();
  });

  it("acts once: a second decision finds no REVIEW row", async () => {
    mocks.db.order.findUnique.mockResolvedValue(order());
    mocks.tx.fraudCheck.updateMany.mockResolvedValue({ count: 0 });
    await expect(approveFraudReview({ orderId: "ord-1", reviewerId: "adm-2" })).rejects.toBeInstanceOf(FraudReviewError);
    expect(mocks.emitEvent).not.toHaveBeenCalled();
    expect(mocks.releaseHeldOrder).not.toHaveBeenCalled();
  });
});

describe("rejectFraudReview", () => {
  it("cancels an unpaid order and its invoice, without a refund", async () => {
    mocks.db.order.findUnique.mockResolvedValue(order({ provisioningHeldAt: null, invoice: { ...order().invoice, status: "PENDING", payments: [] } }));
    const result = await rejectFraudReview({ orderId: "ord-1", reviewerId: "adm-1", reason: "Sahte bilgiler" });

    expect(result).toEqual({ paid: false, refund: null });
    expect(mocks.tx.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "CANCELLED" }) }));
    expect(mocks.tx.invoice.update).toHaveBeenCalledWith({ where: { id: "inv-1" }, data: { status: "CANCELLED" } });
    expect(mocks.tx.payment.updateMany).toHaveBeenCalled();
    expect(mocks.createRefund).not.toHaveBeenCalled();
    expect(eventTypes()).toEqual(["order.cancelled", "invoice.cancelled", "order.review_rejected"]);
  });

  it("refunds a paid order through the refunds module (idempotent key) and clears the hold", async () => {
    mocks.db.order.findUnique.mockResolvedValue(order());
    const result = await rejectFraudReview({ orderId: "ord-1", reviewerId: "adm-1", reason: "Çalıntı kart şüphesi" });

    expect(mocks.clearProvisioningHold).toHaveBeenCalledWith(mocks.tx, "ord-1");
    expect(mocks.createRefund).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceId: "inv-1",
        method: "GATEWAY",
        serviceAction: "KEEP",
        idempotencyKey: "fraud-reject:ord-1",
        createdBy: "adm-1",
      })
    );
    expect(String(mocks.createRefund.mock.calls[0][0].amount)).toBe("120");
    expect(mocks.tx.invoice.update).not.toHaveBeenCalled();
    expect(result.refund?.status).toBe("COMPLETED");
    expect(mocks.emitEvent.mock.calls.at(-1)?.[2]).toMatchObject({ paid: true, refundStatus: "COMPLETED" });
  });

  it("reports a failed refund instead of throwing, the rejection still stands", async () => {
    mocks.db.order.findUnique.mockResolvedValue(order({ invoice: { ...order().invoice, payments: [{ method: "BALANCE" }] } }));
    mocks.createRefund.mockRejectedValue(new Error("gateway down"));
    const result = await rejectFraudReview({ orderId: "ord-1", reviewerId: "adm-1", reason: "Şüpheli" });
    expect(mocks.createRefund.mock.calls[0][0].method).toBe("BALANCE");
    expect(result.refund?.status).toBe("FAILED");
    expect(eventTypes()).toContain("order.review_rejected");
  });

  it("requires a reason and an open review", async () => {
    mocks.db.order.findUnique.mockResolvedValue(order({ fraudCheck: { id: "fc-1", status: "APPROVED" } }));
    await expect(rejectFraudReview({ orderId: "ord-1", reviewerId: "adm-1", reason: "x" })).rejects.toThrow("Ret nedenini");
    await expect(rejectFraudReview({ orderId: "ord-1", reviewerId: "adm-1", reason: "Geçerli neden" })).rejects.toBeInstanceOf(FraudReviewError);
  });
});
