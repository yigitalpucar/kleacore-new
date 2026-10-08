import type { EInvoiceStatus, Prisma } from "@prisma/client";
import type { MoneyInput } from "./money";

export type EInvoiceType = "e-fatura" | "e-arsiv";

/** UBL-TR ProfileID. e-Arşiv is always EARSIVFATURA; e-Fatura is TEMEL or TICARI. */
export type EInvoiceProfile = "TEMELFATURA" | "TICARIFATURA" | "EARSIVFATURA";
export type EFaturaProfile = Exclude<EInvoiceProfile, "EARSIVFATURA">;

export type EInvoiceProviderName = "uyumsoft" | "parasut" | "disabled";

export interface UyumsoftSettings {
  username: string;
  password: string;
  testMode: boolean;
  /** 3-character series prefixes the entegratör numbers the documents with. */
  earsivPrefix: string;
  efaturaPrefix: string;
}

export interface EInvoiceConfig {
  enabled: boolean;
  provider: EInvoiceProviderName;
  /** Paraşüt credentials (legacy name). */
  apiKey: string;
  companyVkn: string;
  defaultProfile: EFaturaProfile;
  uyumsoft: UyumsoftSettings;
  supplier: SupplierInfo;
}

/** Our company as the UBL AccountingSupplierParty. */
export interface SupplierInfo {
  name: string;
  vkn: string;
  taxOffice: string;
  street: string;
  district: string;
  city: string;
  postalZone: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  mersisNo?: string;
  tradeRegistryNo?: string;
}

export interface CustomerParty {
  scheme: "VKN" | "TCKN";
  identifier: string;
  /** Company title (VKN) or full name (TCKN). */
  name: string;
  firstName?: string;
  familyName?: string;
  taxOffice?: string;
  street?: string;
  district?: string;
  city: string;
  country: string;
  email?: string;
  phone?: string;
}

export interface EInvoiceLine {
  id: string;
  name: string;
  quantity: number;
  /** Unit price as a decimal string (may carry more than 2 decimals). */
  unitPrice: string;
  netKurus: number;
  taxPercent: number;
  taxKurus: number;
}

export interface InternetSaleInfo {
  website: string;
  /** e.g. KREDIKARTI/BANKAKARTI, EFT/HAVALE, DIGER */
  paymentType: string;
  paymentMediator?: string;
  paymentDate: Date;
}

/**
 * Provider-neutral, fully computed e-invoice. Providers turn this into their
 * wire format (UBL-TR XML for Uyumsoft, JSON:API for Paraşüt).
 */
export interface EInvoiceDocument {
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  type: EInvoiceType;
  profile: EInvoiceProfile;
  /** ETTN — UBL UUID. Stable per record so retries cannot double-issue. */
  uuid: string;
  /** Document number; empty means "let the entegratör assign it". */
  number: string;
  /** Series prefix used when the entegratör assigns the number. */
  seriesPrefix: string;
  issueDate: string;
  issueTime: string;
  currency: "TRY";
  supplier: SupplierInfo;
  customer: CustomerParty;
  /** Receiver alias (posta kutusu etiketi) for e-Fatura. */
  customerAlias?: string;
  lines: EInvoiceLine[];
  taxPercent: number;
  totals: {
    lineExtensionKurus: number;
    taxExclusiveKurus: number;
    taxKurus: number;
    taxInclusiveKurus: number;
    payableKurus: number;
  };
  notes: string[];
  internetSale?: InternetSaleInfo;
  /** Customer e-mail for the e-Arşiv delivery notification. */
  notificationEmail?: string;
}

export interface IssueResult {
  uuid: string;
  number: string;
  status: EInvoiceStatus;
  providerStatus?: string;
  providerResponse?: Prisma.InputJsonValue;
}

export interface StatusResult {
  status: EInvoiceStatus;
  providerStatus: string;
  message?: string;
}

export interface TaxpayerInfo {
  isEInvoiceUser: boolean;
  /** Receiver alias (urn:mail:...pk@...) to address the e-Fatura to. */
  alias?: string;
  title?: string;
}

export interface HealthResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
  detail?: string;
}

export class EInvoiceNotSupportedError extends Error {
  constructor(provider: string, operation: string) {
    super(`EFATURA_NOT_SUPPORTED: ${provider} ${operation}`);
    this.name = "EInvoiceNotSupportedError";
  }
}

export interface EInvoiceProvider {
  name: EInvoiceProviderName;
  healthCheck(): Promise<HealthResult>;
  /** Is the VKN/TCKN a registered e-Fatura user? Decides e-Fatura vs e-Arşiv. */
  checkTaxpayer(vknTckn: string): Promise<TaxpayerInfo>;
  issue(document: EInvoiceDocument): Promise<IssueResult>;
  getStatus(uuid: string, type: EInvoiceType): Promise<StatusResult>;
  getPdf(uuid: string, type: EInvoiceType): Promise<Buffer>;
  /** e-Arşiv cancellation (e-Fatura is rejected/returned by the receiver instead). */
  cancel(uuid: string, reason: string): Promise<void>;
}

export type InvoiceForEInvoice = {
  id: string;
  invoiceNumber: string;
  customerId: string;
  subtotal: MoneyInput;
  taxRate: MoneyInput;
  taxAmount: MoneyInput;
  totalAmount: MoneyInput;
  issuedAt: Date;
  paidAt: Date | null;
  notes?: string | null;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: MoneyInput;
    totalPrice: MoneyInput;
  }>;
  payments?: Array<{
    method: string;
    status: string;
    paidAt: Date | null;
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
