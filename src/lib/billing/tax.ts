import { db } from "@/lib/db";
import { add, money, percent, roundHalfUp, toNumber, type MoneyInput } from "@/lib/money";

export { calculateInvoiceTotals } from "./invoice-totals";

const DEFAULT_TAX_RATE = 20;
const TAX_RATE_CACHE_TTL_MS = 60_000;

let cachedTaxRate: number | null = null;
let cachedTaxRateExpiresAt = 0;

/**
 * KDV for a VAT-exclusive subtotal: subtotal and tax are rounded half-up to
 * kuruş with Decimal arithmetic, total = subtotal + tax. Returns numbers so
 * existing callers keep working; they are exact kuruş values and can be
 * written to the numeric(14,2) columns as-is.
 */
export function calculateTax(subtotal: MoneyInput, taxRate?: MoneyInput) {
  const rate = taxRate ?? DEFAULT_TAX_RATE;
  const normalizedSubtotal = roundHalfUp(subtotal);
  const taxAmount = percent(normalizedSubtotal, rate);
  const totalAmount = add(normalizedSubtotal, taxAmount);

  return {
    subtotal: toNumber(normalizedSubtotal),
    taxRate: money(rate).toNumber(),
    taxAmount: toNumber(taxAmount),
    totalAmount: toNumber(totalAmount),
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