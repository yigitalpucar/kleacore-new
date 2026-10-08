import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({ fulfillInvoicePayment: vi.fn() }));

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/payments/fulfillment", () => ({
  fulfillInvoicePayment: mocks.fulfillInvoicePayment,
  notifyInvoicePaymentReceived: vi.fn(),
}));
vi.mock("@/lib/payments/service-lifecycle", () => ({ runUnsuspendJobsForInvoices: vi.fn() }));

import { BalancePaymentError, payInvoicesFromBalance } from "./balance-payment";

function createTx(balance: string, invoiceStatus = "PENDING") {
  const state = {
    balance: new Prisma.Decimal(balance),
    payments: [] as Array<Record<string, unknown>>,
    transactions: [] as Array<Record<string, unknown>>,
  };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    invoice: {
      findMany: async () => [
        {
          id: "inv-1",
          invoiceNumber: "F-1",
          customerId: "cus-1",
          status: invoiceStatus,
          totalAmount: new Prisma.Decimal("120.00"),
          paidAmount: new Prisma.Decimal("20.00"),
        },
      ],
    },
    user: {
      updateMany: async ({ where, data }: { where: { balance: { gte: Prisma.Decimal } }; data: { balance: { decrement: Prisma.Decimal } } }) => {
        if (state.balance.lessThan(where.balance.gte)) return { count: 0 };
        state.balance = state.balance.minus(data.balance.decrement);
        return { count: 1 };
      },
      findUniqueOrThrow: async () => ({ balance: state.balance }),
    },
    transaction: { create: async ({ data }: { data: Record<string, unknown> }) => state.transactions.push(data) },
    payment: {
      findFirst: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => state.payments.push(data),
      update: vi.fn(),
    },
  };
  return { state, tx: tx as unknown as Prisma.TransactionClient };
}

beforeEach(() => {
  mocks.fulfillInvoicePayment.mockReset();
  mocks.fulfillInvoicePayment.mockResolvedValue({ fulfilled: true });
});

describe("payInvoicesFromBalance", () => {
  it("debits the outstanding amount, writes the ledger and fulfils with the same reference", async () => {
    const { state, tx } = createTx("150.00");

    const result = await payInvoicesFromBalance(tx, { customerId: "cus-1", invoiceIds: ["inv-1"], performedBy: "cus-1" });

    expect(result.total).toBe(100);
    expect(state.balance.toString()).toBe("50");
    expect(state.transactions[0]).toMatchObject({ type: "PAYMENT", referenceId: result.reference });
    expect(String(state.transactions[0].balanceBefore)).toBe("150");
    expect(state.payments[0]).toMatchObject({ method: "BALANCE", transactionId: result.reference });
    expect(mocks.fulfillInvoicePayment.mock.calls[0][1]).toMatchObject({ paymentReference: result.reference });
  });

  it("refuses when the balance does not cover it and changes nothing", async () => {
    const { state, tx } = createTx("99.99");

    await expect(
      payInvoicesFromBalance(tx, { customerId: "cus-1", invoiceIds: ["inv-1"], performedBy: "cus-1" })
    ).rejects.toThrow(BalancePaymentError);
    expect(state.balance.toString()).toBe("99.99");
    expect(mocks.fulfillInvoicePayment).not.toHaveBeenCalled();
  });

  it("refuses paid invoices (a second concurrent request after the row lock)", async () => {
    const { tx } = createTx("500", "PAID");
    await expect(
      payInvoicesFromBalance(tx, { customerId: "cus-1", invoiceIds: ["inv-1"], performedBy: "cus-1" })
    ).rejects.toThrow("INVOICE_NOT_PAYABLE");
  });
});
