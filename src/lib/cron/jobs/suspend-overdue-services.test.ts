import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoiceFindMany: vi.fn(),
  serviceFindMany: vi.fn(),
  serviceUpdate: vi.fn(),
  getSettingValue: vi.fn(),
  suspendRemoteService: vi.fn(),
  emitEvent: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const db = {
    invoice: { findMany: mocks.invoiceFindMany },
    service: { findMany: mocks.serviceFindMany, update: mocks.serviceUpdate },
    $transaction: (fn: (tx: unknown) => unknown) => fn(db),
  };
  return { db };
});
vi.mock("@/lib/events/emit", () => ({ emitEvent: mocks.emitEvent }));
vi.mock("@/lib/integrations/settings", () => ({ getSettingValue: mocks.getSettingValue }));
vi.mock("@/lib/integrations/provisioning-provider", () => ({
  suspendRemoteService: mocks.suspendRemoteService,
}));

import { NON_PAYMENT_SUSPEND_REASON } from "@/lib/payments/service-lifecycle";
import { parseSuspendGraceDays, suspendOverdueServices } from "./suspend-overdue-services";

const NOW = new Date("2026-10-08T06:00:00.000Z");

describe("parseSuspendGraceDays", () => {
  it("defaults to 3 days for missing or invalid values", () => {
    expect(parseSuspendGraceDays(undefined)).toBe(3);
    expect(parseSuspendGraceDays("")).toBe(3);
    expect(parseSuspendGraceDays("-2")).toBe(3);
    expect(parseSuspendGraceDays("abc")).toBe(3);
  });

  it("accepts whole numbers including 0", () => {
    expect(parseSuspendGraceDays("0")).toBe(0);
    expect(parseSuspendGraceDays(" 7 ")).toBe(7);
  });
});

describe("suspendOverdueServices", () => {
  beforeEach(() => {
    mocks.getSettingValue.mockResolvedValue("3");
    mocks.invoiceFindMany.mockResolvedValue([]);
    mocks.serviceFindMany.mockResolvedValue([]);
    mocks.serviceUpdate.mockImplementation(async ({ where, data }) => ({ id: where.id, ...data }));
    mocks.suspendRemoteService.mockResolvedValue({ ok: true });
  });

  it("only looks at overdue invoices past the grace period that belong to a service", async () => {
    await suspendOverdueServices(NOW);

    expect(mocks.getSettingValue).toHaveBeenCalledWith("suspend_grace_days", undefined, "3");
    expect(mocks.invoiceFindMany).toHaveBeenCalledWith({
      where: {
        status: "OVERDUE",
        dueDate: { lt: new Date("2026-10-05T06:00:00.000Z") },
        order: { serviceId: { not: null } },
      },
      select: { order: { select: { serviceId: true } } },
    });
  });

  it("uses the configured grace days", async () => {
    mocks.getSettingValue.mockResolvedValue("10");

    await suspendOverdueServices(NOW);

    expect(mocks.invoiceFindMany.mock.calls[0][0].where.dueDate).toEqual({
      lt: new Date("2026-09-28T06:00:00.000Z"),
    });
  });

  it("suspends only the service linked to the overdue invoice, never the customer's other services", async () => {
    mocks.invoiceFindMany.mockResolvedValue([{ order: { serviceId: "svc-linked" } }]);
    mocks.serviceFindMany.mockResolvedValue([
      { id: "svc-linked", customerId: "cus-1", product: {}, customer: {} },
    ]);

    const result = await suspendOverdueServices(NOW);

    expect(mocks.serviceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["svc-linked"] }, status: "ACTIVE" } })
    );
    expect(mocks.serviceFindMany).toHaveBeenCalledTimes(1);
    expect(mocks.serviceUpdate).toHaveBeenCalledWith({
      where: { id: "svc-linked" },
      data: { status: "SUSPENDED", suspendedAt: NOW, suspendReason: NON_PAYMENT_SUSPEND_REASON },
    });
    expect(mocks.suspendRemoteService).toHaveBeenCalledTimes(1);
    expect(mocks.emitEvent).toHaveBeenCalledWith(
      expect.anything(),
      "service.suspended",
      expect.objectContaining({ reason: NON_PAYMENT_SUSPEND_REASON })
    );
    expect(result).toEqual({ processed: 1, skipped: 0, ids: ["svc-linked"] });
  });

  it("does nothing when no overdue invoice is linked to a service", async () => {
    const result = await suspendOverdueServices(NOW);

    expect(result).toEqual({ processed: 0, skipped: 0, ids: [] });
    expect(mocks.serviceFindMany).not.toHaveBeenCalled();
    expect(mocks.serviceUpdate).not.toHaveBeenCalled();
  });

  it("logs a failed remote suspension but keeps the billing suspension", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.invoiceFindMany.mockResolvedValue([{ order: { serviceId: "svc-1" } }]);
    mocks.serviceFindMany.mockResolvedValue([{ id: "svc-1", product: {}, customer: {} }]);
    mocks.suspendRemoteService.mockResolvedValue({ ok: false, error: "WHM_HTTP_500" });

    const result = await suspendOverdueServices(NOW);

    expect(result.processed).toBe(1);
    expect(error).toHaveBeenCalled();
  });
});
