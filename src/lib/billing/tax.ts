import { db } from "@/lib/db";

const DEFAULT_TAX_RATE = 20;
const TAX_RATE_CACHE_TTL_MS = 60_000;

let cachedTaxRate: number | null = null;
let cachedTaxRateExpiresAt = 0;

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

export function calculateTax(subtotal: number, taxRate?: number) {
  const rate = taxRate ?? DEFAULT_TAX_RATE;
  const normalizedSubtotal = roundMoney(subtotal);
  const taxAmount = roundMoney(normalizedSubtotal * (rate / 100));
  const totalAmount = roundMoney(normalizedSubtotal + taxAmount);

  return {
    subtotal: normalizedSubtotal,
    taxRate: rate,
    taxAmount,
    totalAmount,
  };
}

export async function getTaxRate(): Promise<number> {
  const now = Date.now();
  if (cachedTaxRate !== null && now < cachedTaxRateExpiresAt) {
    return cachedTaxRate;
  }

  const setting = await db.setting.findFirst({
    where: {
      group: "billing",
      key: "tax_rate",
    },
    select: { value: true },
  });

  const parsed = Number(setting?.value);
  const taxRate =
    Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_TAX_RATE;

  cachedTaxRate = taxRate;
  cachedTaxRateExpiresAt = now + TAX_RATE_CACHE_TTL_MS;

  return taxRate;
}

export function clearTaxRateCache() {
  cachedTaxRate = null;
  cachedTaxRateExpiresAt = 0;
}