/**
 * Roadmap acceptance (1.2) against a real Postgres + pg-boss:
 *   a domain expiring in 30 days gets exactly one renewal invoice even when
 *   the domain-renewals cron runs twice; paying it enqueues domain.renew, which
 *   calls the registrar (mocked Gri) and moves expiresAt one year forward.
 *
 * Skipped unless RUN_DB_TESTS=1; uses DATABASE_URL from .env — point it at a
 * local/dev database, never production:
 *
 *   RUN_DB_TESTS=1 pnpm vitest run src/lib/domains/lifecycle.integration.test.ts
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  renewDomainWithRegistrar: vi.fn(),
  getDomainInfoFromRegistrar: vi.fn(),
}));

// Mocked Gri, and no outbound side effects (webhooks, e-fatura, notifications).
vi.mock("@/lib/integrations/registrar", () => ({
  renewDomainWithRegistrar: mocks.renewDomainWithRegistrar,
  getDomainInfoFromRegistrar: mocks.getDomainInfoFromRegistrar,
}));
vi.mock("@/lib/events/dispatcher", () => ({ dispatchEvents: vi.fn() }));
vi.mock("@/lib/integrations/efatura", () => ({ queueEInvoiceDraft: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/notifications/send", () => ({ sendNotification: vi.fn().mockResolvedValue({ id: null }) }));

import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { runCronWithLock } from "@/lib/cron/run-log";
import { runDomainRenewals } from "@/lib/cron/jobs/domain-lifecycle";
import { getBoss, stopBoss } from "@/lib/jobs/boss";
import { DOMAIN_RENEW_JOB } from "@/lib/jobs/definitions";
import { drainJobs } from "@/lib/jobs/worker";
import { fulfillInvoicePayment } from "@/lib/payments/fulfillment";

const enabled = process.env.RUN_DB_TESTS === "1";
const DAY = 86_400_000;

describe.runIf(enabled)("domain lifecycle (integration, real Postgres)", () => {
  const name = `itest-${randomUUID().slice(0, 8)}.com`;
  const createdInvoiceIds: string[] = [];
  let domainId = "";
  let expiresAt: Date;

  beforeAll(async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const customer = await db.user.findFirstOrThrow({ where: { role: "CUSTOMER" }, select: { id: true } });
    expiresAt = new Date(Date.now() + 30 * DAY);
    const domain = await db.domain.create({
      data: { name, customerId: customer.id, expiresAt, status: "ACTIVE", autoRenew: true, registrar: "gri" },
    });
    domainId = domain.id;
    await getBoss();
  });

  afterAll(async () => {
    const renewals = await db.domainRenewal.findMany({ where: { domainId }, select: { id: true } });
    const boss = await getBoss();
    for (const renewal of renewals) {
      const jobs = await boss.findJobs(DOMAIN_RENEW_JOB, { key: renewal.id });
      if (jobs.length) await boss.deleteJob(DOMAIN_RENEW_JOB, jobs.map((job) => job.id));
    }
    await db.domainRenewal.deleteMany({ where: { invoiceId: { in: createdInvoiceIds } } });
    await db.payment.deleteMany({ where: { invoiceId: { in: createdInvoiceIds } } });
    await db.invoice.deleteMany({ where: { id: { in: createdInvoiceIds } } });
    await db.domain.deleteMany({ where: { id: domainId } });
    await db.cronRun.deleteMany({ where: { job: "itest-domain-renewals" } });
    await stopBoss({ graceful: false });
  });

  it("issues exactly one renewal invoice even when the cron runs twice", async () => {
    const first = await runCronWithLock("itest-domain-renewals", runDomainRenewals);
    const second = await runCronWithLock("itest-domain-renewals", runDomainRenewals);
    for (const outcome of [first, second]) {
      if (outcome.status === "succeeded") createdInvoiceIds.push(...(outcome.result.ids ?? []));
    }

    const renewals = await db.domainRenewal.findMany({
      where: { domainId },
      include: { invoice: { include: { items: true } } },
    });
    expect(renewals).toHaveLength(1);
    expect(renewals[0].periodStart.getTime()).toBe(expiresAt.getTime());
    expect(renewals[0].invoice?.status).toBe("PENDING");
    expect(renewals[0].invoice?.items[0].description).toBe(`${name} alan adı yenileme (1 yıl)`);
    expect(await db.invoice.count({ where: { domainRenewal: { domainId } } })).toBe(1);
    expect(second.status === "succeeded" && second.result.ids).not.toContain(renewals[0].invoiceId);
  });

  it("after payment renews at the registrar and moves expiresAt +1 year", async () => {
    const renewal = await db.domainRenewal.findFirstOrThrow({ where: { domainId } });
    mocks.renewDomainWithRegistrar.mockResolvedValue({ ok: true, provider: "gri", data: { expiresAt: null } });

    await db.$transaction((tx) =>
      fulfillInvoicePayment(tx, { invoiceId: renewal.invoiceId!, performedBy: "itest" })
    );

    expect((await db.domainRenewal.findUniqueOrThrow({ where: { id: renewal.id } })).status).toBe("PAID");
    const boss = await getBoss();
    expect(await boss.findJobs(DOMAIN_RENEW_JOB, { key: renewal.id })).toHaveLength(1);

    await drainJobs({ names: [DOMAIN_RENEW_JOB], budgetMs: 10_000 });

    expect(mocks.renewDomainWithRegistrar).toHaveBeenCalledWith({ domain: name, years: 1 });
    const domain = await db.domain.findUniqueOrThrow({ where: { id: domainId } });
    const expected = new Date(expiresAt);
    expected.setUTCFullYear(expected.getUTCFullYear() + 1);
    expect(domain.expiresAt.getTime()).toBe(expected.getTime());
    const done = await db.domainRenewal.findUniqueOrThrow({ where: { id: renewal.id } });
    expect(done).toMatchObject({ status: "COMPLETED", attempts: 1 });
    expect(
      await db.domainLifecycleEvent.count({ where: { domainId, type: "renewal.completed" } })
    ).toBe(1);

    // The next period has no renewal yet, and the old one is never billed again.
    await runCronWithLock("itest-domain-renewals", runDomainRenewals);
    expect(await db.domainRenewal.count({ where: { domainId } })).toBe(1);
  });
});
