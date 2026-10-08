/**
 * Gross margin of domain sales (3.8): net sale (TRY, KDV-exclusive invoice
 * subtotal) − registrar cost (DomainTld cost × years × TCMB ForexSelling of
 * the Istanbul day the invoice was paid, falling back to the latest prior
 * bulletin).
 *
 * Sales: registrations (order item configuration.type "domain", years =
 * quantity), transfers ("domain_transfer", 1 year) and renewals
 * (DomainRenewal.invoiceId, its years). Fully refunded invoices are not
 * sales. Costs are the CURRENT DomainTld costs (no cost history is kept), so
 * older sales are approximate if the registrar changed its price list.
 */
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { money, roundHalfUp } from "@/lib/money";
import { istanbulDay, loadRatesForRange, pickRate, type RateRow } from "@/lib/fx/rates";
import type { ReportRange } from "./range";

export type DomainSaleKind = "register" | "transfer" | "renew";

export const DOMAIN_SALE_LABELS: Record<DomainSaleKind, string> = {
  register: "Kayıt",
  transfer: "Transfer",
  renew: "Yenileme",
};

export interface DomainSaleInput {
  invoiceId: string;
  invoiceNumber: string;
  paidAt: Date;
  domain: string;
  kind: DomainSaleKind;
  years: number;
  /** Net sale, TRY (invoice subtotal). */
  sale: Prisma.Decimal;
  /** TLD from the order (register/transfer); derived from the domain otherwise. */
  tld: string | null;
}

export interface TldCost {
  ext: string;
  costRegister: Prisma.Decimal | null;
  costRenew: Prisma.Decimal | null;
  costTransfer: Prisma.Decimal | null;
  costCurrency: string;
}

export interface DomainMarginRow extends DomainSaleInput {
  tld: string | null;
  costCurrency: string | null;
  costForeign: Prisma.Decimal | null;
  rate: Prisma.Decimal | null;
  rateDay: string | null;
  costTry: Prisma.Decimal | null;
  margin: Prisma.Decimal | null;
  marginPercent: Prisma.Decimal | null;
  /** Why no margin could be computed. */
  issue: "NO_TLD" | "NO_COST" | "NO_RATE" | null;
}

export interface DomainMarginSummary {
  sales: number;
  revenue: Prisma.Decimal;
  /** Revenue of the rows with a known cost (margin basis). */
  costedRevenue: Prisma.Decimal;
  cost: Prisma.Decimal;
  margin: Prisma.Decimal;
  marginPercent: Prisma.Decimal | null;
  uncosted: number;
}

export interface DomainMarginByTld {
  tld: string;
  sales: number;
  revenue: Prisma.Decimal;
  /** Revenue of the sales with a known cost (margin % basis). */
  costedRevenue: Prisma.Decimal;
  cost: Prisma.Decimal;
  margin: Prisma.Decimal;
  marginPercent: Prisma.Decimal | null;
  uncosted: number;
}

const COST_KEY = { register: "costRegister", transfer: "costTransfer", renew: "costRenew" } as const;

/** Longest matching TLD of a domain name (".com.tr" before ".tr"). */
export function matchTld(domain: string, exts: string[]): string | null {
  const name = domain.toLowerCase();
  let best: string | null = null;
  for (const ext of exts) {
    if (name.endsWith(ext.toLowerCase()) && (!best || ext.length > best.length)) best = ext;
  }
  return best;
}

const pct = (part: Prisma.Decimal, whole: Prisma.Decimal) =>
  whole.isZero() ? null : part.dividedBy(whole).times(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

/** Pure: margin per sale plus totals and a per-TLD breakdown. */
export function computeDomainMargins(sales: DomainSaleInput[], tlds: TldCost[], rates: RateRow[]) {
  const byExt = new Map(tlds.map((t) => [t.ext.toLowerCase(), t]));
  const exts = tlds.map((t) => t.ext);

  const rows: DomainMarginRow[] = sales.map((sale) => {
    const tld = (sale.tld && byExt.has(sale.tld.toLowerCase()) ? sale.tld : null) ?? matchTld(sale.domain, exts);
    const base = { ...sale, tld, costCurrency: null, costForeign: null, rate: null, rateDay: null, costTry: null, margin: null, marginPercent: null };
    if (!tld) return { ...base, issue: "NO_TLD" as const };
    const cost = byExt.get(tld.toLowerCase())!;
    const unit = cost[COST_KEY[sale.kind]] ?? (sale.kind === "transfer" ? cost.costRenew : null);
    if (!unit) return { ...base, costCurrency: cost.costCurrency, issue: "NO_COST" as const };
    const rate = pickRate(rates, cost.costCurrency, istanbulDay(sale.paidAt), "selling");
    const costForeign = unit.times(Math.max(1, sale.years));
    if (!rate) return { ...base, costCurrency: cost.costCurrency, costForeign, issue: "NO_RATE" as const };
    const costTry = roundHalfUp(costForeign.times(rate.rate));
    const margin = sale.sale.minus(costTry);
    return {
      ...base,
      costCurrency: cost.costCurrency,
      costForeign,
      rate: rate.rate,
      rateDay: rate.date,
      costTry,
      margin,
      marginPercent: pct(margin, sale.sale),
      issue: null,
    };
  });

  const zero = () => new Prisma.Decimal(0);
  const summary: DomainMarginSummary = {
    sales: rows.length,
    revenue: zero(),
    costedRevenue: zero(),
    cost: zero(),
    margin: zero(),
    marginPercent: null,
    uncosted: 0,
  };
  const perTld = new Map<string, DomainMarginByTld>();

  for (const row of rows) {
    summary.revenue = summary.revenue.plus(row.sale);
    const key = row.tld ?? "?";
    const group = perTld.get(key) ?? { tld: key, sales: 0, revenue: zero(), costedRevenue: zero(), cost: zero(), margin: zero(), marginPercent: null, uncosted: 0 };
    group.sales += 1;
    group.revenue = group.revenue.plus(row.sale);
    if (row.costTry && row.margin) {
      summary.costedRevenue = summary.costedRevenue.plus(row.sale);
      summary.cost = summary.cost.plus(row.costTry);
      summary.margin = summary.margin.plus(row.margin);
      group.costedRevenue = group.costedRevenue.plus(row.sale);
      group.cost = group.cost.plus(row.costTry);
      group.margin = group.margin.plus(row.margin);
    } else {
      summary.uncosted += 1;
      group.uncosted += 1;
    }
    perTld.set(key, group);
  }
  summary.marginPercent = pct(summary.margin, summary.costedRevenue);
  const byTld = [...perTld.values()]
    .map((g) => ({ ...g, marginPercent: pct(g.margin, g.costedRevenue) }))
    .sort((a, b) => b.revenue.comparedTo(a.revenue));

  return { rows, summary, byTld };
}

export async function getDomainMarginReport(range: ReportRange) {
  const [raw, tlds] = await Promise.all([
    db.$queryRaw<
      Array<{
        invoiceId: string;
        invoiceNumber: string;
        paidAt: Date;
        sale: Prisma.Decimal;
        itemType: string | null;
        itemTld: string | null;
        itemDomain: string | null;
        orderDomain: string | null;
        quantity: number | null;
        renewalYears: number | null;
        renewalDomain: string | null;
      }>
    >`
      SELECT i.id AS "invoiceId", i."invoiceNumber" AS "invoiceNumber", i."paidAt" AS "paidAt", i.subtotal AS sale,
             oi.configuration->>'type' AS "itemType", oi.configuration->>'tld' AS "itemTld",
             oi.configuration->>'domain' AS "itemDomain", o.domain AS "orderDomain", oi.quantity AS quantity,
             dr.years AS "renewalYears", d.name AS "renewalDomain"
      FROM invoices i
      LEFT JOIN orders o ON o.id = i."orderId"
      LEFT JOIN LATERAL (
        SELECT configuration, quantity FROM order_items WHERE "orderId" = o.id ORDER BY id LIMIT 1
      ) oi ON TRUE
      LEFT JOIN domain_renewals dr ON dr."invoiceId" = i.id
      LEFT JOIN domains d ON d.id = dr."domainId"
      WHERE i.status::text IN ('PAID', 'PARTIALLY_REFUNDED')
        AND i."paidAt" >= ${range.from} AND i."paidAt" <= ${range.to}
        AND (dr.id IS NOT NULL OR oi.configuration->>'type' IN ('domain', 'domain_transfer'))
      ORDER BY i."paidAt" ASC`,
    db.domainTld.findMany({
      select: { ext: true, costRegister: true, costRenew: true, costTransfer: true, costCurrency: true },
    }),
  ]);

  const sales: DomainSaleInput[] = raw.map((row) => {
    const kind: DomainSaleKind = row.renewalDomain
      ? "renew"
      : row.itemType === "domain_transfer"
        ? "transfer"
        : "register";
    return {
      invoiceId: row.invoiceId,
      invoiceNumber: row.invoiceNumber,
      paidAt: row.paidAt,
      domain: row.renewalDomain ?? row.itemDomain ?? row.orderDomain ?? "",
      kind,
      years: kind === "renew" ? (row.renewalYears ?? 1) : kind === "transfer" ? 1 : Math.max(1, row.quantity ?? 1),
      sale: money(row.sale),
      tld: kind === "renew" ? null : row.itemTld,
    };
  });

  const currencies = [...new Set(tlds.map((t) => t.costCurrency))];
  const rates = sales.length > 0 ? await loadRatesForRange(currencies, range.from, range.to) : [];
  return computeDomainMargins(sales, tlds, rates);
}
