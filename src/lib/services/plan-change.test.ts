import { describe, expect, it } from "vitest";
import {
  calculateProratedPlanChange,
  determinePlanChangeType,
  isPlanChangeOrder,
} from "./plan-change";
import type { BillingPeriod } from "@prisma/client";

function buildService(overrides: {
  amount?: number;
  billingPeriod?: BillingPeriod;
  nextDueDate?: Date | null;
  expiresAt?: Date | null;
} = {}) {
  const now = new Date("2026-06-17T12:00:00.000Z");
  const nextDueDate = new Date("2026-07-17T12:00:00.000Z");

  return {
    amount: overrides.amount ?? 100,
    billingPeriod: overrides.billingPeriod ?? "monthly",
    nextDueDate: overrides.nextDueDate ?? nextDueDate,
    expiresAt: overrides.expiresAt ?? null,
    _now: now,
  };
}

function buildProduct(
  basePrice: number,
  displayOrder = 0,
  tierPrice?: number
) {
  return {
    basePrice,
    displayOrder,
    pricingTiers: [
      {
        period: "monthly" as BillingPeriod,
        price: tierPrice ?? basePrice,
        discountedPrice: null,
        isActive: true,
      },
    ],
  };
}

describe("calculateProratedPlanChange", () => {
  it("calculates prorated upgrade amount from remaining days and price diff", () => {
    const service = buildService({ amount: 100 });
    const target = buildProduct(200);

    const result = calculateProratedPlanChange(
      {
        amount: service.amount,
        billingPeriod: service.billingPeriod,
        nextDueDate: service.nextDueDate,
        expiresAt: service.expiresAt,
      },
      target,
      "monthly"
    );

    expect(result.currentPrice).toBe(100);
    expect(result.newPrice).toBe(200);
    expect(result.priceDiff).toBe(100);
    expect(result.totalDays).toBe(30);
    expect(result.remainingDays).toBe(30);
    expect(result.proratedAmount).toBe(100);
  });

  it("uses half-period remaining days for partial proration", () => {
    const service = buildService({
      amount: 120,
      nextDueDate: new Date("2026-07-02T12:00:00.000Z"),
    });
    const target = buildProduct(240);

    const result = calculateProratedPlanChange(
      {
        amount: service.amount,
        billingPeriod: service.billingPeriod,
        nextDueDate: service.nextDueDate,
        expiresAt: service.expiresAt,
      },
      target,
      "monthly"
    );

    expect(result.remainingDays).toBe(15);
    expect(result.proratedAmount).toBe(60);
  });

  it("returns zero proration when billing period already ended", () => {
    const service = buildService({
      amount: 90,
      nextDueDate: new Date("2026-06-10T12:00:00.000Z"),
    });
    const target = buildProduct(180);

    const result = calculateProratedPlanChange(
      {
        amount: service.amount,
        billingPeriod: service.billingPeriod,
        nextDueDate: service.nextDueDate,
        expiresAt: service.expiresAt,
      },
      target,
      "monthly"
    );

    expect(result.remainingDays).toBe(0);
    expect(result.proratedAmount).toBe(0);
  });

  it("scales total days for yearly billing periods", () => {
    const service = buildService({
      amount: 1200,
      billingPeriod: "yearly",
      nextDueDate: new Date("2027-06-17T12:00:00.000Z"),
    });
    const target = {
      basePrice: 2400,
      displayOrder: 2,
      pricingTiers: [
        {
          period: "yearly" as BillingPeriod,
          price: 2400,
          discountedPrice: null,
          isActive: true,
        },
      ],
    };

    const result = calculateProratedPlanChange(
      {
        amount: service.amount,
        billingPeriod: service.billingPeriod,
        nextDueDate: service.nextDueDate,
        expiresAt: service.expiresAt,
      },
      target,
      "yearly"
    );

    expect(result.totalDays).toBe(360);
    expect(result.remainingDays).toBe(365);
    expect(result.proratedAmount).toBeCloseTo(1216.67, 1);
  });

  it("returns negative proration for downgrades", () => {
    const service = buildService({ amount: 200 });
    const target = buildProduct(100);

    const result = calculateProratedPlanChange(
      {
        amount: service.amount,
        billingPeriod: service.billingPeriod,
        nextDueDate: service.nextDueDate,
        expiresAt: service.expiresAt,
      },
      target,
      "monthly"
    );

    expect(result.priceDiff).toBe(-100);
    expect(result.proratedAmount).toBe(-100);
  });
});

describe("determinePlanChangeType", () => {
  it("prefers displayOrder over price", () => {
    expect(
      determinePlanChangeType(
        { displayOrder: 1, basePrice: 500 },
        { displayOrder: 2, basePrice: 100 }
      )
    ).toBe("UPGRADE");

    expect(
      determinePlanChangeType(
        { displayOrder: 3, basePrice: 100 },
        { displayOrder: 1, basePrice: 500 }
      )
    ).toBe("DOWNGRADE");
  });

  it("falls back to price when displayOrder is equal", () => {
    expect(
      determinePlanChangeType(
        { displayOrder: 2, basePrice: 100 },
        { displayOrder: 2, basePrice: 200 }
      )
    ).toBe("UPGRADE");

    expect(
      determinePlanChangeType(
        { displayOrder: 2, basePrice: 200 },
        { displayOrder: 2, basePrice: 100 }
      )
    ).toBe("DOWNGRADE");
  });
});

describe("isPlanChangeOrder", () => {
  it("detects plan change orders by configuration type", () => {
    expect(
      isPlanChangeOrder({
        serviceId: "svc-1",
        items: [
          {
            configuration: {
              type: "plan_change",
              planChangeId: "pc-1",
              serviceId: "svc-1",
            },
          },
        ],
      })
    ).toBe(true);
  });

  it("returns false for renewal orders", () => {
    expect(
      isPlanChangeOrder({
        serviceId: "svc-1",
        items: [{ configuration: { renewalMonths: 12, serviceId: "svc-1" } }],
      })
    ).toBe(false);
  });
});