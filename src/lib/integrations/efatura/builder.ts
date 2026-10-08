import { randomUUID } from "crypto";
import { allocateKurus, formatKurus, taxOf, toKurus, unitPriceString } from "./money";
import { amountInWordsTry } from "./words";
import type {
  CustomerParty,
  EFaturaProfile,
  EInvoiceDocument,
  EInvoiceLine,
  EInvoiceType,
  InternetSaleInfo,
  InvoiceForEInvoice,
  SupplierInfo,
} from "./types";

/** GİB's placeholder TCKN for end consumers who gave no identity number. */
export const ANONYMOUS_TCKN = "11111111111";

const TIME_ZONE = "Europe/Istanbul";

export class EInvoiceBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EInvoiceBuildError";
  }
}

/** Date + time parts in Türkiye local time (UBL IssueDate / IssueTime). */
export function istanbulDateTime(date: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  );

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}:${parts.second}`,
  };
}

/** Classify a stored tax number: 10 digits → VKN, 11 digits → TCKN, else none. */
export function classifyTaxNumber(raw: string | null | undefined): { scheme: "VKN" | "TCKN"; id: string } | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 10) return { scheme: "VKN", id: digits };
  if (digits.length === 11 && digits !== ANONYMOUS_TCKN) return { scheme: "TCKN", id: digits };
  return null;
}

export function buildCustomerParty(invoice: InvoiceForEInvoice): CustomerParty {
  const customer = invoice.customer;
  const tax = classifyTaxNumber(customer.taxNumber);
  const fullName = `${customer.name} ${customer.surname}`.trim();
  const base = {
    taxOffice: customer.taxOffice?.trim() || undefined,
    street: customer.address?.trim() || undefined,
    // KLEACORE doesn't collect the ilçe; GİB requires CitySubdivisionName.
    district: "Merkez",
    city: customer.city?.trim() || "İstanbul",
    country: customer.country?.trim() || "Türkiye",
    email: customer.email || undefined,
    phone: customer.phone || undefined,
  };

  if (tax?.scheme === "VKN") {
    return {
      ...base,
      scheme: "VKN",
      identifier: tax.id,
      name: customer.companyName?.trim() || fullName,
    };
  }

  return {
    ...base,
    scheme: "TCKN",
    identifier: tax?.id ?? ANONYMOUS_TCKN,
    name: fullName,
    firstName: customer.name.trim() || fullName,
    familyName: customer.surname.trim() || customer.name.trim(),
  };
}

const PAYMENT_TYPES: Record<string, string> = {
  CREDIT_CARD: "KREDIKARTI/BANKAKARTI",
  BANK_TRANSFER: "EFT/HAVALE",
  BALANCE: "DIGER",
};

function resolveInternetSale(invoice: InvoiceForEInvoice, website: string, now: Date): InternetSaleInfo {
  const payment =
    invoice.payments?.find((p) => p.status === "COMPLETED") ?? invoice.payments?.[0];
  return {
    website,
    paymentType: PAYMENT_TYPES[payment?.method ?? ""] ?? "DIGER",
    paymentDate: payment?.paidAt ?? invoice.paidAt ?? now,
  };
}

/**
 * Lines whose net/tax amounts sum exactly to the invoice header.
 *
 * Item `totalPrice` is gross in some flows (checkout, renewals) and net in
 * others (admin invoices), so it is only used as the allocation weight: the
 * invoice's own subtotal and tax are authoritative and get distributed over
 * the items with largest-remainder rounding.
 */
function buildLines(invoice: InvoiceForEInvoice, subtotal: number, tax: number, rate: number): EInvoiceLine[] {
  const items = invoice.items.length
    ? invoice.items
    : [
        {
          id: "invoice",
          description: `Fatura ${invoice.invoiceNumber}`,
          quantity: 1,
          unitPrice: 0,
          totalPrice: 0,
        },
      ];

  const weights = items.map((item) => Math.abs(toKurus(item.totalPrice)));
  const nets = allocateKurus(subtotal, weights);
  const taxes = allocateKurus(tax, nets);

  return items.map((item, index) => {
    const quantity = Math.max(1, Math.trunc(item.quantity) || 1);
    return {
      id: String(index + 1),
      name: item.description.trim() || `Hizmet ${index + 1}`,
      quantity,
      unitPrice: unitPriceString(nets[index], quantity),
      netKurus: nets[index],
      taxPercent: rate,
      taxKurus: taxes[index],
    };
  });
}

export interface BuildEInvoiceOptions {
  supplier: SupplierInfo;
  type: EInvoiceType;
  /** e-Fatura profile; ignored for e-Arşiv. */
  profile?: EFaturaProfile;
  customerAlias?: string;
  uuid?: string;
  seriesPrefix?: string;
  now?: Date;
}

export function buildEInvoiceDocument(
  invoice: InvoiceForEInvoice,
  options: BuildEInvoiceOptions
): EInvoiceDocument {
  const subtotal = toKurus(invoice.subtotal);
  const tax = toKurus(invoice.taxAmount);
  const total = toKurus(invoice.totalAmount);
  const rate = Number(invoice.taxRate.toString());

  if (subtotal <= 0) {
    throw new EInvoiceBuildError("EFATURA_EMPTY_INVOICE: fatura tutarı sıfır");
  }
  if (subtotal + tax !== total) {
    throw new EInvoiceBuildError(
      `EFATURA_TOTALS_MISMATCH: ara toplam ${formatKurus(subtotal)} + KDV ${formatKurus(tax)} ≠ toplam ${formatKurus(total)}`
    );
  }
  // KDV must be the rate applied to the subtotal (±1 kuruş per line for rounding).
  if (Math.abs(taxOf(subtotal, rate) - tax) > Math.max(1, invoice.items.length)) {
    throw new EInvoiceBuildError(
      `EFATURA_TAX_MISMATCH: %${rate} KDV ${formatKurus(taxOf(subtotal, rate))} olmalı, faturada ${formatKurus(tax)}`
    );
  }

  const customer = buildCustomerParty(invoice);
  const type = options.type;
  if (type === "e-fatura" && customer.identifier === ANONYMOUS_TCKN) {
    throw new EInvoiceBuildError("EFATURA_CUSTOMER_ID_REQUIRED: e-Fatura için VKN/TCKN gerekli");
  }

  const now = options.now ?? new Date();
  const issued = istanbulDateTime(now);
  const lines = buildLines(invoice, subtotal, tax, rate);

  const notes = [
    `KLEACORE fatura no: ${invoice.invoiceNumber}`,
    `Yalnız: ${amountInWordsTry(total)}`,
  ];
  if (type === "e-arsiv") {
    notes.push("Bu satış internet üzerinden yapılmıştır.");
  }

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    customerId: invoice.customerId,
    type,
    profile: type === "e-arsiv" ? "EARSIVFATURA" : (options.profile ?? "TEMELFATURA"),
    uuid: options.uuid ?? randomUUID(),
    number: "",
    seriesPrefix: options.seriesPrefix ?? "",
    issueDate: issued.date,
    issueTime: issued.time,
    currency: "TRY",
    supplier: options.supplier,
    customer,
    customerAlias: type === "e-fatura" ? options.customerAlias : undefined,
    lines,
    taxPercent: rate,
    totals: {
      lineExtensionKurus: subtotal,
      taxExclusiveKurus: subtotal,
      taxKurus: tax,
      taxInclusiveKurus: total,
      payableKurus: total,
    },
    notes,
    internetSale:
      type === "e-arsiv" ? resolveInternetSale(invoice, options.supplier.website, now) : undefined,
    notificationEmail: invoice.customer.email || undefined,
  };
}
