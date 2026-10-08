/**
 * Shared price formatting for the public site.
 *
 * All catalogue prices in the DB are VAT-exclusive (KDV is added at checkout,
 * see src/lib/billing/tax.ts). Use `formatTRY` everywhere a TRY amount is
 * shown, and the `<Price />` component (src/components/site/price.tsx) when
 * the amount should carry the "+KDV" note.
 */

export type BillingPeriod = "monthly" | "yearly";

const withDecimals = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const wholeNumber = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Rounds to kuruş to avoid float noise (e.g. 83.99000001). */
function toKurus(amount: number) {
  return Math.round(amount * 100) / 100;
}

/**
 * Formats a TRY amount in Turkish style.
 *   formatTRY(99.99)  -> "99,99 ₺"
 *   formatTRY(49)     -> "49 ₺"
 *   formatTRY(1299)   -> "1.299 ₺"
 *   formatTRY(49, { keepDecimals: true }) -> "49,00 ₺"
 */
export function formatTRY(
  amount: number,
  options: { keepDecimals?: boolean; symbol?: boolean } = {}
): string {
  const { keepDecimals = false, symbol = true } = options;
  if (!Number.isFinite(amount)) return symbol ? "— ₺" : "—";
  const value = toKurus(amount);
  const isWhole = Number.isInteger(value);
  const text = isWhole && !keepDecimals ? wholeNumber.format(value) : withDecimals.format(value);
  return symbol ? `${text} ₺` : text;
}

/** Short Turkish label for a billing period: "ay" / "yıl". */
export function periodLabel(period: BillingPeriod | "ay" | "yıl"): string {
  if (period === "monthly" || period === "ay") return "ay";
  return "yıl";
}

/**
 * Percent saved when paying yearly, given the regular monthly price and the
 * monthly-equivalent price on the yearly tier. Returns an integer (floored)
 * or 0 when there is no saving.
 */
export function yearlySavingsPercent(monthly: number, yearlyMonthly?: number | null): number {
  if (!yearlyMonthly || !monthly || yearlyMonthly >= monthly) return 0;
  return Math.floor(((monthly - yearlyMonthly) / monthly) * 100);
}

const unitDative: Record<number, string> = {
  1: "e", 2: "ye", 3: "e", 4: "e", 5: "e", 6: "ya", 7: "ye", 8: "e", 9: "a",
};
const tensDative: Record<number, string> = {
  1: "a", 2: "ye", 3: "a", 4: "a", 5: "ye", 6: "a", 7: "e", 8: "e", 9: "a",
};

/**
 * Turkish dative suffix for a number as it is read aloud:
 *   dativeSuffix(20) -> "ye" (yirmi'ye), dativeSuffix(16) -> "ya" (altı'ya),
 *   dativeSuffix(15) -> "e", dativeSuffix(10) -> "a", dativeSuffix(100) -> "e".
 */
export function dativeSuffix(n: number): string {
  const value = Math.abs(Math.trunc(n));
  if (value === 0) return "a"; // sıfır
  const unit = value % 10;
  if (unit !== 0) return unitDative[unit];
  const tens = Math.floor(value / 10) % 10;
  if (tens !== 0) return tensDative[tens];
  return "e"; // yüz, bin
}

/** Highest real yearly saving across plans (for the BillingSwitch note). */
export function maxYearlySavings(
  plans: { monthlyPrice: number; yearlyMonthlyPrice?: number | null }[]
): number {
  return plans.reduce(
    (max, plan) => Math.max(max, yearlySavingsPercent(plan.monthlyPrice, plan.yearlyMonthlyPrice)),
    0
  );
}
