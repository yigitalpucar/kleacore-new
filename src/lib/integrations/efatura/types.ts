import type { Prisma } from "@prisma/client";

export type EInvoiceType = "e-fatura" | "e-arsiv";

export type EInvoiceProviderName = "parasut" | "disabled";

export interface EInvoiceConfig {
  enabled: boolean;
  provider: EInvoiceProviderName;
  apiKey: string;
  companyVkn: string;
}

export interface EInvoiceDraft {
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  type: EInvoiceType;
  ubl: UblInvoice;
}

export interface UblParty {
  partyName: string;
  taxScheme: string;
  taxNumber: string;
  taxOffice?: string;
  address?: {
    street?: string;
    city?: string;
    country: string;
  };
}

export interface UblInvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineExtensionAmount: number;
  taxPercent: number;
  taxAmount: number;
}

export interface UblInvoice {
  ublVersion: "2.1";
  customizationId: "TR1.2";
  profileId: "TICARIFATURA" | "EARSIVFATURA";
  id: string;
  uuid: string;
  issueDate: string;
  issueTime: string;
  invoiceTypeCode: "SATIS";
  documentCurrencyCode: "TRY";
  supplier: UblParty;
  customer: UblParty;
  taxTotal: {
    taxAmount: number;
    taxSubtotal: {
      taxableAmount: number;
      taxAmount: number;
      percent: number;
      taxCategory: "KDV";
    };
  };
  legalMonetaryTotal: {
    lineExtensionAmount: number;
    taxExclusiveAmount: number;
    taxInclusiveAmount: number;
    payableAmount: number;
  };
  invoiceLines: UblInvoiceLine[];
}

export interface SubmitEInvoiceDraftInput {
  draft: EInvoiceDraft;
  recordId: string;
}

export interface SubmitEInvoiceDraftResult {
  ok: boolean;
  skipped?: boolean;
  documentUuid?: string;
  documentNumber?: string;
  providerResponse?: Prisma.InputJsonValue;
  error?: string;
}

export interface EInvoiceProvider {
  name: EInvoiceProviderName;
  submitDraft(input: SubmitEInvoiceDraftInput): Promise<SubmitEInvoiceDraftResult>;
  healthCheck(): Promise<{ ok: boolean; skipped?: boolean; error?: string }>;
}

export type InvoiceForEInvoice = {
  id: string;
  invoiceNumber: string;
  customerId: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  issuedAt: Date;
  paidAt: Date | null;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  customer: {
    name: string;
    surname: string;
    email: string;
    phone: string | null;
    customerType: "INDIVIDUAL" | "CORPORATE";
    companyName: string | null;
    taxNumber: string | null;
    taxOffice: string | null;
    address: string | null;
    city: string | null;
    country: string;
  };
};