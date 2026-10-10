import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const fn = () => vi.fn(async (_args: unknown) => [] as unknown[]);
  return {
    service: fn(),
    domain: fn(),
    invoice: fn(),
    supportTicket: fn(),
    order: fn(),
    user: fn(),
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    service: { findMany: mocks.service },
    domain: { findMany: mocks.domain },
    invoice: { findMany: mocks.invoice },
    supportTicket: { findMany: mocks.supportTicket },
    order: { findMany: mocks.order },
    user: { findMany: mocks.user },
  },
}));

import {
  normalizeSearchQuery,
  searchCustomerRecords,
  searchStaffRecords,
  staffSearchGroups,
} from "./command-search";

type Call = { where: Record<string, unknown> };
const whereOf = (mock: (typeof mocks)[keyof typeof mocks]) => (mock.mock.calls[0]?.[0] as Call | undefined)?.where;

beforeEach(() => Object.values(mocks).forEach((m) => m.mockReset().mockResolvedValue([])));

describe("normalizeSearchQuery", () => {
  it("requires two characters after trimming and caps the length", () => {
    expect(normalizeSearchQuery(" a ")).toBeNull();
    expect(normalizeSearchQuery(null)).toBeNull();
    expect(normalizeSearchQuery("  F-2026   01 ")).toBe("F-2026 01");
    expect(normalizeSearchQuery("x".repeat(200))).toHaveLength(64);
  });
});

describe("customer search is scoped to the session user", () => {
  it("every query is filtered by customerId = the caller", async () => {
    await searchCustomerRecords("cus-1", "ornek");
    for (const mock of [mocks.service, mocks.domain, mocks.invoice, mocks.supportTicket]) {
      expect(whereOf(mock)).toMatchObject({ customerId: "cus-1" });
    }
  });

  it("never touches customers or orders tables", async () => {
    await searchCustomerRecords("cus-1", "ornek");
    expect(mocks.user).not.toHaveBeenCalled();
    expect(mocks.order).not.toHaveBeenCalled();
  });

  it("an empty user id returns nothing without querying", async () => {
    expect(await searchCustomerRecords("", "ornek")).toEqual([]);
    expect(mocks.invoice).not.toHaveBeenCalled();
  });

  it("unpaid invoices get the 'Öde' quick action, paid ones do not", async () => {
    mocks.invoice.mockResolvedValue([
      { id: "i1", invoiceNumber: "F-1", status: "PENDING", dueDate: new Date("2026-10-20T00:00:00Z") },
      { id: "i2", invoiceNumber: "F-2", status: "PAID", dueDate: new Date("2026-09-20T00:00:00Z") },
    ]);
    const groups = await searchCustomerRecords("cus-1", "F-");
    expect(groups).toHaveLength(1);
    const [unpaid, paid] = groups[0].hits;
    expect(unpaid.action).toEqual({ label: "Öde", href: "/musteri/panel/faturalar/i1" });
    expect(paid.action).toBeUndefined();
  });
});

describe("staff search is filtered per permission", () => {
  it("result groups follow the role's permissions", () => {
    expect(staffSearchGroups("ADMIN")).toEqual(["customers", "invoices", "orders", "services", "domains", "tickets"]);
    expect(staffSearchGroups("SUPPORT")).toEqual(["customers", "services", "domains", "tickets"]);
    expect(staffSearchGroups("BILLING")).toEqual(["customers", "invoices", "orders"]);
    expect(staffSearchGroups("CUSTOMER")).toEqual([]);
    expect(staffSearchGroups(undefined)).toEqual([]);
  });

  it("SUPPORT never queries invoices or orders", async () => {
    await searchStaffRecords("SUPPORT", "ornek");
    expect(mocks.invoice).not.toHaveBeenCalled();
    expect(mocks.order).not.toHaveBeenCalled();
    expect(mocks.supportTicket).toHaveBeenCalled();
  });

  it("BILLING never queries tickets, services or domains", async () => {
    await searchStaffRecords("BILLING", "ornek");
    expect(mocks.supportTicket).not.toHaveBeenCalled();
    expect(mocks.service).not.toHaveBeenCalled();
    expect(mocks.domain).not.toHaveBeenCalled();
    expect(mocks.invoice).toHaveBeenCalled();
  });

  it("a customer role gets nothing and runs no query", async () => {
    expect(await searchStaffRecords("CUSTOMER", "ornek")).toEqual([]);
    expect(Object.values(mocks).every((m) => m.mock.calls.length === 0)).toBe(true);
  });

  it("customer search covers name, e-mail, company and VKN (digits), only CUSTOMER rows", async () => {
    mocks.user.mockResolvedValue([
      { id: "u1", name: "Ayşe", surname: "Yılmaz", email: "ayse@example.com", companyName: "Örnek Ltd", taxNumber: "1234567890", status: "ACTIVE" },
    ]);
    const groups = await searchStaffRecords("ADMIN", "123 456");
    const where = whereOf(mocks.user) as { role: string; OR: unknown[] };
    expect(where.role).toBe("CUSTOMER");
    expect(where.OR).toEqual(expect.arrayContaining([{ taxNumber: { contains: "123456" } }, { companyName: { contains: "123 456", mode: "insensitive" } }]));
    expect(groups[0]).toMatchObject({ key: "customers", hits: [{ title: "Örnek Ltd", href: "/yonetim/musteriler/u1" }] });
    expect(groups[0].hits[0].subtitle).toContain("VKN 1234567890");
  });

  it("empty groups are dropped", async () => {
    mocks.order.mockResolvedValue([{ id: "o1", orderNumber: "S-1", domain: null, status: "PENDING", customer: null }]);
    const groups = await searchStaffRecords("ADMIN", "S-1");
    expect(groups.map((g) => g.key)).toEqual(["orders"]);
  });
});
