/**
 * MRR / ARR / churn / ARPU from recurring services (3.8).
 *
 * Normalisation follows src/lib/billing/period-price.ts: Service.amount is
 * the KDV-exclusive charge for ONE billing period, so its monthly value is
 * amount / months-in-period (monthly 49 → 49, yearly 468 → 39).
 *
 * There is no service history table, so a service's life is derived from
 * its timestamps:
 *   start = createdAt (PENDING services — paid, not yet set up — are skipped)
 *   end   = cancelledAt, else updatedAt for CANCELLED/EXPIRED, else
 *           suspendedAt for SUSPENDED (a suspended service earns nothing)
 * A service is live at instant t when start ≤ t < end. Upgrades/downgrades
 * are not versioned: the current amount is used for the whole life, so
 * expansion/contraction MRR is not reported. Domains are not services and
 * are not part of MRR. Free services (amount 0) are ignored.
 */
import { Prisma, type BillingPeriod, type ServiceStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { periodMonths } from "@/lib/billing/period-price";
import { money, type MoneyInput } from "@/lib/money";
import { monthBounds, monthsInRange, type ReportRange } from "./range";

export interface MrrServiceInput {
  id: string;
  customerId: string;
  amount: MoneyInput;
  billingPeriod: BillingPeriod | string;
  status: ServiceStatus | string;
  createdAt: Date;
  updatedAt: Date;
  cancelledAt: Date | null;
  suspendedAt: Date | null;
}

interface Span {
  customerId: string;
  monthly: Prisma.Decimal;
  start: number;
  end: number | null;
}

/** Monthly value of one service (unrounded; round the totals). */
export function monthlyValue(amount: MoneyInput, billingPeriod: string): Prisma.Decimal {
  return money(amount).dividedBy(periodMonths(billingPeriod));
}

/** When a service stopped earning, or null while it still does. */
export function serviceEnd(service: Pick<MrrServiceInput, "status" | "updatedAt" | "cancelledAt" | "suspendedAt">): Date | null {
  if (service.cancelledAt) return service.cancelledAt;
  if (service.status === "CANCELLED" || service.status === "EXPIRED") return service.updatedAt;
  if (service.status === "SUSPENDED") return service.suspendedAt ?? service.updatedAt;
  return null;
}

function toSpans(services: MrrServiceInput[]): Span[] {
  const spans: Span[] = [];
  for (const service of services) {
    if (service.status === "PENDING") continue;
    const monthly = monthlyValue(service.amount, String(service.billingPeriod));
    if (monthly.lte(0)) continue;
    const end = serviceEnd(service);
    const start = service.createdAt.getTime();
    if (end && end.getTime() <= start) continue;
    spans.push({ customerId: service.customerId, monthly, start, end: end ? end.getTime() : null });
  }
  return spans;
}

const live = (span: Span, t: number) => span.start <= t && (span.end === null || span.end > t);

export interface MrrSnapshot {
  mrr: Prisma.Decimal;
  customers: number;
  services: number;
}

function snapshot(spans: Span[], t: number): MrrSnapshot & { customerIds: Set<string> } {
  let mrr = new Prisma.Decimal(0);
  let services = 0;
  const customerIds = new Set<string>();
  for (const span of spans) {
    if (!live(span, t)) continue;
    mrr = mrr.plus(span.monthly);
    services += 1;
    customerIds.add(span.customerId);
  }
  return { mrr, customers: customerIds.size, services, customerIds };
}

export interface MrrMonthRow {
  month: string;
  /** MRR at the start of the month. */
  startMrr: Prisma.Decimal;
  /** MRR at the end of the month (now, for the running month). */
  endMrr: Prisma.Decimal;
  newMrr: Prisma.Decimal;
  churnedMrr: Prisma.Decimal;
  startCustomers: number;
  endCustomers: number;
  newCustomers: number;
  churnedCustomers: number;
  /** churned customers / customers at start × 100 (null without customers at start). */
  logoChurnRate: Prisma.Decimal | null;
  /** MRR lost from services live at the start / start MRR × 100. */
  revenueChurnRate: Prisma.Decimal | null;
  /** endMrr / endCustomers. */
  arpu: Prisma.Decimal | null;
}

export interface MrrReport {
  current: { mrr: Prisma.Decimal; arr: Prisma.Decimal; customers: number; services: number; arpu: Prisma.Decimal | null };
  months: MrrMonthRow[];
}

const round2 = (value: Prisma.Decimal) => value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
const pct = (part: Prisma.Decimal | number, whole: Prisma.Decimal | number) => {
  const w = new Prisma.Decimal(whole);
  return w.isZero() ? null : round2(new Prisma.Decimal(part).dividedBy(w).times(100));
};

/**
 * Pure: monthly MRR movement for `months` ("YYYY-MM", Istanbul) given every
 * service that could be live in them. Amounts rounded to kuruş, rates to
 * 0.01 %.
 */
export function computeMrrReport(services: MrrServiceInput[], months: string[], now: Date): MrrReport {
  const spans = toSpans(services);
  const nowT = now.getTime();

  const rows: MrrMonthRow[] = months.map((month) => {
    const bounds = monthBounds(month);
    const s = bounds.start.getTime();
    const e = Math.min(bounds.end.getTime(), nowT);
    // State "at the end" = just before the next month starts.
    const endT = e === bounds.end.getTime() ? e - 1 : e;

    const start = snapshot(spans, s);
    const end = snapshot(spans, endT);

    let newMrr = new Prisma.Decimal(0);
    let churnedMrr = new Prisma.Decimal(0);
    let churnedFromStart = new Prisma.Decimal(0);
    for (const span of spans) {
      if (span.start >= s && span.start <= endT) newMrr = newMrr.plus(span.monthly);
      if (span.end !== null && span.end > s && span.end <= endT) {
        churnedMrr = churnedMrr.plus(span.monthly);
        if (live(span, s)) churnedFromStart = churnedFromStart.plus(span.monthly);
      }
    }

    let churnedCustomers = 0;
    for (const id of start.customerIds) if (!end.customerIds.has(id)) churnedCustomers += 1;
    let newCustomers = 0;
    for (const id of end.customerIds) if (!start.customerIds.has(id)) newCustomers += 1;

    return {
      month,
      startMrr: round2(start.mrr),
      endMrr: round2(end.mrr),
      newMrr: round2(newMrr),
      churnedMrr: round2(churnedMrr),
      startCustomers: start.customers,
      endCustomers: end.customers,
      newCustomers,
      churnedCustomers,
      logoChurnRate: pct(churnedCustomers, start.customers),
      revenueChurnRate: pct(churnedFromStart, start.mrr),
      arpu: end.customers > 0 ? round2(end.mrr.dividedBy(end.customers)) : null,
    };
  });

  const current = snapshot(spans, nowT);
  const mrr = round2(current.mrr);
  return {
    current: {
      mrr,
      arr: round2(current.mrr.times(12)),
      customers: current.customers,
      services: current.services,
      arpu: current.customers > 0 ? round2(current.mrr.dividedBy(current.customers)) : null,
    },
    months: rows,
  };
}

/**
 * Loads only the services that can be live in the range or now (still
 * active, or touched since the range start) with the columns the
 * computation needs.
 */
export async function getMrrReport(range: ReportRange, now: Date = new Date()): Promise<MrrReport> {
  const services = await db.service.findMany({
    where: {
      amount: { gt: 0 },
      status: { not: "PENDING" },
      OR: [{ status: "ACTIVE" }, { updatedAt: { gte: range.from } }],
    },
    select: {
      id: true,
      customerId: true,
      amount: true,
      billingPeriod: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      cancelledAt: true,
      suspendedAt: true,
    },
  });
  return computeMrrReport(services, monthsInRange(range), now);
}
