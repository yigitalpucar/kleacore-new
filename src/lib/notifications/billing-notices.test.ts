import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoiceFindMany: vi.fn(),
  logFindMany: vi.fn(),
  sendNotification: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    invoice: { findMany: mocks.invoiceFindMany },
    notificationLog: { findMany: mocks.logFindMany },
  },
}));
vi.mock("./send", () => ({ sendNotification: mocks.sendNotification }));
vi.mock("@/lib/cron/jobs/suspend-overdue-services", () => ({ getSuspendGraceDays: async () => 3 }));

import { notifyOverdueInvoices, sendInvoiceNotices } from "./billing-notices";

const now = new Date("2026-10-08T09:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function invoice(id: string, dueInDays: number, total = "100.00") {
  return {
    id,
    invoiceNumber: `F-${id}`,
    customerId: `c-${id}`,
    totalAmount: new Prisma.Decimal(total),
    dueDate: new Date(now.getTime() + dueInDays * DAY),
  };
}

describe("invoice notices", () => {
  beforeEach(() => {
    mocks.logFindMany.mockResolvedValue([]);
    mocks.sendNotification.mockResolvedValue({ ok: true, logIds: ["l1"], deduplicated: false });
  });

  it("sends the overdue notice once per invoice with the grace period", async () => {
    mocks.invoiceFindMany.mockResolvedValue([invoice("1", -1), invoice("2", -2)]);
    mocks.logFindMany.mockResolvedValue([{ dedupeKey: "invoice.overdue:2" }]);

    const sent = await notifyOverdueInvoices(["1", "2"], now);

    expect(sent).toBe(1);
    expect(mocks.sendNotification).toHaveBeenCalledTimes(1);
    expect(mocks.sendNotification).toHaveBeenCalledWith({
      userId: "c-1",
      template: "billing.invoice-overdue",
      data: expect.objectContaining({ invoiceId: "1", invoiceNumber: "F-1", totalAmount: "100", suspendAfterDays: 3 }),
      dedupeKey: "invoice.overdue:1",
    });
  });

  it("skips zero-amount invoices", async () => {
    mocks.invoiceFindMany.mockResolvedValue([invoice("1", -1, "0")]);
    expect(await notifyOverdueInvoices(["1"], now)).toBe(0);
    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });

  it("sweeps created (renewal/manual only) and overdue invoices with stable keys", async () => {
    mocks.invoiceFindMany
      .mockResolvedValueOnce([invoice("new", 7)]) // created
      .mockResolvedValueOnce([]) // overdue ids
      .mockResolvedValueOnce([]);

    const result = await sendInvoiceNotices(now);

    expect(result).toEqual({ created: 1, overdue: 0 });
    const createdQuery = mocks.invoiceFindMany.mock.calls[0][0].where;
    expect(createdQuery).toMatchObject({
      status: "PENDING",
      OR: [{ orderId: null }, { order: { serviceId: { not: null } } }],
    });
    expect(mocks.sendNotification.mock.calls.map((call) => [call[0].template, call[0].dedupeKey])).toEqual([
      ["billing.invoice-created", "invoice.created:new"],
    ]);
  });

  it("does not queue anything for invoices already notified", async () => {
    mocks.invoiceFindMany.mockResolvedValueOnce([invoice("new", 7)]).mockResolvedValueOnce([]);
    mocks.logFindMany.mockImplementation(async ({ where }: { where: { dedupeKey: { in: string[] } } }) =>
      where.dedupeKey.in.map((dedupeKey) => ({ dedupeKey }))
    );

    expect(await sendInvoiceNotices(now)).toEqual({ created: 0, overdue: 0 });
    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });
});
