/**
 * Admin dashboard (/yonetim) figures, UI3 item 10. Every figure is one
 * aggregate query (no per-row loads); the page asks only for the blocks the
 * viewer's role may see. Results are plain (Decimal → string) and cached for
 * a short time so a busy dashboard does not re-aggregate on every refresh.
 *
 * Money: paid invoices only. `net` = subtotal (KDV hariç), `tax` = KDV,
 * `gross` = totalAmount (KDV dahil), grouped by paidAt in Istanbul days.
 */
import { Prisma, type TicketStatus } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { money, sub } from "@/lib/money";
import { getMrrReport } from "@/lib/reports/mrr";
import { daysInRange, istanbulDayStart, toIstanbulDay } from "@/lib/reports/range";
import { pastDueInvoiceWhere } from "@/lib/billing/past-due";

const SHORT_TTL = 60;
const MRR_TTL = 300;

export interface RevenueTotals {
  /** KDV hariç. */
  net: string;
  tax: string;
  gross: string;
  count: number;
}

const decimalString = (value: Prisma.Decimal | null | undefined) => money(value ?? 0).toFixed(2);

async function paidTotals(from: Date, to: Date): Promise<RevenueTotals> {
  const agg = await db.invoice.aggregate({
    where: { status: "PAID", paidAt: { gte: from, lte: to } },
    _sum: { subtotal: true, taxAmount: true, totalAmount: true },
    _count: { _all: true },
  });
  return {
    net: decimalString(agg._sum.subtotal),
    tax: decimalString(agg._sum.taxAmount),
    gross: decimalString(agg._sum.totalAmount),
    count: agg._count._all,
  };
}

/** Bounds of "today" and "this month" in Istanbul for `now`. */
export function istanbulPeriodStarts(now: Date) {
  const today = toIstanbulDay(now);
  return { dayStart: istanbulDayStart(today), monthStart: istanbulDayStart(`${today.slice(0, 8)}01`), today };
}

export const getRevenueSummary = unstable_cache(
  async (nowIso: string) => {
    const now = new Date(nowIso);
    const { dayStart, monthStart } = istanbulPeriodStarts(now);
    const [today, month] = await Promise.all([paidTotals(dayStart, now), paidTotals(monthStart, now)]);
    return { today, month };
  },
  ["admin-overview-revenue"],
  { revalidate: SHORT_TTL, tags: ["admin-overview"] }
);

/** Current MRR/ARR from the reports module (src/lib/reports/mrr.ts). */
export const getCurrentMrr = unstable_cache(
  async () => {
    const now = new Date();
    const { today, monthStart } = istanbulPeriodStarts(now);
    const report = await getMrrReport(
      { from: monthStart, to: now, period: "custom", fromDay: `${today.slice(0, 8)}01`, toDay: today },
      now
    );
    return {
      mrr: report.current.mrr.toFixed(2),
      arr: report.current.arr.toFixed(2),
      customers: report.current.customers,
      services: report.current.services,
    };
  },
  ["admin-overview-mrr"],
  { revalidate: MRR_TTL, tags: ["admin-overview"] }
);

/**
 * Past-due receivables: OVERDUE invoices plus PENDING ones past their due date
 * (src/lib/billing/past-due.ts); remaining = total − paid, KDV dahil.
 */
export async function loadPastDueReceivables(now: Date) {
  const groups = await db.invoice.groupBy({
    by: ["status"],
    where: pastDueInvoiceWhere(now),
    _sum: { totalAmount: true, paidAmount: true },
    _count: { _all: true },
  });
  let remaining = money(0);
  let overdueCount = 0;
  let pendingPastDueCount = 0;
  for (const group of groups) {
    remaining = remaining.add(sub(group._sum.totalAmount ?? 0, group._sum.paidAmount ?? 0));
    if (group.status === "OVERDUE") overdueCount += group._count._all;
    else pendingPastDueCount += group._count._all;
  }
  return {
    amount: (remaining.isNegative() ? money(0) : remaining).toFixed(2),
    count: overdueCount + pendingPastDueCount,
    overdueCount,
    pendingPastDueCount,
  };
}

export const getOverdueReceivables = unstable_cache(
  async (nowIso: string) => loadPastDueReceivables(new Date(nowIso)),
  ["admin-overview-past-due"],
  { revalidate: SHORT_TTL, tags: ["admin-overview"] }
);

export const OPEN_TICKET_STATUSES: TicketStatus[] = ["OPEN", "CUSTOMER_REPLY", "ADMIN_REPLY", "WAITING"];

export async function getOpenTicketsByStatus(): Promise<Record<string, number>> {
  const groups = await db.supportTicket.groupBy({
    by: ["status"],
    where: { status: { in: OPEN_TICKET_STATUSES } },
    _count: { _all: true },
  });
  const out: Record<string, number> = Object.fromEntries(OPEN_TICKET_STATUSES.map((s) => [s, 0]));
  for (const g of groups) out[g.status] = g._count._all;
  return out;
}

/** Manual (admin task) provisioning jobs not completed yet. */
export function getPendingManualProvisioning() {
  return db.provisioningJob.count({ where: { kind: "MANUAL", status: { in: ["PENDING", "PROCESSING"] } } });
}

export function getPendingKycCount() {
  return db.user.count({ where: { kycStatus: "PENDING" } });
}

export function getPendingFraudReviews() {
  return db.fraudCheck.count({ where: { status: "REVIEW" } });
}

export interface DailyPoint {
  day: string;
  value: number;
}

/** Fills missing days with 0 (oldest first). Pure; exported for tests. */
export function fillDays(rows: { day: string; value: number }[], fromDay: string, toDay: string): DailyPoint[] {
  const byDay = new Map(rows.map((r) => [r.day, r.value]));
  return daysInRange({ fromDay, toDay }).map((day) => ({ day, value: byDay.get(day) ?? 0 }));
}

function addDays(day: string, delta: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/**
 * Last `days` Istanbul days: paid invoice totals (KDV dahil) and new
 * customer sign-ups per day. Two GROUP BY queries.
 */
export const getDailySeries = unstable_cache(
  async (nowIso: string, days: number) => {
    const now = new Date(nowIso);
    const toDay = toIstanbulDay(now);
    const fromDay = addDays(toDay, -(days - 1));
    const from = istanbulDayStart(fromDay);

    const [revenue, signups] = await Promise.all([
      db.$queryRaw<{ day: string; net: string; gross: string }[]>(Prisma.sql`
        SELECT to_char(("paidAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM-DD') AS day,
               SUM("subtotal")::text AS net,
               SUM("totalAmount")::text AS gross
        FROM "invoices"
        WHERE "status" = 'PAID' AND "paidAt" >= ${from} AND "paidAt" <= ${now}
        GROUP BY 1`),
      db.$queryRaw<{ day: string; count: number }[]>(Prisma.sql`
        SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM-DD') AS day,
               COUNT(*)::int AS count
        FROM "users"
        WHERE "role" = 'CUSTOMER' AND "createdAt" >= ${from} AND "createdAt" <= ${now}
        GROUP BY 1`),
    ]);

    return {
      fromDay,
      toDay,
      revenue: fillDays(revenue.map((r) => ({ day: r.day, value: Number(r.gross) })), fromDay, toDay),
      revenueNet: fillDays(revenue.map((r) => ({ day: r.day, value: Number(r.net) })), fromDay, toDay),
      signups: fillDays(signups.map((r) => ({ day: r.day, value: Number(r.count) })), fromDay, toDay),
    };
  },
  ["admin-overview-daily"],
  { revalidate: SHORT_TTL, tags: ["admin-overview"] }
);

/** Rounds `now` down to the minute so cached calls share a key within a minute. */
export function cacheMinute(now: Date) {
  return new Date(Math.floor(now.getTime() / 60_000) * 60_000).toISOString();
}
