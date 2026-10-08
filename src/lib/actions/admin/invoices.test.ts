import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  invoiceCreate: vi.fn(),
  emitEvent: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const db = {
    user: { findUnique: mocks.userFindUnique },
    invoice: { create: mocks.invoiceCreate },
    $transaction: (fn: (tx: unknown) => unknown) => fn(db),
  };
  return { db };
});
vi.mock("@/lib/events/emit", () => ({ emitEvent: mocks.emitEvent }));
vi.mock("@/lib/utils/auth-helpers", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ user: { id: "admin-1" } }),
}));
vi.mock("@/lib/utils/number-generators", () => ({
  generateInvoiceNumber: vi.fn().mockResolvedValue("KC-2026-0001"),
}));
vi.mock("@/lib/mail", () => ({ plainTextToHtml: vi.fn(), sendTransactionalEmail: vi.fn() }));
vi.mock("@/lib/notifications/email", () => ({
  dispatchNotification: vi.fn(),
  loadCustomerRecipient: vi.fn(),
  sendInvoiceCreatedEmail: vi.fn(),
  sendInvoiceOverdueEmail: vi.fn(),
  sendInvoicePaymentReminderEmail: vi.fn(),
}));
vi.mock("@/lib/payments/fulfillment", () => ({
  fulfillInvoicePayment: vi.fn(),
  notifyInvoicePaymentReceived: vi.fn(),
}));
vi.mock("@/lib/payments/service-lifecycle", () => ({ runUnsuspendJobsForInvoices: vi.fn() }));
vi.mock("@/lib/activity-log", () => ({ logActivity: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createInvoice } from "./invoices";

type CreateArgs = {
  data: {
    subtotal: Prisma.Decimal;
    taxRate: Prisma.Decimal;
    taxAmount: Prisma.Decimal;
    totalAmount: Prisma.Decimal;
    items: { create: Array<{ unitPrice: Prisma.Decimal; totalPrice: Prisma.Decimal }> };
  };
};

describe("createInvoice (admin fatura oluştur)", () => {
  beforeEach(() => {
    mocks.userFindUnique.mockResolvedValue({ id: "cus-1" });
    mocks.invoiceCreate.mockImplementation(async () => ({ id: "inv-1" }));
  });

  it("recomputes totals from the lines in Decimal and ignores browser totals", async () => {
    const result = await createInvoice({
      customerId: "cus-1",
      taxRate: 20,
      dueDate: "2026-11-01",
      // Float totals as the old form sent them — must not be stored.
      subtotal: 0.30000000000000004,
      taxAmount: 0.06000000000000001,
      totalAmount: 0.36000000000000004,
      items: [
        { description: "A", quantity: 1, unitPrice: 0.1 },
        { description: "B", quantity: 1, unitPrice: 0.2 },
        { description: "C", quantity: 3, unitPrice: "33.335" },
      ],
    });

    expect(result.success).toBe(true);
    const { data } = mocks.invoiceCreate.mock.calls[0][0] as CreateArgs;
    const lines = data.items.create;

    expect(lines.map((line) => line.totalPrice.toFixed(2))).toEqual(["0.10", "0.20", "100.02"]);
    expect(lines[2].unitPrice.toFixed(2)).toBe("33.34");
    expect(data.subtotal.toFixed(2)).toBe("100.32");
    expect(data.taxAmount.toFixed(2)).toBe("20.06"); // 20.064 -> 20.06
    expect(data.totalAmount.toFixed(2)).toBe("120.38");
    expect(data.taxRate.toString()).toBe("20");

    // Invoice equals its lines.
    const lineSum = lines.reduce((acc, line) => acc.plus(line.totalPrice), new Prisma.Decimal(0));
    expect(lineSum.equals(data.subtotal)).toBe(true);
    expect(data.subtotal.plus(data.taxAmount).equals(data.totalAmount)).toBe(true);

    // "Fatura oluştu" is the invoice.created event written with the invoice.
    expect(mocks.emitEvent).toHaveBeenCalledWith(
      expect.anything(),
      "invoice.created",
      expect.objectContaining({ invoiceId: "inv-1", customerId: "cus-1", source: "admin" }),
      { actorId: "admin-1" }
    );
  });

  it("rejects invalid lines and tax rates", async () => {
    const base = { customerId: "cus-1", dueDate: "2026-11-01" };

    const badQuantity = await createInvoice({
      ...base,
      items: [{ description: "A", quantity: 0, unitPrice: 10 }],
    });
    const negativePrice = await createInvoice({
      ...base,
      items: [{ description: "A", quantity: 1, unitPrice: -1 }],
    });
    const badRate = await createInvoice({
      ...base,
      taxRate: 120,
      items: [{ description: "A", quantity: 1, unitPrice: 10 }],
    });

    for (const result of [badQuantity, negativePrice, badRate]) {
      expect(result.success).toBe(false);
    }
    expect(mocks.invoiceCreate).not.toHaveBeenCalled();
  });
});
