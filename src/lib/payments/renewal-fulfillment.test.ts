import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { applyServiceRenewalFromOrder, isRenewalOrder } from "./renewal-fulfillment";

describe("isRenewalOrder", () => {
  it("returns true when serviceId and renewalMonths are present", () => {
    expect(
      isRenewalOrder({
        serviceId: "svc-1",
        items: [{ configuration: { serviceId: "svc-1", renewalMonths: 12 } }],
      })
    ).toBe(true);
  });

  it("returns false when renewalMonths is missing", () => {
    expect(
      isRenewalOrder({
        serviceId: "svc-1",
        items: [{ configuration: { serviceId: "svc-1" } }],
      })
    ).toBe(false);
  });

  it("returns false when serviceId is missing", () => {
    expect(
      isRenewalOrder({
        serviceId: null,
        items: [{ configuration: { renewalMonths: 12 } }],
      })
    ).toBe(false);
  });
});
describe("applyServiceRenewalFromOrder", () => {
  function createTx(status: string, suspendReason: string | null) {
    return {
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: "ord-1",
          serviceId: "svc-1",
          billingPeriod: "yearly",
          basePrice: 468,
          items: [{ configuration: { renewalMonths: 12 } }],
        }),
      },
      service: {
        findUnique: vi.fn().mockResolvedValue({
          id: "svc-1",
          status,
          suspendReason,
          nextDueDate: new Date("2026-01-01T00:00:00Z"),
          expiresAt: null,
        }),
        update: vi.fn(),
      },
    };
  }

  it("extends a suspended service without lifting its suspension (left to the lifecycle check)", async () => {
    const tx = createTx("SUSPENDED", "CUSTOMER_STOPPED");

    await applyServiceRenewalFromOrder(tx as unknown as Prisma.TransactionClient, "ord-1");

    const { data } = tx.service.update.mock.calls[0][0];
    expect(data).not.toHaveProperty("status");
    expect(data).not.toHaveProperty("suspendReason");
    expect(data.nextDueDate).toBeInstanceOf(Date);
  });

  it("reactivates an expired service on renewal", async () => {
    const tx = createTx("EXPIRED", null);

    await applyServiceRenewalFromOrder(tx as unknown as Prisma.TransactionClient, "ord-1");

    expect(tx.service.update.mock.calls[0][0].data).toMatchObject({ status: "ACTIVE" });
  });
});
