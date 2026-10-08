import { describe, expect, it } from "vitest";
import { ANONYMOUS_TCKN, EInvoiceBuildError, buildEInvoiceDocument, classifyTaxNumber, istanbulDateTime } from "./builder";
import { allocateKurus, formatKurus, taxOf, toKurus, unitPriceString } from "./money";
import { buildUblInvoiceXml } from "./ubl";
import { amountInWordsTry } from "./words";
import type { InvoiceForEInvoice, SupplierInfo } from "./types";

const supplier: SupplierInfo = {
  name: "KLEAWORK Dijital A.Ş.",
  vkn: "1234567890",
  taxOffice: "Kadıköy",
  street: "Bağdat Cad. No:1",
  district: "Kadıköy",
  city: "İstanbul",
  postalZone: "34710",
  country: "Türkiye",
  phone: "+90 850 000 00 00",
  email: "info@kleacore.com",
  website: "https://kleacore.com",
};

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
    { id: "item_1", description: "Web Hosting - Yıllık", quantity: 1, unitPrice: 100, totalPrice: 100 },
  ],
  payments: [{ method: "CREDIT_CARD", status: "COMPLETED", paidAt: new Date("2026-06-17T12:30:00.000Z") }],
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

const now = new Date("2026-06-17T21:30:00.000Z"); // 00:30 next day in Istanbul

describe("money helpers", () => {
  it("converts boundary values to kuruş without float drift", () => {
    expect(toKurus(1.005)).toBe(101);
    expect(toKurus(0.1 + 0.2)).toBe(30);
    expect(toKurus("199.995")).toBe(20000);
    expect(toKurus({ toString: () => "12.34" })).toBe(1234);
    expect(toKurus(-2.5)).toBe(-250);
    expect(() => toKurus("abc")).toThrow("EFATURA_INVALID_AMOUNT");
  });

  it("formats, taxes and allocates exactly", () => {
    expect(formatKurus(5)).toBe("0.05");
    expect(formatKurus(123456)).toBe("1234.56");
    expect(taxOf(3333, 20)).toBe(667);
    expect(taxOf(1000, 18.5)).toBe(185);
    const parts = allocateKurus(1000, [1, 1, 1]);
    expect(parts).toEqual([334, 333, 333]);
    expect(allocateKurus(7, [0, 0])).toEqual([4, 3]);
    expect(unitPriceString(1000, 3)).toBe("3.33333333");
    expect(unitPriceString(1000, 4)).toBe("2.50");
  });

  it("writes amounts in Turkish words", () => {
    expect(amountInWordsTry(12000)).toBe("Yüz Yirmi Türk Lirası");
    expect(amountInWordsTry(100150)).toBe("Bin Bir Türk Lirası Elli Kuruş");
    expect(amountInWordsTry(2_345_678_09)).toBe("İki Milyon Üç Yüz Kırk Beş Bin Altı Yüz Yetmiş Sekiz Türk Lirası Dokuz Kuruş");
  });
});

describe("classifyTaxNumber", () => {
  it("tells VKN from TCKN by length and ignores junk", () => {
    expect(classifyTaxNumber("123 456 7890")).toEqual({ scheme: "VKN", id: "1234567890" });
    expect(classifyTaxNumber("12345678901")).toEqual({ scheme: "TCKN", id: "12345678901" });
    expect(classifyTaxNumber(ANONYMOUS_TCKN)).toBeNull();
    expect(classifyTaxNumber("12")).toBeNull();
    expect(classifyTaxNumber(null)).toBeNull();
  });
});

describe("buildEInvoiceDocument", () => {
  it("builds an e-Arşiv for an individual without TCKN using the anonymous TCKN", () => {
    const doc = buildEInvoiceDocument(baseInvoice, { supplier, type: "e-arsiv", uuid: "u-1", now });

    expect(doc.type).toBe("e-arsiv");
    expect(doc.profile).toBe("EARSIVFATURA");
    expect(doc.uuid).toBe("u-1");
    expect(doc.customer).toMatchObject({
      scheme: "TCKN",
      identifier: ANONYMOUS_TCKN,
      firstName: "Ali",
      familyName: "Yılmaz",
    });
    // Istanbul local date, not UTC.
    expect(doc.issueDate).toBe("2026-06-18");
    expect(doc.issueTime).toBe("00:30:00");
    expect(doc.internetSale).toMatchObject({
      website: "https://kleacore.com",
      paymentType: "KREDIKARTI/BANKAKARTI",
    });
    expect(doc.notes).toContain("Yalnız: Yüz Yirmi Türk Lirası");
  });

  it("builds an e-Fatura for a VKN customer with the chosen profile and alias", () => {
    const doc = buildEInvoiceDocument(
      {
        ...baseInvoice,
        customer: {
          ...baseInvoice.customer,
          customerType: "CORPORATE",
          companyName: "Acme Teknoloji A.Ş.",
          taxNumber: "9876543210",
          taxOffice: "Kadıköy",
        },
      },
      { supplier, type: "e-fatura", profile: "TICARIFATURA", customerAlias: "urn:mail:defaultpk@acme.com", now }
    );

    expect(doc.profile).toBe("TICARIFATURA");
    expect(doc.customer).toMatchObject({ scheme: "VKN", identifier: "9876543210", name: "Acme Teknoloji A.Ş." });
    expect(doc.customerAlias).toBe("urn:mail:defaultpk@acme.com");
    expect(doc.internetSale).toBeUndefined();
  });

  it("uses an 11-digit tax number as TCKN", () => {
    const doc = buildEInvoiceDocument(
      { ...baseInvoice, customer: { ...baseInvoice.customer, taxNumber: "12345678901" } },
      { supplier, type: "e-arsiv", now }
    );
    expect(doc.customer.scheme).toBe("TCKN");
    expect(doc.customer.identifier).toBe("12345678901");
  });

  it("refuses an e-Fatura without a real VKN/TCKN", () => {
    expect(() => buildEInvoiceDocument(baseInvoice, { supplier, type: "e-fatura", now })).toThrow(
      "EFATURA_CUSTOMER_ID_REQUIRED"
    );
  });

  it("uses the net line totals and spreads the invoice KDV over them to the kuruş", () => {
    const invoice: InvoiceForEInvoice = {
      ...baseInvoice,
      subtotal: 100,
      taxAmount: 20,
      totalAmount: 120,
      items: [
        { id: "a", description: "A", quantity: 1, unitPrice: 33.34, totalPrice: 33.34 },
        { id: "b", description: "B", quantity: 3, unitPrice: 11.11, totalPrice: 33.33 },
        { id: "c", description: "C", quantity: 1, unitPrice: 33.33, totalPrice: 33.33 },
      ],
    };
    const doc = buildEInvoiceDocument(invoice, { supplier, type: "e-arsiv", now });

    const net = doc.lines.reduce((sum, line) => sum + line.netKurus, 0);
    const tax = doc.lines.reduce((sum, line) => sum + line.taxKurus, 0);
    expect(net).toBe(10000);
    expect(tax).toBe(2000);
    expect(doc.lines.map((line) => line.netKurus)).toEqual([3334, 3333, 3333]);
    expect(doc.lines.map((line) => line.taxKurus)).toEqual([667, 667, 666]);
    expect(doc.lines[1].unitPrice).toBe("11.11");
    expect(doc.totals).toEqual({
      lineExtensionKurus: 10000,
      taxExclusiveKurus: 10000,
      taxKurus: 2000,
      taxInclusiveKurus: 12000,
      payableKurus: 12000,
    });
  });

  it("bills a discounted checkout line at its net total (not the KDV-inclusive amount)", () => {
    // Checkout: 149.00 net, 10% promo → 134.10 net, 26.82 KDV, 160.92 total.
    const doc = buildEInvoiceDocument(
      {
        ...baseInvoice,
        subtotal: 134.1,
        taxAmount: 26.82,
        totalAmount: 160.92,
        items: [{ id: "a", description: "emirfeto.com Domain Kaydı", quantity: 1, unitPrice: 149, totalPrice: 134.1 }],
      },
      { supplier, type: "e-arsiv", now }
    );
    expect(doc.lines[0]).toMatchObject({ netKurus: 13410, taxKurus: 2682, unitPrice: "134.10" });
    expect(doc.totals.payableKurus).toBe(16092);
  });

  it("refuses lines that don't add up to the subtotal (legacy KDV-inclusive rows)", () => {
    expect(() =>
      buildEInvoiceDocument(
        {
          ...baseInvoice,
          items: [{ id: "a", description: "A", quantity: 1, unitPrice: 100, totalPrice: 120 }],
        },
        { supplier, type: "e-arsiv", now }
      )
    ).toThrow("EFATURA_LINES_MISMATCH");
  });

  it("keeps awkward rounding (33.33 + %20) consistent with the invoice header", () => {
    const doc = buildEInvoiceDocument(
      {
        ...baseInvoice,
        subtotal: 33.33,
        taxAmount: 6.67,
        totalAmount: 40,
        items: [{ id: "a", description: "A", quantity: 1, unitPrice: 33.33, totalPrice: 33.33 }],
      },
      { supplier, type: "e-arsiv", now }
    );
    expect(doc.lines[0]).toMatchObject({ netKurus: 3333, taxKurus: 667 });
    expect(doc.totals.payableKurus).toBe(4000);
  });

  it("falls back to a single line when the invoice has no items", () => {
    const doc = buildEInvoiceDocument({ ...baseInvoice, items: [] }, { supplier, type: "e-arsiv", now });
    expect(doc.lines).toHaveLength(1);
    expect(doc.lines[0]).toMatchObject({ name: "Fatura F-2026-0001", netKurus: 10000, taxKurus: 2000 });
  });

  it("rejects headers that don't add up instead of sending a wrong document", () => {
    expect(() =>
      buildEInvoiceDocument({ ...baseInvoice, totalAmount: 121 }, { supplier, type: "e-arsiv", now })
    ).toThrow(EInvoiceBuildError);
    expect(() =>
      buildEInvoiceDocument({ ...baseInvoice, taxAmount: 18, totalAmount: 118 }, { supplier, type: "e-arsiv", now })
    ).toThrow("EFATURA_TAX_MISMATCH");
    expect(() =>
      buildEInvoiceDocument({ ...baseInvoice, subtotal: 0, taxAmount: 0, totalAmount: 0 }, { supplier, type: "e-arsiv", now })
    ).toThrow("EFATURA_EMPTY_INVOICE");
  });

  it("formats Istanbul time across DST-free offsets", () => {
    expect(istanbulDateTime(new Date("2026-01-01T00:00:00.000Z"))).toEqual({ date: "2026-01-01", time: "03:00:00" });
  });
});

describe("buildUblInvoiceXml", () => {
  it("renders UBL-TR 1.2 with totals, KDV per line, and escaped text", () => {
    const doc = buildEInvoiceDocument(
      {
        ...baseInvoice,
        items: [{ id: "x", description: "Sunucu <VDS> & yedek", quantity: 1, unitPrice: 100, totalPrice: 100 }],
      },
      { supplier, type: "e-arsiv", uuid: "11111111-2222-3333-4444-555555555555", now }
    );
    const xml = buildUblInvoiceXml(doc);

    expect(xml.startsWith('<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"')).toBe(true);
    expect(xml).toContain("<cbc:CustomizationID>TR1.2</cbc:CustomizationID>");
    expect(xml).toContain("<cbc:ProfileID>EARSIVFATURA</cbc:ProfileID>");
    expect(xml).toContain("<cbc:ID></cbc:ID>");
    expect(xml).toContain("<cbc:UUID>11111111-2222-3333-4444-555555555555</cbc:UUID>");
    expect(xml).toContain("<cbc:DocumentTypeCode>SEND_TYPE</cbc:DocumentTypeCode>");
    expect(xml).toContain('<cbc:ID schemeID="TCKN">11111111111</cbc:ID>');
    expect(xml).toContain("<cac:Person><cbc:FirstName>Ali</cbc:FirstName><cbc:FamilyName>Yılmaz</cbc:FamilyName></cac:Person>");
    expect(xml).toContain('<cbc:PayableAmount currencyID="TRY">120.00</cbc:PayableAmount>');
    expect(xml).toContain('<cbc:TaxInclusiveAmount currencyID="TRY">120.00</cbc:TaxInclusiveAmount>');
    expect(xml).toContain("<cbc:Percent>20</cbc:Percent>");
    expect(xml).toContain("<cbc:TaxTypeCode>0015</cbc:TaxTypeCode>");
    expect(xml).toContain('<cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity>');
    expect(xml).toContain("<cbc:Name>Sunucu &lt;VDS&gt; &amp; yedek</cbc:Name>");
    expect(xml).toContain('<cbc:PaymentMeansCode>48</cbc:PaymentMeansCode>');
    // Line tax subtotal is present and matches the header.
    expect(xml.match(/<cbc:TaxAmount currencyID="TRY">20.00<\/cbc:TaxAmount>/g)?.length).toBe(4);
    // Supplier party before customer party (schema order).
    expect(xml.indexOf("AccountingSupplierParty")).toBeLessThan(xml.indexOf("AccountingCustomerParty"));
  });

  it("renders a VKN customer with PartyName and tax office, no SEND_TYPE for e-Fatura", () => {
    const doc = buildEInvoiceDocument(
      {
        ...baseInvoice,
        customer: { ...baseInvoice.customer, companyName: "Acme", taxNumber: "9876543210", taxOffice: "Beşiktaş" },
      },
      { supplier, type: "e-fatura", customerAlias: "urn:mail:pk@acme.com", now }
    );
    const xml = buildUblInvoiceXml(doc, { id: "KLE2026000000001" });

    expect(xml).toContain("<cbc:ProfileID>TEMELFATURA</cbc:ProfileID>");
    expect(xml).toContain("<cbc:ID>KLE2026000000001</cbc:ID>");
    expect(xml).toContain('<cbc:ID schemeID="VKN">9876543210</cbc:ID>');
    expect(xml).toContain("<cac:PartyName><cbc:Name>Acme</cbc:Name></cac:PartyName>");
    expect(xml).toContain("<cbc:Name>Beşiktaş</cbc:Name>");
    expect(xml).not.toContain("SEND_TYPE");
  });

  it("adds a KDV exemption reason for 0% invoices", () => {
    const doc = buildEInvoiceDocument(
      { ...baseInvoice, taxRate: 0, taxAmount: 0, totalAmount: 100 },
      { supplier, type: "e-arsiv", now }
    );
    const xml = buildUblInvoiceXml(doc);
    expect(xml).toContain("<cbc:TaxExemptionReasonCode>351</cbc:TaxExemptionReasonCode>");
  });
});
