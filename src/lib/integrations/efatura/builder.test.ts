import { describe, expect, it } from "vitest";
import { buildUblTrDraft } from "./builder";
import type { InvoiceForEInvoice } from "./types";

const baseInvoice: InvoiceForEInvoice = {
  id: "inv_1",
  invoiceNumber: "F-2026-0001",
  customerId: "cust_1",
  subtotal: 100,
  taxRate: 20,
  taxAmount: 20,
  totalAmount: 120,
  issuedAt: new Date("2026-06-17T10:00:00.000Z"),
  paidAt: new Date("2026-06-17T12:30:00.000Z"),
  items: [
    {
      id: "item_1",
      description: "Web Hosting - Yıllık",
      quantity: 1,
      unitPrice: 100,
      totalPrice: 100,
    },
  ],
  customer: {
    name: "Ali",
    surname: "Yılmaz",
    email: "ali@example.com",
    phone: "05321112233",
    customerType: "INDIVIDUAL",
    companyName: null,
    taxNumber: null,
    taxOffice: null,
    address: "Atatürk Cad. No:1",
    city: "İstanbul",
    country: "Türkiye",
  },
};

describe("buildUblTrDraft", () => {
  it("builds UBL-TR draft for e-arsiv individual customers", () => {
    const draft = buildUblTrDraft(baseInvoice, "1234567890");

    expect(draft.type).toBe("e-arsiv");
    expect(draft.invoiceId).toBe("inv_1");
    expect(draft.invoiceNumber).toBe("F-2026-0001");
    expect(draft.ubl.ublVersion).toBe("2.1");
    expect(draft.ubl.customizationId).toBe("TR1.2");
    expect(draft.ubl.profileId).toBe("EARSIVFATURA");
    expect(draft.ubl.id).toBe("F-2026-0001");
    expect(draft.ubl.documentCurrencyCode).toBe("TRY");
    expect(draft.ubl.invoiceTypeCode).toBe("SATIS");
    expect(draft.ubl.issueDate).toBe("2026-06-17");
    expect(draft.ubl.supplier.taxNumber).toBe("1234567890");
    expect(draft.ubl.customer.partyName).toBe("Ali Yılmaz");
    expect(draft.ubl.customer.taxScheme).toBe("TCKN");
    expect(draft.ubl.legalMonetaryTotal.payableAmount).toBe(120);
    expect(draft.ubl.taxTotal.taxAmount).toBe(20);
    expect(draft.ubl.invoiceLines).toHaveLength(1);
    expect(draft.ubl.invoiceLines[0]).toMatchObject({
      id: "1",
      description: "Web Hosting - Yıllık",
      quantity: 1,
      unitPrice: 100,
      lineExtensionAmount: 100,
      taxPercent: 20,
      taxAmount: 20,
    });
  });

  it("builds UBL-TR draft for e-fatura corporate customers", () => {
    const corporateInvoice: InvoiceForEInvoice = {
      ...baseInvoice,
      customer: {
        ...baseInvoice.customer,
        customerType: "CORPORATE",
        companyName: "Acme Teknoloji A.Ş.",
        taxNumber: "9876543210",
        taxOffice: "Kadıköy",
      },
    };

    const draft = buildUblTrDraft(corporateInvoice, "1234567890");

    expect(draft.type).toBe("e-fatura");
    expect(draft.ubl.profileId).toBe("TICARIFATURA");
    expect(draft.ubl.customer.partyName).toBe("Acme Teknoloji A.Ş.");
    expect(draft.ubl.customer.taxScheme).toBe("VKN");
    expect(draft.ubl.customer.taxNumber).toBe("9876543210");
    expect(draft.ubl.customer.taxOffice).toBe("Kadıköy");
  });

  it("generates a stable UBL structure with uuid and monetary totals", () => {
    const draft = buildUblTrDraft(baseInvoice, "1234567890");

    expect(draft.ubl.uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(draft.ubl.legalMonetaryTotal).toEqual({
      lineExtensionAmount: 100,
      taxExclusiveAmount: 100,
      taxInclusiveAmount: 120,
      payableAmount: 120,
    });
    expect(draft.ubl.taxTotal.taxSubtotal).toEqual({
      taxableAmount: 100,
      taxAmount: 20,
      percent: 20,
      taxCategory: "KDV",
    });
  });
});