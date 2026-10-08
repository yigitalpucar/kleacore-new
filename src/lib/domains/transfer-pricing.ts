import { calculateTax } from "@/lib/billing/tax";
import { toNumber, type MoneyInput } from "@/lib/money";

export interface DomainTldPricingRecord {
  ext: string;
  transferPrice: MoneyInput;
  renewPrice?: MoneyInput;
}

export function matchDomainTld(domain: string, tlds: DomainTldPricingRecord[]) {
  const normalized = domain.trim().toLowerCase();
  if (!normalized) return null;

  const sorted = [...tlds].sort((a, b) => b.ext.length - a.ext.length);
  return sorted.find((tld) => normalized.endsWith(tld.ext.toLowerCase())) ?? null;
}

export function calculateDomainTransferPricing(transferPrice: MoneyInput, taxRate: MoneyInput) {
  const subtotal = toNumber(transferPrice);
  const taxed = calculateTax(subtotal, taxRate);

  return {
    subtotal,
    taxRate: taxed.taxRate,
    taxAmount: taxed.taxAmount,
    totalAmount: taxed.totalAmount,
  };
}