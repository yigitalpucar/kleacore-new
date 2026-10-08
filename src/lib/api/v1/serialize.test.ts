import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { serializeInvoiceSummary, serializeOrderSummary } from "./serialize";

const d = (value: string) => new Prisma.Decimal(value);
const date = new Date("2026-01-01T00:00:00Z");

describe("API v1 money serialization", () => {
  it("returns invoice amounts as JSON numbers, not Decimal strings", () => {
    const invoice = {
      id: "inv-1",
      invoiceNumber: "KC-1",
      customerId: "cus-1",
      orderId: null,
      status: "PAID",
      subtotal: d("100.10"),
      taxRate: d("20.00"),
      taxAmount: d("20.02"),
      totalAmount: d("120.12"),
      paidAmount: d("120.12"),
      issuedAt: date,
      dueDate: date,
      paidAt: date,
      notes: null,
      createdAt: date,
      updatedAt: date,
      items: [
        { id: "it-1", invoiceId: "inv-1", description: "Hosting", quantity: 1, unitPrice: d("100.10"), totalPrice: d("120.12") },
      ],
    } as unknown as Parameters<typeof serializeInvoiceSummary>[0];

    const json = JSON.parse(JSON.stringify(serializeInvoiceSummary(invoice)));

    expect(json).toMatchObject({
      subtotal: 100.1,
      taxRate: 20,
      taxAmount: 20.02,
      totalAmount: 120.12,
      paidAmount: 120.12,
      items: [{ unitPrice: 100.1, totalPrice: 120.12 }],
    });
  });

  it("returns order amounts as numbers", () => {
    const order = {
      id: "ord-1",
      orderNumber: "SP-1",
      status: "COMPLETED",
      billingPeriod: "monthly",
      quantity: 1,
      domain: null,
      basePrice: d("49.00"),
      discountAmount: d("0"),
      setupFee: d("0"),
      taxRate: d("20"),
      taxAmount: d("9.80"),
      totalAmount: d("58.80"),
      createdAt: date,
      updatedAt: date,
      product: { id: "p", name: "Starter", sku: "S", category: { slug: "hosting", name: "Hosting" } },
      items: [],
    } as unknown as Parameters<typeof serializeOrderSummary>[0];

    const json = JSON.parse(JSON.stringify(serializeOrderSummary(order)));
    expect(json).toMatchObject({ basePrice: 49, taxRate: 20, taxAmount: 9.8, totalAmount: 58.8 });
    expect(typeof json.totalAmount).toBe("number");
  });
});
