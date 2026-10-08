import { describe, expect, it } from "vitest";
import { calculateTax } from "./tax";
import { netInvoiceLine, netInvoiceLineFromOrder } from "./invoice-lines";

describe("net invoice lines", () => {
  it("stores the net line total after discount; the invoice adds KDV once", () => {
    const line = netInvoiceLine({ description: "Hosting", quantity: 2, unitPrice: 149, discountAmount: 29.8 });
    expect(line.totalPrice.toFixed(2)).toBe("268.20");
    expect(line.discountAmount.toFixed(2)).toBe("29.80");
    const taxed = calculateTax(line.totalPrice, 20);
    expect(taxed).toMatchObject({ subtotal: 268.2, taxAmount: 53.64, totalAmount: 321.84 });
  });

  it("rejects a discount larger than the line", () => {
    expect(() => netInvoiceLine({ description: "x", unitPrice: 10, discountAmount: 11 })).toThrow(
      "INVOICE_LINE_DISCOUNT_EXCEEDS_TOTAL"
    );
  });

  it("builds an order invoice line equal to basePrice − discount", () => {
    const line = netInvoiceLineFromOrder({ basePrice: 100, discountAmount: 10, quantity: 3 }, "Ürün");
    // 100 / 3 doesn't split into equal kuruş: billed as one line.
    expect(line).toMatchObject({ quantity: 1 });
    expect(line.unitPrice.toFixed(2)).toBe("100.00");
    expect(line.totalPrice.toFixed(2)).toBe("90.00");

    const even = netInvoiceLineFromOrder({ basePrice: 298, discountAmount: 0, quantity: 2 }, "Ürün");
    expect(even.quantity).toBe(2);
    expect(even.unitPrice.toFixed(2)).toBe("149.00");
  });
});
