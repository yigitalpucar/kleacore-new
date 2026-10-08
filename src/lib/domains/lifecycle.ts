import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSettingMap } from "@/lib/integrations/settings";
import { createLogger } from "@/lib/logger";

/**
 * Shared pieces of the domain lifecycle (renewal invoices, registrar renew,
 * expiry notices, registrar sync): settings, lifecycle events, date helpers.
 */

const log = createLogger("domains");

export const DAY_MS = 86_400_000;

export type DbClient = Prisma.TransactionClient | typeof db;

export interface DomainLifecycleSettings {
  /** Days before expiresAt the renewal invoice is issued (`domain_renewal_invoice_days`). */
  renewalInvoiceDays: number;
  /** Registrar grace period after expiry, renewable at the normal price (`domain_grace_days`). */
  graceDays: number;
  /** Redemption period after grace, restore needs a fee (`domain_redemption_days`). */
  redemptionDays: number;
}

export const DEFAULT_LIFECYCLE_SETTINGS: DomainLifecycleSettings = {
  renewalInvoiceDays: 30,
  graceDays: 30,
  redemptionDays: 30,
};

function parseDays(value: string | undefined, fallback: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= max ? parsed : fallback;
}

export async function getDomainLifecycleSettings(): Promise<DomainLifecycleSettings> {
  const settings = await getSettingMap([
    { key: "domain_renewal_invoice_days", env: "DOMAIN_RENEWAL_INVOICE_DAYS" },
    { key: "domain_grace_days", env: "DOMAIN_GRACE_DAYS" },
    { key: "domain_redemption_days", env: "DOMAIN_REDEMPTION_DAYS" },
  ]);

  return {
    renewalInvoiceDays: parseDays(settings.domain_renewal_invoice_days, DEFAULT_LIFECYCLE_SETTINGS.renewalInvoiceDays, 365),
    graceDays: parseDays(settings.domain_grace_days, DEFAULT_LIFECYCLE_SETTINGS.graceDays, 120),
    redemptionDays: parseDays(settings.domain_redemption_days, DEFAULT_LIFECYCLE_SETTINGS.redemptionDays, 120),
  };
}

export function addYears(date: Date, years: number) {
  const next = new Date(date);
  next.setUTCFullYear(next.getUTCFullYear() + years);
  return next;
}

export type DomainEventType =
  | "renewal.invoice_created"
  | "renewal.paid"
  | "renewal.completed"
  | "renewal.attempt_failed"
  | "renewal.failed"
  | "renewal.manual"
  | "auto_renew.changed"
  | "status.expired"
  | "notice.sent"
  | "sync.updated"
  | "sync.failed";

export interface DomainEventInput {
  domainId: string;
  type: DomainEventType;
  message: string;
  details?: Prisma.InputJsonValue;
  actorId?: string | null;
}

/** Appends to the admin-visible lifecycle history. Never throws (history must not break the flow). */
export async function recordDomainEvent(input: DomainEventInput, client: DbClient = db) {
  try {
    await client.domainLifecycleEvent.create({
      data: {
        domainId: input.domainId,
        type: input.type,
        message: input.message,
        details: input.details,
        actorId: input.actorId ?? null,
      },
    });
  } catch (error) {
    log.error("domain lifecycle event could not be recorded", { domainId: input.domainId, type: input.type, error });
  }
}

export function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && (error as { code?: string }).code === "P2002");
}

export { log as domainLog };
