import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  renewalFindUnique: vi.fn(),
  tldFindMany: vi.fn(),
  domainFindMany: vi.fn(),
  invoiceCreate: vi.fn(),
  renewalCreate: vi.fn(),
  renewalUpdate: vi.fn(),
  eventCreate: vi.fn(),
  generateInvoiceNumber: vi.fn(),
  emitEvent: vi.fn(),
  invoiceFindUnique: vi.fn(),
  getSettingMap: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const tx = {
    invoice: { create: mocks.invoiceCreate },
    domainRenewal: { create: mocks.renewalCreate, update: mocks.renewalUpdate },
    domainLifecycleEvent: { create: mocks.eventCreate },
  };
  return {
    db: {
      domainRenewal: { findUnique: mocks.renewalFindUnique },
      domainTld: { findMany: mocks.tldFindMany },
      invoice: { findUnique: mocks.invoiceFindUnique },
      domain: { findMany: mocks.domainFindMany },
      domainLifecycleEvent: { create: mocks.eventCreate },
      $transaction: (fn: (client: typeof tx) => unknown) => fn(tx),
    },
  };
});
vi.mock("@/lib/billing/tax", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/billing/tax")>()),
  getTaxRate: vi.fn().mockResolvedValue(20),
}));
vi.mock("@/lib/utils/number-generators", () => ({ generateInvoiceNumber: mocks.generateInvoiceNumber }));
vi.mock("@/lib/events/emit", () => ({ emitEvent: mocks.emitEvent }));
vi.mock("@/lib/integrations/settings", () => ({ getSettingMap: mocks.getSettingMap }));

import {
  classifyExistingRenewal,
  createDomainRenewalInvoice,
  generateDomainRenewalInvoices,
} from "./renewal-invoices";

const DAY = 86_400_000;
const now = new Date("2026-10-08T09:00:00Z");
const domain = {
  id: "dom-1",
  name: "ornek.com",
  customerId: "cust-1",
  expiresAt: new Date(now.getTime() + 30 * DAY),
};
const tlds = [
  { ext: ".com", transferPrice: 199, renewPrice: "199.00" },
  { ext: ".com.tr", transferPrice: 99, renewPrice: "120.00" },
];

function renewalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "ren-1",
    domainId: domain.id,
    invoiceId: "inv-1",
    periodStart: domain.expiresAt,
    years: 1,
    status: "PENDING",
    source: "cron",
    attempts: 0,
    lastError: null,
    newExpiresAt: null,
    renewedAt: null,
    createdAt: now,
    updatedAt: now,
    invoice: { id: "inv-1", status: "PENDING" },
    ...overrides,
  } as Parameters<typeof classifyExistingRenewal>[0];
}

beforeEach(() => {
  mocks.getSettingMap.mockResolvedValue({});
  mocks.tldFindMany.mockResolvedValue(tlds);
  mocks.generateInvoiceNumber.mockResolvedValue("F-2026-000123");
  mocks.invoiceCreate.mockResolvedValue({ id: "inv-new", invoiceNumber: "F-2026-000123" });
  mocks.renewalCreate.mockResolvedValue({ id: "ren-new" });
  mocks.renewalUpdate.mockResolvedValue({ id: "ren-1" });
  mocks.eventCreate.mockResolvedValue({});
});

describe("classifyExistingRenewal", () => {
  it("returns the open invoice of the period instead of issuing a second one", () => {
    expect(classifyExistingRenewal(renewalRow(), false)).toEqual({
      status: "existing",
      invoiceId: "inv-1",
      renewalId: "ren-1",
    });
    expect(classifyExistingRenewal(renewalRow({ invoice: { id: "inv-1", status: "OVERDUE" } }), true)).toMatchObject({
      status: "existing",
    });
  });

  it("never reissues a paid or failed renewal", () => {
    for (const status of ["PAID", "PROCESSING", "COMPLETED"]) {
      expect(classifyExistingRenewal(renewalRow({ status }), true)).toMatchObject({
        status: "skipped",
        reason: "RENEWAL_IN_PROGRESS",
      });
    }
    expect(classifyExistingRenewal(renewalRow({ status: "FAILED" }), true)).toMatchObject({ reason: "RENEWAL_FAILED" });
  });

  it("reopens a cancelled invoice only when asked (customer), never from the cron", () => {
    const cancelled = renewalRow({ invoice: { id: "inv-1", status: "CANCELLED" } });
    expect(classifyExistingRenewal(cancelled, false)).toMatchObject({ status: "skipped", reason: "INVOICE_CANCELLED" });
    expect(classifyExistingRenewal(cancelled, true)).toBe("reopen");
  });
});

describe("createDomainRenewalInvoice", () => {
  it("bills the TLD renew price + KDV with a linked renewal row for the period", async () => {
    mocks.renewalFindUnique.mockResolvedValue(null);

    const result = await createDomainRenewalInvoice(domain, { source: "cron", now });

    expect(result).toEqual({ status: "created", invoiceId: "inv-new", renewalId: "ren-new" });
    const invoice = mocks.invoiceCreate.mock.calls[0][0].data;
    expect(invoice).toMatchObject({
      customerId: "cust-1",
      subtotal: 199,
      taxRate: 20,
      taxAmount: 39.8,
      totalAmount: 238.8,
      status: "PENDING",
      dueDate: domain.expiresAt,
    });
    expect(invoice.orderId).toBeUndefined();
    // Net (KDV-exclusive) line through netInvoiceLine: Σ totalPrice = subtotal.
    const line = invoice.items.create;
    expect(line).toMatchObject({ description: "ornek.com alan adı yenileme (1 yıl)", quantity: 1 });
    expect(line.unitPrice.toString()).toBe("199");
    expect(line.discountAmount.toString()).toBe("0");
    expect(line.totalPrice.toString()).toBe(String(invoice.subtotal));
    expect(mocks.renewalCreate).toHaveBeenCalledWith({
      data: {
        domainId: "dom-1",
        invoiceId: "inv-new",
        periodStart: domain.expiresAt,
        years: 1,
        source: "cron",
      },
    });
  });

  it("uses the longest matching TLD (.com.tr before .tr / .com)", async () => {
    mocks.renewalFindUnique.mockResolvedValue(null);

    await createDomainRenewalInvoice({ ...domain, name: "ornek.com.tr" }, { source: "cron", now });

    expect(mocks.invoiceCreate.mock.calls[0][0].data).toMatchObject({ subtotal: 120, totalAmount: 144 });
  });

  it("is idempotent: an existing open renewal invoice is returned, nothing is created", async () => {
    mocks.renewalFindUnique.mockResolvedValue(renewalRow());

    const result = await createDomainRenewalInvoice(domain, { source: "cron", now });

    expect(result).toEqual({ status: "existing", invoiceId: "inv-1", renewalId: "ren-1" });
    expect(mocks.generateInvoiceNumber).not.toHaveBeenCalled();
    expect(mocks.invoiceCreate).not.toHaveBeenCalled();
  });

  it("a concurrent insert of the same period (unique violation) rolls back and reports the winner", async () => {
    mocks.renewalFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(renewalRow({ invoiceId: "inv-9", invoice: { id: "inv-9", status: "PENDING" } }));
    mocks.renewalCreate.mockRejectedValue(Object.assign(new Error("Unique constraint"), { code: "P2002" }));

    const result = await createDomainRenewalInvoice(domain, { source: "customer", now });

    expect(result).toEqual({ status: "existing", invoiceId: "inv-9", renewalId: "ren-1" });
  });

  it("skips TLDs without a renew price", async () => {
    mocks.renewalFindUnique.mockResolvedValue(null);

    const result = await createDomainRenewalInvoice({ ...domain, name: "ornek.xyz" }, { source: "cron", now });

    expect(result).toEqual({ status: "skipped", reason: "NO_TLD_PRICE" });
    expect(mocks.invoiceCreate).not.toHaveBeenCalled();
  });

  it("reissues a cancelled period on customer request by re-pointing the same renewal row", async () => {
    mocks.renewalFindUnique.mockResolvedValue(renewalRow({ invoice: { id: "inv-1", status: "CANCELLED" } }));

    const result = await createDomainRenewalInvoice(domain, { source: "customer", reopenCancelled: true, now });

    expect(result).toMatchObject({ status: "created", invoiceId: "inv-new" });
    expect(mocks.renewalCreate).not.toHaveBeenCalled();
    expect(mocks.renewalUpdate).toHaveBeenCalledWith({
      where: { id: "ren-1" },
      data: expect.objectContaining({ invoiceId: "inv-new", status: "PENDING", source: "customer" }),
    });
  });
});

describe("generateDomainRenewalInvoices", () => {
  it("only scans ACTIVE auto-renewing domains inside the configured window", async () => {
    mocks.getSettingMap.mockResolvedValue({ domain_renewal_invoice_days: "45" });
    mocks.domainFindMany.mockResolvedValue([]);

    const result = await generateDomainRenewalInvoices(now);

    expect(result).toMatchObject({ processed: 0, windowDays: 45 });
    expect(mocks.domainFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "ACTIVE",
          autoRenew: true,
          expiresAt: { lte: new Date(now.getTime() + 45 * DAY), gte: new Date(now.getTime() - 30 * DAY) },
        },
      })
    );
  });

  it("creates one invoice per domain and notifies the customer; a second run creates none", async () => {
    mocks.invoiceFindUnique.mockResolvedValue({
      id: "inv-new",
      invoiceNumber: "F-2026-000900",
      totalAmount: 238.8,
      dueDate: domain.expiresAt,
    });
    mocks.domainFindMany.mockResolvedValue([domain]);
    mocks.renewalFindUnique.mockResolvedValueOnce(null);

    const first = await generateDomainRenewalInvoices(now);
    expect(first).toMatchObject({ processed: 1, ids: ["inv-new"] });
    // invoice.created in the creating transaction; the notifications
    // subscriber uses the sweep's dedupe key, so it is announced once.
    expect(mocks.emitEvent).toHaveBeenCalledWith(
      expect.anything(),
      "invoice.created",
      expect.objectContaining({ customerId: "cust-1", source: "domain_renewal", notify: true }),
      expect.anything()
    );

    mocks.renewalFindUnique.mockResolvedValue(renewalRow({ invoiceId: "inv-new", invoice: { id: "inv-new", status: "PENDING" } }));
    const second = await generateDomainRenewalInvoices(now);
    expect(second).toMatchObject({ processed: 0, existing: 1 });
    expect(mocks.invoiceCreate).toHaveBeenCalledTimes(1);
  });
});
