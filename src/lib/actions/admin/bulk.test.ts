import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermission = vi.fn();
vi.mock("@/lib/utils/auth-helpers", () => ({ requirePermission: (p: string) => requirePermission(p) }));
const logActivity = vi.fn();
vi.mock("@/lib/activity-log", () => ({ logActivity: (...a: unknown[]) => logActivity(...a) }));

const single = {
  sendInvoiceReminder: vi.fn(),
  cancelInvoice: vi.fn(),
  suspendService: vi.fn(),
  activateService: vi.fn(),
  suspendCustomer: vi.fn(),
  activateCustomer: vi.fn(),
  cancelOrder: vi.fn(),
  assignTicket: vi.fn(),
  closeTicket: vi.fn(),
};
vi.mock("./invoices", () => ({ sendInvoiceReminder: (...a: unknown[]) => single.sendInvoiceReminder(...a), cancelInvoice: (...a: unknown[]) => single.cancelInvoice(...a) }));
vi.mock("./services", () => ({ suspendService: (...a: unknown[]) => single.suspendService(...a), activateService: (...a: unknown[]) => single.activateService(...a) }));
vi.mock("./customers", () => ({ suspendCustomer: (...a: unknown[]) => single.suspendCustomer(...a), activateCustomer: (...a: unknown[]) => single.activateCustomer(...a) }));
vi.mock("./orders", () => ({ cancelOrder: (...a: unknown[]) => single.cancelOrder(...a) }));
vi.mock("./tickets", () => ({ assignTicket: (...a: unknown[]) => single.assignTicket(...a), closeTicket: (...a: unknown[]) => single.closeTicket(...a) }));

import * as bulk from "./bulk";

beforeEach(() => {
  requirePermission.mockReset().mockResolvedValue({ user: { id: "staff1", role: "ADMIN" } });
  logActivity.mockReset();
  for (const fn of Object.values(single)) fn.mockReset().mockResolvedValue({ success: true });
});

describe("bulk admin actions", () => {
  it.each([
    ["bulkSendInvoiceReminders", "invoices.edit", "sendInvoiceReminder", [] as string[]],
    ["bulkCancelInvoices", "invoices.edit", "cancelInvoice", []],
    ["bulkUnsuspendServices", "services.manage", "activateService", []],
    ["bulkSuspendCustomers", "customers.edit", "suspendCustomer", []],
    ["bulkActivateCustomers", "customers.edit", "activateCustomer", []],
    ["bulkCloseTickets", "tickets.reply", "closeTicket", []],
  ] as const)("%s needs %s and runs %s per id", async (name, permission, singleName) => {
    const fn = bulk[name] as (ids: string[]) => Promise<{ succeeded: number }>;
    const result = await fn(["a", "b"]);
    expect(requirePermission).toHaveBeenCalledWith(permission);
    expect(single[singleName].mock.calls.map((c) => c[0])).toEqual(["a", "b"]);
    expect(result.succeeded).toBe(2);
  });

  it("logs one activity row per item for actions that do not log themselves", async () => {
    await bulk.bulkCloseTickets(["t1", "t2"]);
    expect(logActivity).toHaveBeenCalledTimes(2);
    expect(logActivity.mock.calls[0][0]).toMatchObject({ userId: "staff1", action: "ticket.closed", entityId: "t1" });
  });

  it("does not double-log service suspension (the lifecycle writes its own row)", async () => {
    await bulk.bulkSuspendServices(["s1"], "Ödeme yok");
    expect(single.suspendService).toHaveBeenCalledWith("s1", "Ödeme yok");
    expect(logActivity).not.toHaveBeenCalled();
  });

  it("requires a reason for suspension and cancellation", async () => {
    expect((await bulk.bulkSuspendServices(["s1"], "  ")).error).toBe("Neden girilmedi");
    expect((await bulk.bulkCancelOrders(["o1"], "")).error).toBe("Neden girilmedi");
    expect(single.suspendService).not.toHaveBeenCalled();
    expect(single.cancelOrder).not.toHaveBeenCalled();
  });

  it("assigns tickets to the chosen staff member and reports partial failures", async () => {
    single.assignTicket.mockImplementation(async (id: string) =>
      id === "t2" ? { success: false, error: "Destek talebi bulunamadı" } : { success: true }
    );
    const result = await bulk.bulkAssignTickets(["t1", "t2"], "staff2");
    expect(requirePermission).toHaveBeenCalledWith("tickets.reply");
    expect(single.assignTicket).toHaveBeenCalledWith("t1", "staff2");
    expect(result).toMatchObject({ success: false, succeeded: 1, failed: [{ id: "t2", error: "Destek talebi bulunamadı" }] });
  });
});
