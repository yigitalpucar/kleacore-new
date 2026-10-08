/**
 * Money arithmetic — the single place that adds, multiplies, rounds and
 * converts TRY amounts.
 *
 * Every money column in the database is `numeric(14,2)` (rates are
 * `numeric(5,2)`), so Prisma hands amounts back as `Prisma.Decimal`. Do the
 * maths with these helpers, round to kuruş with `roundHalfUp` (or the helpers
 * that already round: `percent`, `allocate`), and only turn the result into a
 * JS number at the edge — UI props, JSON responses, gateway payloads — with
 * `toNumber`.
 *
 * Why: `0.1 + 0.2 !== 0.3` in floating point, and `Number(x.toFixed(2))`
 * rounds 1.005 down to 1.00 because 1.005 is stored as 1.00499999…. Turkish
 * invoices round half-up ("yarım kuruş yukarı"), which only a decimal type can
 * do reliably.
 *
 * This module is safe to import from client components (`@prisma/client`
 * resolves to its browser build, which ships `Prisma.Decimal`).
 */
import { Prisma } from "@prisma/client";
import { formatTRY } from "@/lib/format/price";

export const Decimal = Prisma.Decimal;
export type Decimal = Prisma.Decimal;

/** Anything a money helper accepts: Decimal, number, numeric string or nullish (= 0). */
export type MoneyInput = Prisma.Decimal | number | string | null | undefined;

/** Kuruş: the smallest TRY unit, two decimal places. */
export const MONEY_SCALE = 2;

function isDecimal(value: unknown): value is Prisma.Decimal {
  return Prisma.Decimal.isDecimal(value);
}

/**
 * Converts any money input to a Decimal. `null`/`undefined`/`""` and values
 * that are not finite numbers become 0, matching how the old `Number(x) || 0`
 * call sites treated missing amounts.
 */
export function money(value: MoneyInput): Prisma.Decimal {
  if (isDecimal(value)) return value;
  if (value === null || value === undefined) return new Prisma.Decimal(0);
  if (typeof value === "number") {
    // String(number) gives the shortest representation that round-trips
    // (0.1 -> "0.1", not 0.1000000000000000055…), which is what callers mean.
    return Number.isFinite(value) ? new Prisma.Decimal(String(value)) : new Prisma.Decimal(0);
  }
  const trimmed = String(value).trim();
  if (!trimmed) return new Prisma.Decimal(0);
  try {
    const parsed = new Prisma.Decimal(trimmed);
    return parsed.isFinite() ? parsed : new Prisma.Decimal(0);
  } catch {
    return new Prisma.Decimal(0);
  }
}

/** Rounds to `decimals` places, ties away from zero (1.005 -> 1.01, -1.005 -> -1.01). */
export function roundHalfUp(value: MoneyInput, decimals: number = MONEY_SCALE): Prisma.Decimal {
  return money(value).toDecimalPlaces(decimals, Prisma.Decimal.ROUND_HALF_UP);
}

export function add(...values: MoneyInput[]): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>((acc, value) => acc.plus(money(value)), new Prisma.Decimal(0));
}

export function sub(a: MoneyInput, b: MoneyInput): Prisma.Decimal {
  return money(a).minus(money(b));
}

/** Exact product (not rounded — round the final amount with `roundHalfUp`). */
export function mul(a: MoneyInput, b: MoneyInput): Prisma.Decimal {
  return money(a).times(money(b));
}

/** Quotient (not rounded). Division by zero returns 0 instead of Infinity. */
export function div(a: MoneyInput, b: MoneyInput): Prisma.Decimal {
  const divisor = money(b);
  if (divisor.isZero()) return new Prisma.Decimal(0);
  return money(a).dividedBy(divisor);
}

/** Sum of a list of amounts (exact; inputs are normally already kuruş). */
export function sum(values: Iterable<MoneyInput>): Prisma.Decimal {
  let total = new Prisma.Decimal(0);
  for (const value of values) total = total.plus(money(value));
  return total;
}

/** `rate` percent of `amount`, rounded half-up to kuruş: percent(1000, 20) -> 200.00. */
export function percent(amount: MoneyInput, rate: MoneyInput): Prisma.Decimal {
  return roundHalfUp(money(amount).times(money(rate)).dividedBy(100));
}

/** -1, 0 or 1 like a sort comparator. */
export function compare(a: MoneyInput, b: MoneyInput): -1 | 0 | 1 {
  return money(a).comparedTo(money(b)) as -1 | 0 | 1;
}

export function eq(a: MoneyInput, b: MoneyInput): boolean {
  return compare(a, b) === 0;
}

export function isZero(value: MoneyInput): boolean {
  return money(value).isZero();
}

export function isPositive(value: MoneyInput): boolean {
  return money(value).greaterThan(0);
}

export function max(...values: MoneyInput[]): Prisma.Decimal {
  return values.map(money).reduce((a, b) => (a.greaterThanOrEqualTo(b) ? a : b));
}

export function min(...values: MoneyInput[]): Prisma.Decimal {
  return values.map(money).reduce((a, b) => (a.lessThanOrEqualTo(b) ? a : b));
}

/**
 * Splits `total` (rounded to kuruş) across `weights` so that the parts add up
 * to exactly `total` — the leftover kuruş go to the largest remainders. Use it
 * when an amount computed once (e.g. invoice-level KDV) has to be shown per
 * line and the lines must still sum to the invoice figure.
 */
export function allocate(total: MoneyInput, weights: MoneyInput[]): Prisma.Decimal[] {
  if (weights.length === 0) return [];
  const target = roundHalfUp(total);
  const ws = weights.map(money);
  const weightSum = sum(ws);
  if (weightSum.isZero()) {
    // No basis to split on: put everything on the first part.
    return ws.map((_, index) => (index === 0 ? target : new Prisma.Decimal(0)));
  }

  const unit = new Prisma.Decimal(1).dividedBy(10 ** MONEY_SCALE);
  const raw = ws.map((w) => target.times(w).dividedBy(weightSum));
  const parts = raw.map((r) => r.toDecimalPlaces(MONEY_SCALE, Prisma.Decimal.ROUND_DOWN));
  let remainder = target.minus(sum(parts));

  const order = raw
    .map((r, index) => ({ index, frac: r.minus(parts[index]).abs() }))
    .sort((a, b) => b.frac.comparedTo(a.frac) || a.index - b.index);

  const step = remainder.isNegative() ? unit.negated() : unit;
  for (let i = 0; !remainder.isZero() && order.length > 0; i = (i + 1) % order.length) {
    const { index } = order[i];
    parts[index] = parts[index].plus(step);
    remainder = remainder.minus(step);
  }
  return parts;
}

/**
 * JS number rounded to kuruş — for client props, JSON payloads, chart data and
 * gateway APIs. Never feed the result back into money arithmetic.
 */
export function toNumber(value: MoneyInput): number {
  return roundHalfUp(value).toNumber();
}

/** Nullable variant of `toNumber` (keeps `null` for optional amounts). */
export function toNumberOrNull(value: MoneyInput): number | null {
  return value === null || value === undefined ? null : toNumber(value);
}

/** Fixed two-decimal string ("1234.50") — for gateways and XML that want text. */
export function toFixed2(value: MoneyInput): string {
  return roundHalfUp(value).toFixed(MONEY_SCALE);
}

/** Integer kuruş (1234.50 -> 123450) — for gateways that take minor units. */
export function toKurus(value: MoneyInput): number {
  return roundHalfUp(value).times(100).toNumber();
}

/** Turkish display string via `formatTRY` ("1.299 ₺", "99,99 ₺"). */
export function formatMoney(
  value: MoneyInput,
  options?: Parameters<typeof formatTRY>[1]
): string {
  return formatTRY(toNumber(value), options);
}

/**
 * Parses an amount typed by a person: "1.234,56", "1234,56", "1234.56",
 * "1 234,56 ₺" and "₺1,234.56" all become 1234.56. Returns null when the text
 * is not a number. The result is NOT rounded — validate/round it explicitly.
 */
export function parseMoney(input: string | number | null | undefined): Prisma.Decimal | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) ? money(input) : null;

  let text = input.replace(/[\s ₺]|TL|TRY/gi, "");
  if (!text) return null;

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    // Both present: whichever comes last is the decimal separator.
    text =
      lastComma > lastDot
        ? text.replace(/\./g, "").replace(",", ".")
        : text.replace(/,/g, "");
  } else if (lastComma !== -1) {
    // Only commas: Turkish decimal comma ("12,5"); several commas = thousands.
    text = (text.match(/,/g) ?? []).length === 1 ? text.replace(",", ".") : text.replace(/,/g, "");
  } else if (lastDot !== -1 && (text.match(/\./g) ?? []).length > 1) {
    // "1.234.567" — dots as thousands separators.
    text = text.replace(/\./g, "");
  }

  if (!/^[-+]?\d+(\.\d+)?$/.test(text)) return null;
  return new Prisma.Decimal(text);
}

/** Recursively converts every Decimal in a plain object/array to a number (kuruş). */
export type Serialized<T> = T extends Prisma.Decimal
  ? number
  : T extends Date
    ? T
    : T extends Array<infer U>
      ? Serialized<U>[]
      : T extends object
        ? { [K in keyof T]: Serialized<T[K]> }
        : T;

/**
 * Deep-converts Decimals to numbers so a Prisma result can cross the
 * server → client boundary (RSC props) or go into `NextResponse.json`.
 * Dates and other values are left as they are.
 */
export function serializeMoney<T>(value: T): Serialized<T> {
  if (isDecimal(value)) return toNumber(value) as Serialized<T>;
  if (Array.isArray(value)) return value.map((item) => serializeMoney(item)) as Serialized<T>;
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = serializeMoney(item);
    return out as Serialized<T>;
  }
  return value as Serialized<T>;
}
