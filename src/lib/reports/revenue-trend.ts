/**
 * Revenue trend of paid invoices for the reports page and its export:
 * daily points up to ~2 months, monthly beyond (Istanbul calendar).
 */
import type { Prisma } from "@prisma/client";
import { add, toNumber, type MoneyInput } from "@/lib/money";
import { dayLabel, daysInRange, monthLabel, monthsInRange, toIstanbulDay, type ReportRange } from "./range";

export interface TrendPoint {
  key: string;
  label: string;
  value: number;
}

export function buildRevenueTrend(
  paidInvoices: Array<{ paidAt: Date | null; paidAmount: MoneyInput }>,
  range: Pick<ReportRange, "fromDay" | "toDay">
): { granularity: "day" | "month"; points: TrendPoint[] } {
  const days = daysInRange(range);
  const granularity = days.length <= 62 ? "day" : "month";
  const totals = new Map<string, Prisma.Decimal>();
  for (const invoice of paidInvoices) {
    if (!invoice.paidAt) continue;
    const day = toIstanbulDay(new Date(invoice.paidAt));
    const key = granularity === "day" ? day : day.slice(0, 7);
    totals.set(key, add(totals.get(key), invoice.paidAmount));
  }
  const keys = granularity === "day" ? days : monthsInRange(range);
  return {
    granularity,
    points: keys.map((key) => ({
      key,
      label: granularity === "day" ? dayLabel(key, true) : monthLabel(key, true),
      value: toNumber(totals.get(key)),
    })),
  };
}

const PERIOD_LABELS: Record<string, string> = {
  "7days": "Son 7 gün",
  "30days": "Son 30 gün",
  "3months": "Son 3 ay",
  "6months": "Son 6 ay",
  "1year": "Son 1 yıl",
};

/** "Son 6 ay" or "01.09.2026 – 30.09.2026". */
export function rangeLabel(range: Pick<ReportRange, "period" | "fromDay" | "toDay">): string {
  return range.period === "custom"
    ? `${dayLabel(range.fromDay)} – ${dayLabel(range.toDay)}`
    : PERIOD_LABELS[range.period] ?? range.period;
}
