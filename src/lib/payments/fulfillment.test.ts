import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  applyAffiliateCommission: vi.fn(),
  dispatchEvents: vi.fn(),
  queueEInvoiceDraft: vi.fn(),
  applyServiceRenewalFromOrder: vi.fn(),
  applyPlanChangeFromOrder: vi.fn(),
  provisionCompletedOrder: vi.fn(),
  unsuspendServiceIfNeeded: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/affiliate", () => ({ applyAffiliateCommission: mocks.applyAffiliateCommission }));
vi.mock("@/lib/events/dispatcher", () => ({ dispatchEvents: mocks.dispatchEvents }));
vi.mock("@/lib/notifications/email", () => ({
  loadCustomerRecipient: vi.fn(),
  sendPaymentReceivedEmail: vi.fn(),
}));
vi.mock("@/lib/notifications/sms", () => ({ sendSmsNotification: vi.fn() }));
vi.mock("@/lib/integrations/efatura", () => ({ queueEInvoiceDraft: mocks.queueEInvoiceDraft }));
vi.mock("@/lib/payments/renewal-fulfillment", () => ({
  applyServiceRenewalFromOrder: mocks.applyServiceRenewalFromOrder,
}));
vi.mock("@/lib/services/plan-change", () => ({
  applyPlanChangeFromOrder: mocks.applyPlanChangeFromOrder,
}));
vi.mock("@/lib/provisioning/internal", () => ({
  provisionCompletedOrder: mocks.provisionCompletedOrder,
}));
vi.mock("@/lib/payments/service-lifecycle", () => ({
  unsuspendServiceIfNeeded: mocks.unsuspendServiceIfNeeded,
  runUnsuspendJobsForInvoices: vi.fn(),
}));

import type { Prisma } from "@prisma/client";
import { fulfillInvoicePayment } from "./fulfillment";
import {
  fulfillPaymentsByGatewayReference,
  verifyGatewayAmount,
} from "./gateway-fulfillment";

type FakePayment = {
  id: string;
  invoiceId: string;
  amount: number;
  status: "PENDING" | "COMPLETED" | "FAILED";
  transactionId: string | null;
  notes: string | null;
  createdAt: Date;
};

type FakeInvoice = {
  id: string;
  invoiceNumber: string;
  customerId: string;
  totalAmount: number;
  paidAmount: number;
  paidAt: Date | null;
  status: "PENDING" | "PAID" | "OVERDUE" | "CANCELLED" | "REFUNDED" | "PARTIALLY_REFUNDED";
  orderId: string | null;
};

/**
 * Minimal in-memory stand-in for a Prisma transaction client. `updateMany`
 * evaluates its WHERE at write time, which is what Postgres does after a
 * blocked UPDATE re-checks the committed row.
 */
function createStore(invoices: FakeInvoice[], payments: FakePayment[]) {
  const state = {
    invoices: new Map(invoices.map((invoice) => [invoice.id, { ...invoice }])),
    payments: payments.map((payment) => ({ ...payment })),
    order: {
      id: "ord-1",
      orderNumber: "S-2026-000001",
      totalAmount: 120,
      status: "PENDING",
      approvedAt: null,
      serviceId: null as string | null,
      items: [{ configuration: {} }],
    },
  };

  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

  const matchesPayment = (payment: FakePayment, where: Record<string, unknown>) => {
    if (where.id && typeof where.id === "object" && "in" in (where.id as object)) {
      if (!(where.id as { in: string[] }).in.includes(payment.id)) return false;
    } else if (where.id && payment.id !== where.id) return false;
    if (where.invoiceId && payment.invoiceId !== where.invoiceId) return false;
    if ("transactionId" in where && payment.transactionId !== where.transactionId) return false;
    if (typeof where.status === "string" && payment.status !== where.status) return false;
    if (where.status && typeof where.status === "object") {
      if (!(where.status as { in: string[] }).in.includes(payment.status)) return false;
    }
    return true;
  };

  const tx = {
    invoice: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        await tick();
        const invoice = state.invoices.get(where.id);
        if (!invoice) return null;
        return {
          ...invoice,
          order: invoice.orderId ? { ...state.order, items: state.order.items } : null,
        };
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; status: { notIn: string[] } };
        data: Partial<FakeInvoice>;
      }) => {
        await tick();
        const invoice = state.invoices.get(where.id);
        if (!invoice || where.status.notIn.includes(invoice.status)) return { count: 0 };
        Object.assign(invoice, data);
        return { count: 1 };
      },
    },
    payment: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        await tick();
        return state.payments
          .filter((payment) => matchesPayment(payment, where))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((payment) => ({ ...payment }));
      },
      count: async ({ where }: { where: Record<string, unknown> }) =>
        state.payments.filter((payment) => matchesPayment(payment, where)).length,
      update: async ({ where, data }: { where: { id: string }; data: Partial<FakePayment> }) => {
        const payment = state.payments.find((item) => item.id === where.id)!;
        Object.assign(payment, data);
        return payment;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Partial<FakePayment>;
      }) => {
        const matched = state.payments.filter((payment) => matchesPayment(payment, where));
        matched.forEach((payment) => Object.assign(payment, data));
        return { count: matched.length };
      },
    },
    order: {
      update: async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(state.order, data);
        return state.order;
      },
    },
    orderActivity: { create: vi.fn() },
  };

  return { state, tx: tx as unknown as Prisma.TransactionClient };
}

function invoice(overrides: Partial<FakeInvoice> = {}): FakeInvoice {
  return {
    id: "inv-1",
    invoiceNumber: "F-2026-000001",
    customerId: "cus-1",
    totalAmount: 120,
    paidAmount: 0,
    paidAt: null,
    status: "PENDING",
    orderId: "ord-1",
    ...overrides,
  };
}

function payment(overrides: Partial<FakePayment> = {}): FakePayment {
  return {
    id: "pay-1",
    invoiceId: "inv-1",
    amount: 120,
    status: "PENDING",
    transactionId: "sess-1",
    notes: 'PayTR gateway_meta:{"invoiceIds":["inv-1"],"customerId":"cus-1","context":"panel_invoice","provider":"paytr"}',
    createdAt: new Date("2026-10-01T10:00:00Z"),
    ...overrides,
  };
}

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.queueEInvoiceDraft.mockResolvedValue(undefined);
  mocks.applyServiceRenewalFromOrder.mockResolvedValue({ applied: false });
  mocks.applyPlanChangeFromOrder.mockResolvedValue({ applied: false });
  mocks.provisionCompletedOrder.mockResolvedValue({ type: "service", identifier: "svc-1" });
});

describe("fulfillInvoicePayment idempotency", () => {
  it("provisions, pays commission and emits events exactly once for concurrent callbacks", async () => {
    const { state, tx } = createStore([invoice()], [payment()]);

    const results = await Promise.all([
      fulfillInvoicePayment(tx, { invoiceId: "inv-1", performedBy: "cus-1", paymentReference: "sess-1" }),
      fulfillInvoicePayment(tx, { invoiceId: "inv-1", performedBy: "cus-1", paymentReference: "sess-1" }),
      fulfillInvoicePayment(tx, { invoiceId: "inv-1", performedBy: "cus-1", paymentReference: "sess-1" }),
    ]);

    expect(results.filter((result) => result.fulfilled)).toHaveLength(1);
    expect(mocks.provisionCompletedOrder).toHaveBeenCalledTimes(1);
    expect(mocks.applyAffiliateCommission).toHaveBeenCalledTimes(1);
    expect(mocks.dispatchEvents).toHaveBeenCalledTimes(1);
    expect(mocks.queueEInvoiceDraft).toHaveBeenCalledTimes(1);
    expect(state.invoices.get("inv-1")?.status).toBe("PAID");
    expect(state.payments[0]).toMatchObject({ status: "COMPLETED", transactionId: "sess-1" });
  });

  it("applies a renewal only once when the same payment is reported twice", async () => {
    mocks.applyServiceRenewalFromOrder.mockResolvedValue({
      applied: true,
      serviceId: "svc-1",
      newExpiryDate: new Date("2027-10-01T00:00:00Z"),
    });
    const { tx } = createStore([invoice()], [payment()]);

    await fulfillInvoicePayment(tx, { invoiceId: "inv-1", performedBy: "cus-1", paymentReference: "sess-1" });
    const second = await fulfillInvoicePayment(tx, {
      invoiceId: "inv-1",
      performedBy: "cus-1",
      paymentReference: "sess-1",
    });

    expect(second.fulfilled).toBe(false);
    expect(mocks.applyServiceRenewalFromOrder).toHaveBeenCalledTimes(1);
    expect(mocks.applyAffiliateCommission).toHaveBeenCalledTimes(1);
  });

  it("completes only the paying session and closes the other pending sessions", async () => {
    const { state, tx } = createStore(
      [invoice()],
      [
        payment({ id: "pay-old", transactionId: "sess-old", createdAt: new Date("2026-10-01T09:00:00Z") }),
        payment({ id: "pay-new", transactionId: "sess-new", createdAt: new Date("2026-10-01T10:00:00Z") }),
      ]
    );

    await fulfillInvoicePayment(tx, { invoiceId: "inv-1", performedBy: "cus-1", paymentReference: "sess-old" });

    const byId = Object.fromEntries(state.payments.map((item) => [item.id, item]));
    expect(byId["pay-old"]).toMatchObject({ status: "COMPLETED", transactionId: "sess-old" });
    expect(byId["pay-new"]).toMatchObject({ status: "FAILED", transactionId: "sess-new" });
  });

  it("does not re-open or re-provision a refunded invoice on a late callback", async () => {
    for (const status of ["REFUNDED", "PARTIALLY_REFUNDED"] as const) {
      const { state, tx } = createStore([invoice({ status })], [payment()]);

      const result = await fulfillInvoicePayment(tx, {
        invoiceId: "inv-1",
        performedBy: "cus-1",
        paymentReference: "sess-1",
      });

      expect(result.fulfilled).toBe(false);
      expect(state.invoices.get("inv-1")?.status).toBe(status);
    }
    expect(mocks.provisionCompletedOrder).not.toHaveBeenCalled();
  });

  it("records a second, really charged session on a paid invoice as a duplicate instead of re-fulfilling", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { state, tx } = createStore(
      [invoice({ status: "PAID" })],
      [payment({ id: "pay-2", transactionId: "sess-2", status: "FAILED" })]
    );

    const result = await fulfillInvoicePayment(tx, {
      invoiceId: "inv-1",
      performedBy: "cus-1",
      paymentReference: "sess-2",
    });

    expect(result.fulfilled).toBe(false);
    expect(mocks.provisionCompletedOrder).not.toHaveBeenCalled();
    expect(state.payments[0].status).toBe("COMPLETED");
    expect(state.payments[0].notes).toMatch(/MÜKERRER/);
    expect(error).toHaveBeenCalled();
  });

  it("refuses to pay a cancelled invoice", async () => {
    const { tx } = createStore([invoice({ status: "CANCELLED" })], [payment()]);

    await expect(
      fulfillInvoicePayment(tx, { invoiceId: "inv-1", performedBy: "cus-1" })
    ).rejects.toThrow("INVOICE_CANCELLED");
  });
});

describe("fulfillPaymentsByGatewayReference", () => {
  it("matches the callback of an earlier checkout session of the same invoice", async () => {
    const { state, tx } = createStore(
      [invoice()],
      [
        payment({ id: "pay-a", transactionId: "sess-a", createdAt: new Date("2026-10-01T09:00:00Z") }),
        payment({ id: "pay-b", transactionId: "sess-b", createdAt: new Date("2026-10-01T10:00:00Z") }),
      ]
    );

    const result = await fulfillPaymentsByGatewayReference(tx, "sess-a", "PayTR", {
      paidAmount: 120,
      requestedAmount: 120,
      currency: "TL",
    });

    expect(result).toMatchObject({ fulfilled: true, invoiceIds: ["inv-1"] });
    expect(state.invoices.get("inv-1")?.status).toBe("PAID");
    expect(state.payments.find((item) => item.id === "pay-a")?.status).toBe("COMPLETED");
  });

  it("treats duplicate concurrent callbacks of one session as a single payment", async () => {
    const { tx } = createStore([invoice()], [payment()]);

    const results = await Promise.all([
      fulfillPaymentsByGatewayReference(tx, "sess-1", "PayTR", { paidAmount: 120 }),
      fulfillPaymentsByGatewayReference(tx, "sess-1", "PayTR", { paidAmount: 120 }),
    ]);

    expect(results.filter((result) => result.fulfilled)).toHaveLength(1);
    expect(mocks.provisionCompletedOrder).toHaveBeenCalledTimes(1);
    expect(mocks.applyAffiliateCommission).toHaveBeenCalledTimes(1);
  });

  it("skips a callback whose session is already completed", async () => {
    const { tx } = createStore([invoice({ status: "PAID" })], [payment({ status: "COMPLETED" })]);

    await expect(fulfillPaymentsByGatewayReference(tx, "sess-1", "PayTR")).resolves.toMatchObject({
      fulfilled: false,
      skipped: true,
    });
  });

  it("does not mark the invoice paid when the gateway amount is short", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { state, tx } = createStore([invoice()], [payment()]);

    const result = await fulfillPaymentsByGatewayReference(tx, "sess-1", "PayTR", {
      paidAmount: 1.2,
      requestedAmount: 1.2,
    });

    expect(result).toMatchObject({ fulfilled: false, amountMismatch: true });
    expect(state.invoices.get("inv-1")?.status).toBe("PENDING");
    expect(state.payments[0].status).toBe("PENDING");
    expect(state.payments[0].notes).toMatch(/^Tutar uyuşmazlığı/);
    expect(state.payments[0].notes).toMatch(/gateway_meta:/);
    expect(mocks.provisionCompletedOrder).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
  });
});

describe("verifyGatewayAmount", () => {
  it("accepts exact amounts regardless of float noise", () => {
    expect(verifyGatewayAmount(0.1 + 0.2, { paidAmount: 0.3, requestedAmount: 0.3 })).toEqual({ ok: true });
  });

  it("accepts a charged amount above the request (customer-paid installment fee)", () => {
    expect(verifyGatewayAmount(120, { paidAmount: 126.5, requestedAmount: 120 })).toEqual({ ok: true });
  });

  it("rejects a short charge, a different requested amount and foreign currency", () => {
    expect(verifyGatewayAmount(120, { paidAmount: 119.99 }).ok).toBe(false);
    expect(verifyGatewayAmount(120, { paidAmount: 130, requestedAmount: 130 }).ok).toBe(false);
    expect(verifyGatewayAmount(120, { paidAmount: 120, currency: "USD" }).ok).toBe(false);
    expect(verifyGatewayAmount(120, { paidAmount: Number.NaN }).ok).toBe(false);
  });

  it("accepts TL and TRY currency codes", () => {
    expect(verifyGatewayAmount(120, { paidAmount: 120, currency: "TL" }).ok).toBe(true);
    expect(verifyGatewayAmount(120, { paidAmount: 120, currency: "try" }).ok).toBe(true);
  });
});
