import { generateDomainRenewalInvoices } from "@/lib/domains/renewal-invoices";
import { reconcileDomainRenewals } from "@/lib/domains/renew";
import { sendDomainExpiryNotices } from "@/lib/domains/notices";
import { syncDomainsWithRegistrar } from "@/lib/domains/sync";

/**
 * Domain lifecycle cron jobs (roadmap 1.2 + 1.3). Each runs under the cron
 * advisory lock + CronRun record (src/lib/cron/handler.ts) and is idempotent.
 */

/** `domain-renewals`: renewal invoices N days before expiry + paid-renewal outbox reconcile. */
export async function runDomainRenewals() {
  const invoices = await generateDomainRenewalInvoices();
  const queue = await reconcileDomainRenewals();
  return { ...invoices, queue };
}

/** `domain-notices`: expiry notices (30/7/1, expired, grace, redemption). */
export async function runDomainNotices() {
  return sendDomainExpiryNotices();
}

/** `domain-sync`: Gri status/expiry/nameserver sync. */
export async function runDomainSync() {
  return syncDomainsWithRegistrar();
}
