import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const checkApiPermission = vi.fn();
vi.mock("@/lib/utils/auth-helpers", () => ({ checkApiPermission: (p: string) => checkApiPermission(p) }));

const getInvoices = vi.fn();
vi.mock("@/lib/dal/invoices", () => ({ getInvoices: (...a: unknown[]) => getInvoices(...a) }));
vi.mock("@/lib/dal/services", () => ({ getServices: vi.fn() }));
vi.mock("@/lib/dal/customers", () => ({ getCustomers: vi.fn() }));
vi.mock("@/lib/dal/orders", () => ({ getOrders: vi.fn() }));
vi.mock("@/lib/dal/tickets", () => ({ getTickets: vi.fn() }));

import { GET } from "./route";

const day = (d: number) => new Date(Date.now() + d * 86_400_000);
function invoice(id: string, name: string, status: string, dueInDays: number) {
  return {
    id,
    invoiceNumber: `F-${id}`,
    status,
    subtotal: "100.00",
    taxAmount: "20.00",
    totalAmount: "120.00",
    paidAmount: "0.00",
    createdAt: day(-40),
    dueDate: day(dueInDays),
    paidAt: null,
    updatedAt: day(-1),
    items: [{ description: "Hosting" }],
    customer: { id: "c1", name, surname: "", email: "a@b.test" },
  };
}

const call = (qs: string) =>
  GET(new NextRequest(`http://localhost/api/admin/export/invoices?${qs}`), { params: Promise.resolve({ list: "invoices" }) });

beforeEach(() => {
  checkApiPermission.mockReset().mockResolvedValue({ ok: true, session: { user: { id: "s", role: "BILLING" } } });
  getInvoices.mockReset();
});

describe("GET /api/admin/export/[list]", () => {
  it("needs export.csv and the list's view permission", async () => {
    checkApiPermission.mockImplementation(async (p: string) => (p === "export.csv" ? { ok: false, status: 403 } : { ok: true }));
    expect((await call("")).status).toBe(403);

    checkApiPermission.mockImplementation(async (p: string) => (p === "invoices.view" ? { ok: false, status: 403 } : { ok: true }));
    expect((await call("")).status).toBe(403);
    expect(checkApiPermission).toHaveBeenCalledWith("invoices.view");

    checkApiPermission.mockResolvedValue({ ok: false, status: 401 });
    expect((await call("")).status).toBe(401);
    expect(getInvoices).not.toHaveBeenCalled();
  });

  it("rejects unknown scopes", async () => {
    expect((await call("scope=nope")).status).toBe(400);
  });

  it("streams every DAL page, applies the view's filters and search, and neutralises formulas", async () => {
    getInvoices
      .mockResolvedValueOnce({ data: [invoice("1", "=HYPERLINK(\"x\")", "OVERDUE", -40), invoice("2", "Acme", "OVERDUE", -3)], totalPages: 2 })
      .mockResolvedValueOnce({ data: [invoice("3", "Acme Ltd", "OVERDUE", -35)], totalPages: 2 });

    const res = await call("scope=overdue&f_severity=severe");
    expect(res.headers.get("content-type")).toContain("text/csv");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 BOM for Excel
    const lines = new TextDecoder().decode(bytes).trim().split("\r\n");

    expect(lines[0].startsWith("Fatura no;")).toBe(true);
    expect(lines).toHaveLength(3); // header + 2 severe (30+ gün) rows; "2" is mild
    expect(lines[1]).toContain(`"'=HYPERLINK(""x"")"`);
    expect(lines[2]).toContain("F-3;Acme Ltd");
    expect(lines[2]).toContain("100,00;20,00;120,00");
    expect(getInvoices).toHaveBeenCalledTimes(2);
    expect(getInvoices.mock.calls[0][0]).toMatchObject({ page: 1, status: "OVERDUE" });
  });

  it("applies the search text like the table", async () => {
    getInvoices.mockResolvedValueOnce({ data: [invoice("1", "Acme", "PENDING", 3), invoice("2", "Beta", "PENDING", 3)], totalPages: 1 });
    const lines = (await (await call("q=beta")).text()).trim().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("Beta");
  });
});
