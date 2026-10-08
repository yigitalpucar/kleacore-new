import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = vi.hoisted(() => ({
  payment: {
    findFirst: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
  invoice: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
  },
}));

import { persistGatewayCheckout } from "./persist";

const baseInput = {
  invoiceIds: ["inv-1"],
  provider: "paytr" as const,
  customerId: "cus-1",
  context: "panel_invoice" as const,
  notesPrefix: "PayTR iframe ödemesi",
};

describe("persistGatewayCheckout", () => {
  beforeEach(() => {
    Object.values(tx.payment).forEach((mock) => mock.mockReset());
    tx.invoice.findUnique.mockReset();
  });

  it("claims the unbound pending card payment for the first session", async () => {
    tx.payment.findFirst.mockResolvedValue({ id: "pay-1" });

    await persistGatewayCheckout({ ...baseInput, gatewaySessionId: "sess-1" });

    expect(tx.payment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          invoiceId: "inv-1",
          status: "PENDING",
          method: "CREDIT_CARD",
          transactionId: null,
        },
      })
    );
    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: "pay-1" },
      data: expect.objectContaining({ transactionId: "sess-1" }),
    });
    expect(tx.payment.upsert).not.toHaveBeenCalled();
  });

  it("adds a new payment for a second session instead of overwriting the first", async () => {
    tx.payment.findFirst.mockResolvedValue(null);
    tx.invoice.findUnique.mockResolvedValue({ customerId: "cus-1", totalAmount: 120, paidAmount: 20 });

    await persistGatewayCheckout({ ...baseInput, gatewaySessionId: "sess-2" });

    expect(tx.payment.update).not.toHaveBeenCalled();
    expect(tx.payment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { invoiceId_transactionId: { invoiceId: "inv-1", transactionId: "sess-2" } },
        create: expect.objectContaining({
          invoiceId: "inv-1",
          amount: 100,
          method: "CREDIT_CARD",
          status: "PENDING",
          transactionId: "sess-2",
        }),
      })
    );
  });

  it("binds one payment per invoice for multi-invoice checkouts", async () => {
    tx.payment.findFirst.mockResolvedValueOnce({ id: "pay-a" }).mockResolvedValueOnce({ id: "pay-b" });

    await persistGatewayCheckout({
      ...baseInput,
      invoiceIds: ["inv-a", "inv-b"],
      gatewaySessionId: "sess-cart",
    });

    expect(tx.payment.update).toHaveBeenCalledTimes(2);
    expect(tx.payment.update.mock.calls.map(([call]) => call.where.id)).toEqual(["pay-a", "pay-b"]);
  });
});
