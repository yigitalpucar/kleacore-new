import { formatKurus } from "./money";
import { el, escapeXml, text, type XmlChild } from "./xml";
import type { CustomerParty, EInvoiceDocument, SupplierInfo } from "./types";

export const UBL_NS = {
  invoice: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
  cac: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
  cbc: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
} as const;

/** KDV exemption code used when the rate is 0 ("351 – İstisna olmayan diğer"). */
const KDV_ZERO_EXEMPTION = { code: "351", reason: "İstisna Olmayan Diğer" };

const PAYMENT_MEANS_CODES: Record<string, string> = {
  "KREDIKARTI/BANKAKARTI": "48",
  "EFT/HAVALE": "42",
};

const amount = (name: string, kurus: number) =>
  text(name, formatKurus(kurus), { currencyID: "TRY" });

function percentString(rate: number) {
  return Number.isInteger(rate) ? String(rate) : rate.toFixed(2).replace(/0+$/, "");
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/);
  const familyName = parts.length > 1 ? parts.pop()! : parts[0] ?? "";
  return { firstName: parts.join(" ") || familyName, familyName };
}

function address(input: { street?: string; district?: string; city: string; postalZone?: string; country: string }) {
  return el(
    "cac:PostalAddress",
    null,
    text("cbc:StreetName", input.street),
    text("cbc:CitySubdivisionName", input.district || input.city),
    text("cbc:CityName", input.city),
    text("cbc:PostalZone", input.postalZone),
    el("cac:Country", null, text("cbc:Name", input.country || "Türkiye"))
  );
}

function taxScheme(taxOffice?: string) {
  if (!taxOffice) return "";
  return el("cac:PartyTaxScheme", null, el("cac:TaxScheme", null, text("cbc:Name", taxOffice)));
}

function contact(phone?: string, email?: string) {
  if (!phone && !email) return "";
  return el("cac:Contact", null, text("cbc:Telephone", phone), text("cbc:ElectronicMail", email));
}

function supplierParty(supplier: SupplierInfo) {
  const isPerson = supplier.vkn.length === 11;
  const person = isPerson ? splitName(supplier.name) : null;
  return el(
    "cac:AccountingSupplierParty",
    null,
    el(
      "cac:Party",
      null,
      text("cbc:WebsiteURI", supplier.website),
      el("cac:PartyIdentification", null, text("cbc:ID", supplier.vkn, { schemeID: isPerson ? "TCKN" : "VKN" })),
      supplier.mersisNo
        ? el("cac:PartyIdentification", null, text("cbc:ID", supplier.mersisNo, { schemeID: "MERSISNO" }))
        : "",
      supplier.tradeRegistryNo
        ? el("cac:PartyIdentification", null, text("cbc:ID", supplier.tradeRegistryNo, { schemeID: "TICARETSICILNO" }))
        : "",
      el("cac:PartyName", null, text("cbc:Name", supplier.name)),
      address(supplier),
      taxScheme(supplier.taxOffice),
      contact(supplier.phone, supplier.email),
      person
        ? el("cac:Person", null, text("cbc:FirstName", person.firstName), text("cbc:FamilyName", person.familyName))
        : ""
    )
  );
}

function customerParty(customer: CustomerParty) {
  const isPerson = customer.scheme === "TCKN";
  return el(
    "cac:AccountingCustomerParty",
    null,
    el(
      "cac:Party",
      null,
      el("cac:PartyIdentification", null, text("cbc:ID", customer.identifier, { schemeID: customer.scheme })),
      isPerson ? "" : el("cac:PartyName", null, text("cbc:Name", customer.name)),
      address(customer),
      taxScheme(customer.taxOffice),
      contact(customer.phone, customer.email),
      isPerson
        ? el(
            "cac:Person",
            null,
            text("cbc:FirstName", customer.firstName),
            text("cbc:FamilyName", customer.familyName)
          )
        : ""
    )
  );
}

function taxSubtotal(taxableKurus: number, taxKurus: number, rate: number) {
  return el(
    "cac:TaxSubtotal",
    null,
    amount("cbc:TaxableAmount", taxableKurus),
    amount("cbc:TaxAmount", taxKurus),
    text("cbc:CalculationSequenceNumeric", "1"),
    text("cbc:Percent", percentString(rate)),
    el(
      "cac:TaxCategory",
      null,
      rate === 0 ? text("cbc:TaxExemptionReasonCode", KDV_ZERO_EXEMPTION.code) : "",
      rate === 0 ? text("cbc:TaxExemptionReason", KDV_ZERO_EXEMPTION.reason) : "",
      el("cac:TaxScheme", null, text("cbc:Name", "KDV"), text("cbc:TaxTypeCode", "0015"))
    )
  );
}

function signature(supplier: SupplierInfo) {
  const scheme = supplier.vkn.length === 11 ? "TCKN" : "VKN";
  return el(
    "cac:Signature",
    null,
    text("cbc:ID", supplier.vkn, { schemeID: "VKN_TCKN" }),
    el(
      "cac:SignatoryParty",
      null,
      el("cac:PartyIdentification", null, text("cbc:ID", supplier.vkn, { schemeID: scheme })),
      address(supplier)
    ),
    el("cac:DigitalSignatureAttachment", null, el("cac:ExternalReference", null, text("cbc:URI", "#Signature")))
  );
}

export interface UblXmlOptions {
  /** Root element name; the SOAP wrapper needs an unprefixed `Invoice`. */
  rootName?: string;
  /** Extra root attributes (e.g. a default namespace). */
  rootAttrs?: Record<string, string>;
  /** Document number to put in cbc:ID (defaults to the document's own). */
  id?: string;
}

/** UBL-TR 1.2 Invoice XML for a computed e-invoice document. */
export function buildUblInvoiceXml(doc: EInvoiceDocument, options: UblXmlOptions = {}): string {
  const rootName = options.rootName ?? "Invoice";
  const rootAttrs = options.rootAttrs ?? { xmlns: UBL_NS.invoice };
  const id = options.id ?? doc.number;

  const children: XmlChild[] = [
    text("cbc:UBLVersionID", "2.1"),
    text("cbc:CustomizationID", "TR1.2"),
    text("cbc:ProfileID", doc.profile),
    // Always present: an empty ID lets the entegratör assign the next number.
    `<cbc:ID>${escapeXml(id)}</cbc:ID>`,
    text("cbc:CopyIndicator", "false"),
    text("cbc:UUID", doc.uuid),
    text("cbc:IssueDate", doc.issueDate),
    text("cbc:IssueTime", doc.issueTime),
    text("cbc:InvoiceTypeCode", "SATIS"),
    doc.notes.map((note) => text("cbc:Note", note)),
    text("cbc:DocumentCurrencyCode", doc.currency),
    text("cbc:LineCountNumeric", doc.lines.length),
    doc.type === "e-arsiv"
      ? el(
          "cac:AdditionalDocumentReference",
          null,
          text("cbc:ID", "ELEKTRONIK"),
          text("cbc:IssueDate", doc.issueDate),
          text("cbc:DocumentTypeCode", "SEND_TYPE")
        )
      : "",
    signature(doc.supplier),
    supplierParty(doc.supplier),
    customerParty(doc.customer),
    doc.internetSale
      ? el(
          "cac:PaymentMeans",
          null,
          text("cbc:PaymentMeansCode", PAYMENT_MEANS_CODES[doc.internetSale.paymentType] ?? "1"),
          text("cbc:PaymentDueDate", doc.issueDate)
        )
      : "",
    el(
      "cac:TaxTotal",
      null,
      amount("cbc:TaxAmount", doc.totals.taxKurus),
      taxSubtotal(doc.totals.taxExclusiveKurus, doc.totals.taxKurus, doc.taxPercent)
    ),
    el(
      "cac:LegalMonetaryTotal",
      null,
      amount("cbc:LineExtensionAmount", doc.totals.lineExtensionKurus),
      amount("cbc:TaxExclusiveAmount", doc.totals.taxExclusiveKurus),
      amount("cbc:TaxInclusiveAmount", doc.totals.taxInclusiveKurus),
      amount("cbc:AllowanceTotalAmount", 0),
      amount("cbc:PayableAmount", doc.totals.payableKurus)
    ),
    doc.lines.map((line) =>
      el(
        "cac:InvoiceLine",
        null,
        text("cbc:ID", line.id),
        text("cbc:InvoicedQuantity", line.quantity, { unitCode: "C62" }),
        amount("cbc:LineExtensionAmount", line.netKurus),
        el(
          "cac:TaxTotal",
          null,
          amount("cbc:TaxAmount", line.taxKurus),
          taxSubtotal(line.netKurus, line.taxKurus, line.taxPercent)
        ),
        el("cac:Item", null, text("cbc:Name", line.name)),
        el("cac:Price", null, text("cbc:PriceAmount", line.unitPrice, { currencyID: "TRY" }))
      )
    ),
  ];

  return el(
    rootName,
    { ...rootAttrs, "xmlns:cac": UBL_NS.cac, "xmlns:cbc": UBL_NS.cbc },
    ...children
  );
}
