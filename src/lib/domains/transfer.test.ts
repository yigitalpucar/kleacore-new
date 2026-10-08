import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transferDomainWithRegistrar: vi.fn(),
  tx: {
    domainTld: { findMany: vi.fn() },
    product: { findUnique: vi.fn(), findFirst: vi.fn() },
    order: { create: vi.fn() },
    invoice: { create: vi.fn() },
    payment: { create: vi.fn() },
    orderActivity: { create: vi.fn() },
  },
  orderFindFirst: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    order: { findFirst: mocks.orderFindFirst },
    $transaction: (callback: (tx: typeof mocks.tx) => unknown) => callback(mocks.tx),
  },
}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/integrations/registrar", () => ({
  transferDomainWithRegistrar: mocks.transferDomainWithRegistrar,
}));
vi.mock("@/lib/integrations/registrar/config", () => ({
  getRegistrarConfig: vi.fn(),
  isGriRegistrarEnabled: vi.fn(),
}));
vi.mock("@/lib/billing/tax", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/billing/tax")>()),
  getTaxRate: vi.fn().mockResolvedValue(20),
}));
vi.mock("@/lib/utils/number-generators", () => ({
  generateInvoiceNumber: vi.fn().mockResolvedValue("F-2026-000001"),
  generateOrderNumber: vi.fn().mockResolvedValue("S-2026-000001"),
  generateTicketNumber: vi.fn().mockReturnValue("T-100000"),
}));

import { decryptSecret } from "@/lib/secrets/crypto";
import { processAutomatedDomainTransfer } from "./transfer";

const customer = {
  id: "cus-1",
  name: "Ayşe",
  surname: "Yılmaz",
  email: "a@example.com",
  phone: null,
  address: null,
  city: null,
  country: null,
  companyName: null,
};

describe("processAutomatedDomainTransfer", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = "test-encryption-key";
    mocks.orderFindFirst.mockResolvedValue(null);
    mocks.tx.domainTld.findMany.mockResolvedValue([
      { ext: ".com.tr", transferPrice: 250, renewPrice: 300, isActive: true },
    ]);
    mocks.tx.product.findUnique.mockResolvedValue({ id: "prd-1", sku: "DOM-TR", category: { slug: "domain" } });
    mocks.tx.order.create.mockResolvedValue({ id: "ord-1", orderNumber: "S-2026-000001" });
    mocks.tx.invoice.create.mockResolvedValue({ id: "inv-1", invoiceNumber: "F-2026-000001" });
  });

  it("creates the unpaid order without contacting the registrar", async () => {
    const result = await processAutomatedDomainTransfer(customer, {
      domain: "Ornek.com.tr",
      eppCode: "EPP-123",
      email: "a@example.com",
    });

    expect(mocks.transferDomainWithRegistrar).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      success: true,
      data: { automated: true, invoiceId: "inv-1", orderNumber: "S-2026-000001" },
    });
    expect(mocks.tx.invoice.create.mock.calls[0][0].data.status).toBe("PENDING");
  });

  it("keeps the EPP code (encrypted) on the order so fulfilment can start the transfer", async () => {
    await processAutomatedDomainTransfer(customer, {
      domain: "ornek.com.tr",
      eppCode: "EPP-123",
      email: "a@example.com",
    });

    const configuration = mocks.tx.order.create.mock.calls[0][0].data.items.create.configuration;
    expect(configuration.type).toBe("domain_transfer");
    expect(configuration.eppCode).not.toBe("EPP-123");
    expect(decryptSecret(configuration.eppCode)).toBe("EPP-123");
  });

  it("stores the order line net, like the invoice line (KDV only on the order)", async () => {
    await processAutomatedDomainTransfer(customer, {
      domain: "ornek.com.tr",
      eppCode: "EPP-123",
      email: "a@example.com",
    });

    const order = mocks.tx.order.create.mock.calls[0][0].data;
    const invoice = mocks.tx.invoice.create.mock.calls[0][0].data;
    expect(String(order.items.create.totalPrice)).toBe(String(invoice.items.create.totalPrice));
    expect(String(order.items.create.totalPrice)).toBe(String(order.basePrice));
  });
});
