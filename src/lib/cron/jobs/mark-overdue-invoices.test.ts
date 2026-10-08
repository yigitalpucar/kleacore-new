import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  updateMany: vi.fn(),
  emitEvent: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const db = {
    invoice: { findMany: mocks.findMany, updateMany: mocks.updateMany },
    $transaction: (fn: (tx: unknown) => unknown) => fn(db),
  };
  return { db };
});
vi.mock("@/lib/events/emit", () => ({ emitEvent: mocks.emitEvent }));
vi.mock("./suspend-overdue-services", () => ({ getSuspendGraceDays: async () => 3 }));

import { markOverdueInvoices } from "./mark-overdue-invoices";

const due = new Date("2026-10-01T00:00:00Z");
const invoice = (id: string) => ({ id, invoiceNumber: `F-${id}`, customerId: "cus-1", totalAmount: "100.00", dueDate: due });

describe("markOverdueInvoices", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.updateMany.mockResolvedValue({ count: 1 });
  });

  it("returns zero processed when no pending overdue invoices exist", async () => {
    mocks.findMany.mockResolvedValue([]);

    const result = await markOverdueInvoices();

    expect(result).toEqual({ processed: 0, ids: [] });
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "PENDING", dueDate: { lt: expect.any(Date) } } })
    );
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.emitEvent).not.toHaveBeenCalled();
  });

  it("flips each pending invoice to OVERDUE and writes invoice.overdue in the same transaction", async () => {
    mocks.findMany.mockResolvedValue([invoice("inv-1"), invoice("inv-2")]);

    const result = await markOverdueInvoices();

    expect(result).toEqual({ processed: 2, ids: ["inv-1", "inv-2"] });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "inv-1", status: "PENDING" },
      data: { status: "OVERDUE" },
    });
    expect(mocks.emitEvent).toHaveBeenCalledWith(
      expect.anything(),
      "invoice.overdue",
      expect.objectContaining({ invoiceId: "inv-2", customerId: "cus-1", suspendAfterDays: 3 })
    );
  });

  it("emits nothing for an invoice paid between the read and the update", async () => {
    mocks.findMany.mockResolvedValue([invoice("inv-1")]);
    mocks.updateMany.mockResolvedValue({ count: 0 });

    expect(await markOverdueInvoices()).toEqual({ processed: 0, ids: [] });
    expect(mocks.emitEvent).not.toHaveBeenCalled();
  });
});
