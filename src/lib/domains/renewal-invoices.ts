import type { DomainRenewal, InvoiceStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { calculateTax, getTaxRate } from "@/lib/billing/tax";
import { matchDomainTld } from "@/lib/domains/transfer-pricing";
import { isPositive, roundHalfUp, type MoneyInput } from "@/lib/money";
import { generateInvoiceNumber } from "@/lib/utils/number-generators";
import { formatDate } from "@/lib/format/date";
import { sendNotification } from "@/lib/notifications/send";
import type { CronJobResult } from "@/lib/cron/jobs/types";
import {
  DAY_MS,
  domainLog,
  getDomainLifecycleSettings,
  isUniqueViolation,
  recordDomainEvent,
} from "./lifecycle";

/**
 * Renewal invoices for domains (roadmap 1.2). A DomainRenewal row binds the
 * invoice to one renewal period of one domain; `(domainId, periodStart)` is
 * unique, so however often the cron or the customer's "Şimdi yenile" runs, a
 * period has at most one renewal (and therefore one open invoice).
 *
 * The invoice has no Order on purpose: a paid order would go through
 * provisionCompletedOrder (domain *registration*). Payment is routed to the
 * registrar renew by `onDomainRenewalPaid` (renew.ts) via the renewal row.
 */

export const OPEN_INVOICE_STATUSES: InvoiceStatus[] = ["DRAFT", "PENDING", "OVERDUE"];

export type RenewalSource = "cron" | "customer" | "admin";

export type RenewalInvoiceSkipReason =
  | "NO_TLD_PRICE"
  | "RENEWAL_IN_PROGRESS"
  | "RENEWAL_FAILED"
  | "INVOICE_CANCELLED"
  | "CONCURRENT";

export type RenewalInvoiceResult =
  | { status: "created"; invoiceId: string; renewalId: string }
  | { status: "existing"; invoiceId: string; renewalId: string }
  | { status: "skipped"; reason: RenewalInvoiceSkipReason; invoiceId?: string | null; renewalId?: string };

export interface RenewableDomain {
  id: string;
  name: string;
  customerId: string;
  expiresAt: Date;
}

interface TldPrice {
  ext: string;
  transferPrice: MoneyInput;
  renewPrice: MoneyInput;
}

export interface CreateRenewalInvoiceOptions {
  source: RenewalSource;
  /** Replace a cancelled invoice of this period with a new one (customer/admin request). */
  reopenCancelled?: boolean;
  years?: number;
  actorId?: string | null;
  /** Preloaded for batch runs. */
  taxRate?: number;
  tlds?: TldPrice[];
  now?: Date;
}

type RenewalWithInvoice = DomainRenewal & { invoice: { id: string; status: InvoiceStatus } | null };

async function loadActiveTlds(): Promise<TldPrice[]> {
  return db.domainTld.findMany({
    where: { isActive: true },
    select: { ext: true, transferPrice: true, renewPrice: true },
  });
}

/** What an existing renewal row of the period means for a new invoice request. */
export function classifyExistingRenewal(
  renewal: RenewalWithInvoice,
  reopenCancelled: boolean
): RenewalInvoiceResult | "reopen" {
  const base = { renewalId: renewal.id, invoiceId: renewal.invoiceId };

  if (renewal.status === "PAID" || renewal.status === "PROCESSING" || renewal.status === "COMPLETED") {
    return { status: "skipped", reason: "RENEWAL_IN_PROGRESS", ...base };
  }
  if (renewal.status === "FAILED") {
    return { status: "skipped", reason: "RENEWAL_FAILED", ...base };
  }

  const invoice = renewal.invoice;
  if (renewal.status === "PENDING" && invoice && OPEN_INVOICE_STATUSES.includes(invoice.status)) {
    return { status: "existing", invoiceId: invoice.id, renewalId: renewal.id };
  }
  if (renewal.status === "PENDING" && invoice?.status === "PAID") {
    // Paid but not routed yet; the domain-renewals cron reconciles it.
    return { status: "skipped", reason: "RENEWAL_IN_PROGRESS", ...base };
  }

  // CANCELLED, or PENDING whose invoice was cancelled/deleted.
  return reopenCancelled ? "reopen" : { status: "skipped", reason: "INVOICE_CANCELLED", ...base };
}

export function renewalItemDescription(domainName: string, years: number) {
  return `${domainName} alan adı yenileme (${years} yıl)`;
}

/**
 * Issues (or returns) the renewal invoice for the domain's current period
 * (periodStart = domain.expiresAt). Idempotent: the unique key makes a
 * concurrent second insert fail, which rolls back its invoice as well.
 */
export async function createDomainRenewalInvoice(
  domain: RenewableDomain,
  options: CreateRenewalInvoiceOptions
): Promise<RenewalInvoiceResult> {
  const now = options.now ?? new Date();
  const years = Math.max(1, Math.round(options.years ?? 1));
  const periodStart = domain.expiresAt;
  const periodKey = { domainId_periodStart: { domainId: domain.id, periodStart } };

  const existing = await db.domainRenewal.findUnique({
    where: periodKey,
    include: { invoice: { select: { id: true, status: true } } },
  });

  if (existing) {
    const decision = classifyExistingRenewal(existing, options.reopenCancelled ?? false);
    if (decision !== "reopen") return decision;
  }

  const tlds = options.tlds ?? (await loadActiveTlds());
  const tld = matchDomainTld(domain.name, tlds) as TldPrice | null;
  if (!tld || !isPositive(tld.renewPrice)) {
    domainLog.warn("no renewal price for domain TLD", { domain: domain.name });
    return { status: "skipped", reason: "NO_TLD_PRICE" };
  }

  const taxRate = options.taxRate ?? (await getTaxRate());
  // KDV-exclusive TLD price × years; Decimal maths inside calculateTax.
  const subtotal = roundHalfUp(tld.renewPrice).times(years);
  const taxed = calculateTax(subtotal, taxRate);
  const dueDate = periodStart > now ? periodStart : now;
  const description = renewalItemDescription(domain.name, years);
  const invoiceNumber = await generateInvoiceNumber();

  try {
    const created = await db.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          customerId: domain.customerId,
          subtotal: taxed.subtotal,
          taxRate: taxed.taxRate,
          taxAmount: taxed.taxAmount,
          totalAmount: taxed.totalAmount,
          status: "PENDING",
          dueDate,
          notes: `Alan adı yenileme: ${domain.name} (${years} yıl, mevcut bitiş ${formatDate(periodStart)})`,
          items: {
            create: {
              description,
              quantity: 1,
              unitPrice: taxed.subtotal,
              totalPrice: taxed.subtotal,
            },
          },
        },
        select: { id: true, invoiceNumber: true },
      });

      const renewal = existing
        ? await tx.domainRenewal.update({
            where: { id: existing.id },
            data: {
              invoiceId: invoice.id,
              status: "PENDING",
              source: options.source,
              years,
              attempts: 0,
              lastError: null,
            },
          })
        : await tx.domainRenewal.create({
            data: {
              domainId: domain.id,
              invoiceId: invoice.id,
              periodStart,
              years,
              source: options.source,
            },
          });

      await recordDomainEvent(
        {
          domainId: domain.id,
          type: "renewal.invoice_created",
          message: `Yenileme faturası oluşturuldu: ${invoice.invoiceNumber} (${years} yıl)`,
          details: { invoiceId: invoice.id, renewalId: renewal.id, source: options.source, totalAmount: taxed.totalAmount },
          actorId: options.actorId,
        },
        tx
      );

      return { invoiceId: invoice.id, renewalId: renewal.id, invoiceNumber: invoice.invoiceNumber };
    });

    return { status: "created", invoiceId: created.invoiceId, renewalId: created.renewalId };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    // Another run created this period's renewal first: report theirs.
    const winner = await db.domainRenewal.findUnique({
      where: periodKey,
      include: { invoice: { select: { id: true, status: true } } },
    });
    if (winner?.invoice && winner.status === "PENDING") {
      return { status: "existing", invoiceId: winner.invoice.id, renewalId: winner.id };
    }
    return { status: "skipped", reason: "CONCURRENT", renewalId: winner?.id };
  }
}

async function notifyRenewalInvoice(domain: RenewableDomain, invoiceId: string) {
  try {
    await sendNotification({
      userId: domain.customerId,
      template: "domain.renewal_invoice",
      data: {
        domainId: domain.id,
        domain: domain.name,
        invoiceId,
        expiresAt: domain.expiresAt.toISOString(),
        title: "Alan adı yenileme faturası",
        message: `${domain.name} için yenileme faturanız oluşturuldu. Alan adınızın süresi ${formatDate(domain.expiresAt)} tarihinde doluyor.`,
        link: `/musteri/panel/faturalar/${invoiceId}`,
      },
    });
  } catch (error) {
    domainLog.error("renewal invoice notification could not be queued", { domainId: domain.id, error });
  }
}

/**
 * Daily: renewal invoice for every ACTIVE, auto-renewing domain that expires
 * within `domain_renewal_invoice_days` (default 30). Domains already past
 * expiry but still in the grace period are included (cron outage catch-up).
 */
export async function generateDomainRenewalInvoices(now = new Date()): Promise<CronJobResult & Record<string, unknown>> {
  const settings = await getDomainLifecycleSettings();
  const windowEnd = new Date(now.getTime() + settings.renewalInvoiceDays * DAY_MS);
  const graceStart = new Date(now.getTime() - settings.graceDays * DAY_MS);

  const domains = await db.domain.findMany({
    where: {
      status: "ACTIVE",
      autoRenew: true,
      expiresAt: { lte: windowEnd, gte: graceStart },
    },
    select: { id: true, name: true, customerId: true, expiresAt: true },
    orderBy: { expiresAt: "asc" },
  });

  const ids: string[] = [];
  const skippedReasons: Record<string, number> = {};
  let existing = 0;

  if (domains.length === 0) {
    return { processed: 0, skipped: 0, existing: 0, ids, windowDays: settings.renewalInvoiceDays };
  }

  const [taxRate, tlds] = await Promise.all([getTaxRate(), loadActiveTlds()]);

  for (const domain of domains) {
    try {
      const result = await createDomainRenewalInvoice(domain, { source: "cron", taxRate, tlds, now });
      if (result.status === "created") {
        ids.push(result.invoiceId);
        await notifyRenewalInvoice(domain, result.invoiceId);
      } else if (result.status === "existing") {
        existing += 1;
      } else {
        skippedReasons[result.reason] = (skippedReasons[result.reason] ?? 0) + 1;
      }
    } catch (error) {
      skippedReasons.ERROR = (skippedReasons.ERROR ?? 0) + 1;
      domainLog.error("renewal invoice could not be created", { domainId: domain.id, error });
    }
  }

  const skipped = Object.values(skippedReasons).reduce((total, count) => total + count, 0);
  return {
    processed: ids.length,
    skipped,
    existing,
    skippedReasons,
    ids,
    windowDays: settings.renewalInvoiceDays,
  };
}
