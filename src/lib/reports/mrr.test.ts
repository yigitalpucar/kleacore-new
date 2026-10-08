import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { computeMrrReport, monthlyValue, serviceEnd, type MrrServiceInput } from "./mrr";

const at = (iso: string) => new Date(`${iso}T09:00:00Z`);

function service(partial: Partial<MrrServiceInput> & Pick<MrrServiceInput, "id" | "customerId">): MrrServiceInput {
  return {
    amount: 100,
    billingPeriod: "monthly",
    status: "ACTIVE",
    createdAt: at("2026-01-10"),
    updatedAt: at("2026-01-10"),
    cancelledAt: null,
    suspendedAt: null,
    ...partial,
  };
}

describe("monthlyValue", () => {
  it("normalises period totals to a month (period-price semantics)", () => {
    expect(monthlyValue(49, "monthly").toString()).toBe("49");
    expect(monthlyValue(468, "yearly").toString()).toBe("39");
    expect(monthlyValue(270, "quarterly").toString()).toBe("90");
    expect(monthlyValue(1080, "biennial").toString()).toBe("45");
    expect(monthlyValue(100, "semiannual").toFixed(4)).toBe("16.6667");
  });
});

describe("serviceEnd", () => {
  it("derives when a service stopped earning", () => {
    expect(serviceEnd({ status: "ACTIVE", updatedAt: at("2026-05-01"), cancelledAt: null, suspendedAt: null })).toBeNull();
    expect(serviceEnd({ status: "CANCELLED", updatedAt: at("2026-05-01"), cancelledAt: at("2026-04-01"), suspendedAt: null })).toEqual(at("2026-04-01"));
    expect(serviceEnd({ status: "EXPIRED", updatedAt: at("2026-05-01"), cancelledAt: null, suspendedAt: null })).toEqual(at("2026-05-01"));
    expect(serviceEnd({ status: "SUSPENDED", updatedAt: at("2026-05-09"), cancelledAt: null, suspendedAt: at("2026-05-04") })).toEqual(at("2026-05-04"));
  });
});

describe("computeMrrReport", () => {
  // Fixture: three customers over Jan–Apr 2026.
  // A: monthly 100 since Jan + yearly 1200 (=100/mo) since Feb → churns the monthly one in Mar.
  // B: yearly 2400 (=200/mo) since Jan, cancelled in Apr → logo churn in Apr.
  // C: quarterly 150 (=50/mo) since Mar; suspended in Apr (counts as churned).
  // P: PENDING (paid, not provisioned) and F: free → ignored.
  const services: MrrServiceInput[] = [
    service({ id: "a1", customerId: "A", createdAt: at("2026-01-05"), status: "CANCELLED", cancelledAt: at("2026-03-15") }),
    service({ id: "a2", customerId: "A", amount: 1200, billingPeriod: "yearly", createdAt: at("2026-02-01") }),
    service({ id: "b1", customerId: "B", amount: 2400, billingPeriod: "yearly", createdAt: at("2026-01-20"), status: "CANCELLED", cancelledAt: at("2026-04-10") }),
    service({ id: "c1", customerId: "C", amount: 150, billingPeriod: "quarterly", createdAt: at("2026-03-03"), status: "SUSPENDED", suspendedAt: at("2026-04-20") }),
    service({ id: "p1", customerId: "P", status: "PENDING", createdAt: at("2026-02-02") }),
    service({ id: "f1", customerId: "F", amount: 0, createdAt: at("2026-02-02") }),
  ];
  const report = computeMrrReport(services, ["2026-01", "2026-02", "2026-03", "2026-04"], at("2026-05-02"));
  const month = (m: string) => report.months.find((r) => r.month === m)!;

  it("tracks start/end MRR and new MRR per month", () => {
    expect(month("2026-01").startMrr.toString()).toBe("0");
    expect(month("2026-01").newMrr.toString()).toBe("300");
    expect(month("2026-01").endMrr.toString()).toBe("300");
    expect(month("2026-02").newMrr.toString()).toBe("100");
    expect(month("2026-02").endMrr.toString()).toBe("400");
    expect(month("2026-03").endMrr.toString()).toBe("350");
  });

  it("computes churned MRR, revenue churn and logo churn", () => {
    const mar = month("2026-03");
    expect(mar.churnedMrr.toString()).toBe("100");
    expect(mar.churnedCustomers).toBe(0); // A still has the yearly service
    expect(mar.logoChurnRate?.toString()).toBe("0");
    expect(mar.revenueChurnRate?.toString()).toBe("25"); // 100 / 400

    const apr = month("2026-04");
    expect(apr.startMrr.toString()).toBe("350");
    expect(apr.churnedMrr.toString()).toBe("250"); // B 200 + C 50 (suspended)
    expect(apr.startCustomers).toBe(3);
    expect(apr.churnedCustomers).toBe(2);
    expect(apr.logoChurnRate?.toString()).toBe("66.67");
    expect(apr.revenueChurnRate?.toString()).toBe("71.43");
    expect(apr.endMrr.toString()).toBe("100");
    expect(apr.arpu?.toString()).toBe("100");
  });

  it("reports current MRR, ARR and ARPU of live services only", () => {
    expect(report.current.mrr.toString()).toBe("100");
    expect(report.current.arr.toString()).toBe("1200");
    expect(report.current.customers).toBe(1);
    expect(report.current.services).toBe(1);
  });

  it("returns null rates when nothing was live at the start", () => {
    expect(month("2026-01").logoChurnRate).toBeNull();
    expect(month("2026-01").revenueChurnRate).toBeNull();
  });
});
