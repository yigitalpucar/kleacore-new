import { calculateTax } from "@/lib/billing/tax";

export interface DomainTldPricingRecord {
  ext: string;
  transferPrice: number;
  renewPrice?: number;
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

export function matchDomainTld(domain: string, tlds: DomainTldPricingRecord[]) {
  const normalized = domain.trim().toLowerCase();
  if (!normalized) return null;

  const sorted = [...tlds].sort((a, b) => b.ext.length - a.ext.length);
  return sorted.find((tld) => normalized.endsWith(tld.ext.toLowerCase())) ?? null;
}

export function calculateDomainTransferPricing(transferPrice: number, taxRate: number) {
  const subtotal = roundMoney(transferPrice);
  const taxed = calculateTax(subtotal, taxRate);

  return {
    subtotal,
    taxRate: taxed.taxRate,
    taxAmount: taxed.taxAmount,
    totalAmount: taxed.totalAmount,
  };
}