/**
 * Period pricing rules — the single place that turns a stored catalogue price
 * into the amount actually charged for one billing period.
 *
 * How prices are stored (see prisma/seed-data/* and the admin product forms):
 *
 * - `pricing_tiers` of recurring infrastructure products (hosting, VPS, VDS,
 *   cloud, dedicated servers, datacenter services): the `yearly` row holds the
 *   MONTHLY EQUIVALENT when paid annually (Starter: monthly 49, yearly 39 =
 *   39 ₺/ay billed as 12 × 39 = 468 ₺/yıl).
 * - `product_addons.yearlyPrice`: also a monthly equivalent (Günlük Yedekleme
 *   29 ₺/ay, 24 ₺/ay yıllık ödemede).
 * - Domain, SSL and e-mail products are inherently priced per period: their
 *   `yearly` (and `biennial`) rows are already the total for that period
 *   (SSL-DV-01 yearly 99 = 99 ₺ for one year). They must NOT be multiplied.
 * - Configurable options (`product_config_options`) store `priceYearly` /
 *   `unitPriceYearly` as the yearly TOTAL (e.g. 15 ₺/ay → 150 ₺/yıl), so they
 *   are used as-is.
 *
 * All amounts are VAT-exclusive; KDV is added by `calculateTax`.
 */

export type PeriodKey =
  | "monthly"
  | "quarterly"
  | "semiannual"
  | "yearly"
  | "biennial"
  | "triennial";

export const PERIOD_MONTHS: Record<PeriodKey, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  yearly: 12,
  biennial: 24,
  triennial: 36,
};

/**
 * - `monthly-equivalent`: every tier price is a per-month amount; the charge
 *   for a period is price × months in the period.
 * - `period-total`: the tier price already is the charge for its period.
 */
export type PriceBasis = "monthly-equivalent" | "period-total";

/** Product categories whose tier prices are stored per month. */
const MONTHLY_EQUIVALENT_CATEGORIES = new Set([
  "hosting",
  "vps",
  "vds",
  "cloud",
  "server",
  "datacenter",
]);

/** Cart item types (src/store/cart-store.ts) priced per month. */
const MONTHLY_EQUIVALENT_ITEM_TYPES = new Set(["hosting", "server", "datacenter"]);

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * Pricing basis of a product category slug. Unknown categories default to
 * `period-total` so a new category can never be silently charged 12×.
 */
export function priceBasisForCategory(categorySlug: string | null | undefined): PriceBasis {
  return categorySlug && MONTHLY_EQUIVALENT_CATEGORIES.has(categorySlug)
    ? "monthly-equivalent"
    : "period-total";
}

/** Pricing basis of a cart item type (domain / ssl are period totals). */
export function priceBasisForItemType(type: string | null | undefined): PriceBasis {
  return type && MONTHLY_EQUIVALENT_ITEM_TYPES.has(type) ? "monthly-equivalent" : "period-total";
}

export function periodMonths(period: string | null | undefined): number {
  return PERIOD_MONTHS[(period ?? "monthly") as PeriodKey] ?? 1;
}

/**
 * Amount charged for ONE billing period, given the stored tier price.
 *
 *   periodTotal(39, "yearly", "monthly-equivalent") -> 468
 *   periodTotal(49, "monthly", "monthly-equivalent") -> 49
 *   periodTotal(99, "yearly", "period-total")       -> 99   (SSL / domain)
 */
export function periodTotal(tierPrice: number, period: string | null | undefined, basis: PriceBasis): number {
  const price = Number(tierPrice);
  if (!Number.isFinite(price)) return 0;
  if (basis === "period-total") return roundMoney(price);
  return roundMoney(price * periodMonths(period));
}

/** Per-month equivalent of a period total (for "aylık X ₺ karşılığı" copy). */
export function monthlyEquivalent(total: number, period: string | null | undefined): number {
  return roundMoney(Number(total) / periodMonths(period));
}

/**
 * Charge for one addon over a billing period. Addon `yearlyPrice` is a
 * monthly equivalent, so a yearly addon is 12 × yearlyPrice.
 */
export function addonPeriodTotal(
  addon: { monthlyPrice: number | string | { toString(): string }; yearlyPrice: number | string | { toString(): string } },
  period: string | null | undefined
): number {
  const isYearly = period === "yearly";
  const perMonth = Number(isYearly ? addon.yearlyPrice : addon.monthlyPrice);
  return periodTotal(perMonth, isYearly ? "yearly" : "monthly", "monthly-equivalent");
}

export interface TieredProduct {
  basePrice: number;
  categorySlug: string | null | undefined;
  pricingTiers: Array<{ period: string; price: number; isDefault: boolean }>;
}

/** Stored tier price for a period: exact tier, else the default tier, else basePrice. */
export function tierPriceForPeriod(product: TieredProduct, period: string): number {
  const exact = product.pricingTiers.find((tier) => tier.period === period);
  if (exact) return Number(exact.price);

  const defaultTier = product.pricingTiers.find((tier) => tier.isDefault);
  if (defaultTier) return Number(defaultTier.price);

  return Number(product.basePrice);
}

/**
 * Charge for one billing period of a catalogue product (e.g. admin "hizmet
 * ekle"), VAT-exclusive. `total` is what a Service stores as `amount` — the
 * full period total (yearly hosting at 39 ₺/ay -> 468), never the monthly
 * equivalent. `base` is the same period at the monthly list price, so
 * `discount` is the saving of paying for the longer period.
 */
export function productPeriodPricing(
  product: TieredProduct,
  period: string
): { base: number; discount: number; total: number } {
  const basis = priceBasisForCategory(product.categorySlug);
  const total = periodTotal(tierPriceForPeriod(product, period), period, basis);

  if (basis === "period-total") {
    return { base: total, discount: 0, total };
  }

  const base = periodTotal(tierPriceForPeriod(product, "monthly"), period, basis);
  return { base, discount: roundMoney(Math.max(0, base - total)), total };
}
