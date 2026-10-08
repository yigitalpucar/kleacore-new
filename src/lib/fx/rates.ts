/**
 * Stored TCMB rates (ExchangeRate rows) and the lookup every price/cost
 * conversion uses. All rates are TRY per 1 unit of the foreign currency.
 */
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const TZ = "Europe/Istanbul";

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Istanbul calendar day of an instant, "YYYY-MM-DD". */
export function istanbulDay(date: Date): string {
  return dayFormatter.format(date);
}

/** "YYYY-MM-DD" → the Date Prisma uses for a `@db.Date` column (UTC midnight). */
export function dayToDbDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

/** `@db.Date` value → "YYYY-MM-DD". */
export function dbDateToDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface RateRow {
  currency: string;
  /** Bulletin day, "YYYY-MM-DD". */
  date: string;
  buying: Prisma.Decimal;
  selling: Prisma.Decimal;
}

export type RateSide = "buying" | "selling";

export interface ResolvedRate {
  currency: string;
  /** TRY per 1 unit. */
  rate: Prisma.Decimal;
  /** Bulletin day actually used (≤ the requested day). */
  date: string;
  /** True when the requested day had no bulletin of its own (weekend, holiday, not yet published). */
  fallback: boolean;
}

const ONE = new Prisma.Decimal(1);

/**
 * Pure lookup: the rate of `currency` on `day`, or of the latest bulletin
 * before it. `rows` may be in any order and contain other currencies.
 * TRY always resolves to 1. Returns null when no bulletin on/before `day`.
 */
export function pickRate(
  rows: RateRow[],
  currency: string,
  day: string,
  side: RateSide = "selling"
): ResolvedRate | null {
  const code = currency.toUpperCase();
  if (code === "TRY") return { currency: "TRY", rate: ONE, date: day, fallback: false };

  let best: RateRow | null = null;
  for (const row of rows) {
    if (row.currency !== code || row.date > day) continue;
    if (!best || row.date > best.date) best = row;
  }
  if (!best) return null;
  return { currency: code, rate: best[side], date: best.date, fallback: best.date !== day };
}

/**
 * Rate of `currency` for an instant (its Istanbul day), falling back to the
 * latest prior bulletin. ForexSelling by default — what we pay when buying
 * USD for registrar costs.
 */
export async function getRate(
  currency: string,
  date: Date = new Date(),
  side: RateSide = "selling"
): Promise<ResolvedRate | null> {
  const code = currency.toUpperCase();
  const day = istanbulDay(date);
  if (code === "TRY") return pickRate([], code, day, side);

  const row = await db.exchangeRate.findFirst({
    where: { currency: code, date: { lte: dayToDbDate(day) } },
    orderBy: { date: "desc" },
    select: { currency: true, date: true, buying: true, selling: true },
  });
  if (!row) return null;
  return pickRate([{ ...row, date: dbDateToDay(row.date) }], code, day, side);
}

/** Latest stored rate of each currency (admin screens). */
export async function getLatestRates(currencies: readonly string[]): Promise<Map<string, RateRow & { banknoteSelling: Prisma.Decimal | null; source: string; updatedAt: Date }>> {
  const rows = await Promise.all(
    currencies.map((currency) =>
      db.exchangeRate.findFirst({ where: { currency }, orderBy: { date: "desc" } })
    )
  );
  const out = new Map<string, RateRow & { banknoteSelling: Prisma.Decimal | null; source: string; updatedAt: Date }>();
  for (const row of rows) {
    if (!row) continue;
    out.set(row.currency, {
      currency: row.currency,
      date: dbDateToDay(row.date),
      buying: row.buying,
      selling: row.selling,
      banknoteSelling: row.banknoteSelling,
      source: row.source,
      updatedAt: row.updatedAt,
    });
  }
  return out;
}

/**
 * All rate rows of `currencies` needed to resolve days in [fromDay, toDay]:
 * the rows inside the range plus the latest row before it (fallback for the
 * first days). One query per currency for the anchor + one for the range.
 */
export async function loadRatesForRange(
  currencies: readonly string[],
  from: Date,
  to: Date
): Promise<RateRow[]> {
  const codes = [...new Set(currencies.map((c) => c.toUpperCase()).filter((c) => c !== "TRY"))];
  if (codes.length === 0) return [];
  const fromDay = dayToDbDate(istanbulDay(from));
  const toDay = dayToDbDate(istanbulDay(to));

  const [inRange, anchors] = await Promise.all([
    db.exchangeRate.findMany({
      where: { currency: { in: codes }, date: { gte: fromDay, lte: toDay } },
      select: { currency: true, date: true, buying: true, selling: true },
    }),
    Promise.all(
      codes.map((currency) =>
        db.exchangeRate.findFirst({
          where: { currency, date: { lt: fromDay } },
          orderBy: { date: "desc" },
          select: { currency: true, date: true, buying: true, selling: true },
        })
      )
    ),
  ]);

  return [...inRange, ...anchors.filter((row) => row !== null)].map((row) => ({
    ...row,
    date: dbDateToDay(row.date),
  }));
}
