import { randomUUID } from "crypto";
import type {
  EInvoiceDraft,
  EInvoiceType,
  InvoiceForEInvoice,
  UblInvoice,
  UblParty,
} from "./types";

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatTime(date: Date) {
  return date.toISOString().slice(11, 19);
}

function resolveEInvoiceType(invoice: InvoiceForEInvoice): EInvoiceType {
  if (invoice.customer.customerType === "CORPORATE" && invoice.customer.taxNumber) {
    return "e-fatura";
  }
  return "e-arsiv";
}

function buildSupplierParty(companyVkn: string): UblParty {
  return {
    partyName: "KLEACORE",
    taxScheme: "VKN",
    taxNumber: companyVkn,
    address: {
      country: "Türkiye",
    },
  };
}

function buildCustomerParty(invoice: InvoiceForEInvoice): UblParty {
  const customer = invoice.customer;
  const isCorporate = customer.customerType === "CORPORATE" && Boolean(customer.taxNumber);

  return {
    partyName: isCorporate
      ? customer.companyName || `${customer.name} ${customer.surname}`.trim()
      : `${customer.name} ${customer.surname}`.trim(),
    taxScheme: isCorporate ? "VKN" : "TCKN",
    taxNumber: customer.taxNumber || "11111111111",
    taxOffice: customer.taxOffice || undefined,
    address: {
      street: customer.address || undefined,
      city: customer.city || undefined,
      country: customer.country || "Türkiye",
    },
  };
}

export function buildUblTrDraft(
  invoice: InvoiceForEInvoice,
  companyVkn: string
): EInvoiceDraft {
  const type = resolveEInvoiceType(invoice);
  const issueDate = invoice.paidAt ?? invoice.issuedAt;
  const documentUuid = randomUUID();
  const supplier = buildSupplierParty(companyVkn);
  const customer = buildCustomerParty(invoice);

  const invoiceLines = invoice.items.map((item, index) => {
    const lineExtensionAmount = roundMoney(item.totalPrice);
    const taxAmount = roundMoney(lineExtensionAmount * (invoice.taxRate / 100));

    return {
      id: String(index + 1),
      description: item.description,
      quantity: item.quantity,
      unitPrice: roundMoney(item.unitPrice),
      lineExtensionAmount,
      taxPercent: invoice.taxRate,
      taxAmount,
    };
  });

  const ubl: UblInvoice = {
    ublVersion: "2.1",
    customizationId: "TR1.2",
    profileId: type === "e-fatura" ? "TICARIFATURA" : "EARSIVFATURA",
    id: invoice.invoiceNumber,
    uuid: documentUuid,
    issueDate: formatDate(issueDate),
    issueTime: formatTime(issueDate),
    invoiceTypeCode: "SATIS",
    documentCurrencyCode: "TRY",
    supplier,
    customer,
    taxTotal: {
      taxAmount: roundMoney(invoice.taxAmount),
      taxSubtotal: {
        taxableAmount: roundMoney(invoice.subtotal),
        taxAmount: roundMoney(invoice.taxAmount),
        percent: invoice.taxRate,
        taxCategory: "KDV",
      },
    },
    legalMonetaryTotal: {
      lineExtensionAmount: roundMoney(invoice.subtotal),
      taxExclusiveAmount: roundMoney(invoice.subtotal),
      taxInclusiveAmount: roundMoney(invoice.totalAmount),
      payableAmount: roundMoney(invoice.totalAmount),
    },
    invoiceLines,
  };

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    customerId: invoice.customerId,
    type,
    ubl,
  };
}