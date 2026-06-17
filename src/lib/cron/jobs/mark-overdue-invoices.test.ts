import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany, updateMany } = vi.hoisted(() => ({
  findMany: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    invoice: {
      findMany,
      updateMany,
    },
  },
}));

vi.mock("@/lib/integrations/settings", () => ({
  getSettingValue: vi.fn().mockResolvedValue("false"),
  isEnabled: (value: string | undefined | null) =>
    ["1", "true", "yes", "on", "active"].includes((value ?? "").toLowerCase()),
}));

vi.mock("@/lib/notifications/sms", () => ({
  dispatchSmsNotification: vi.fn(),
  sendSmsNotification: vi.fn(),
}));

import { markOverdueInvoices } from "./mark-overdue-invoices";

describe("markOverdueInvoices", () => {
  beforeEach(() => {
    findMany.mockReset();
    updateMany.mockReset();
    updateMany.mockResolvedValue({ count: 0 });
  });

  it("returns zero processed when no pending overdue invoices exist", async () => {
    findMany.mockResolvedValue([]);

    const result = await markOverdueInvoices();

    expect(result).toEqual({ processed: 0, ids: [] });
    expect(findMany).toHaveBeenCalledWith({
      where: {
        status: "PENDING",
        dueDate: { lt: expect.any(Date) },
      },
      select: { id: true },
    });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("marks pending invoices past due date as overdue", async () => {
    findMany.mockResolvedValue([{ id: "inv-1" }, { id: "inv-2" }]);

    const result = await markOverdueInvoices();

    expect(result).toEqual({
      processed: 2,
      ids: ["inv-1", "inv-2"],
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["inv-1", "inv-2"] } },
      data: { status: "OVERDUE" },
    });
  });
});