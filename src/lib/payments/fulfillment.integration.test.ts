/**
 * Payment fulfilment against a real Postgres (real transactions, savepoints
 * and pg-boss outbox inserts). Reproduces the old failure — provisioning
 * throwing inside the payment transaction rolled back a charged payment — for
 * every gateway path, and checks idempotency.
 *
 * Skipped unless RUN_DB_TESTS=1; uses DATABASE_URL from .env (a local copy,
 * never production):
 *
 *   RUN_DB_TESTS=1 pnpm vitest run src/lib/payments/fulfillment.integration.test.ts
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const admin = vi.hoisted(() => ({ id: "" }));
const remote = vi.hoisted(() => ({
  createRemoteService: vi.fn(),
  registerDomainWithRegistrar: vi.fn(),
  provisionSslCertificate: vi.fn(),
}));

// Every remote integration fails loudly: if any of them ran inside the
// payment transaction, the payment would roll back.
vi.mock("@/lib/integrations/provisioning-provider", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/integrations/provisioning-provider")>()),
  createRemoteService: remote.createRemoteService,
}));
vi.mock("@/lib/integrations/registrar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/integrations/registrar")>()),
  registerDomainWithRegistrar: remote.registerDomainWithRegistrar,
}));
vi.mock("@/lib/integrations/ssl", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/integrations/ssl")>()),
  provisionSslCertificate: remote.provisionSslCertificate,
}));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ webhooks: { constructEvent: (body: string) => JSON.parse(body) } }),
  getAppBaseUrl: () => "http://localhost:3000",
}));
vi.mock("@/lib/utils/auth-helpers", () => ({
  requireAdmin: async () => ({ user: { id: admin.id } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { randomUUID } from "node:crypto";
import type { ProductCategorySlug } from "@prisma/client";
import { db } from "@/lib/db";
import { getBoss, stopBoss } from "@/lib/jobs/boss";
import { EFATURA_ISSUE_JOB, PAYMENT_SETTLED_JOB, PROVISIONING_RUN_JOB } from "@/lib/jobs/definitions";
import { netInvoiceLine } from "@/lib/billing/invoice-lines";
import { fulfillGatewayReference } from "./gateway-fulfillment";
import { runQueuedProvisioningJob } from "@/lib/provisioning/retry-queue";

const enabled = process.env.RUN_DB_TESTS === "1";
const tag = `itest-${randomUUID().slice(0, 8)}`;
let customerId = "";
const createdOrders: string[] = [];
const createdInvoices: string[] = [];

async function scenario(options: {
  slug: ProductCategorySlug;
  reference: string;
  provider: string;
  domain?: string | null;
  serviceId?: string;
  configuration?: Record<string, unknown>;
}) {
  const product = await db.product.findFirstOrThrow({ where: { category: { slug: options.slug } } });
  const suffix = randomUUID().slice(0, 8);
  const order = await db.order.create({
    data: {
      orderNumber: `${tag}-S-${suffix}`,
      customerId,
      productId: product.id,
      domain: options.domain ?? null,
      serviceId: options.serviceId,
      billingPeriod: "yearly",
      basePrice: 100,
      taxRate: 20,
      taxAmount: 20,
      totalAmount: 120,
      items: {
        create: {
          productName: product.name,
          productSku: product.sku,
          unitPrice: 100,
          totalPrice: 100,
          configuration: (options.configuration ?? { type: options.slug }) as object,
        },
      },
    },
  });
  const invoice = await db.invoice.create({
    data: {
      invoiceNumber: `${tag}-F-${suffix}`,
      customerId,
      orderId: order.id,
      subtotal: 100,
      taxRate: 20,
      taxAmount: 20,
      totalAmount: 120,
      dueDate: new Date(),
      items: { create: netInvoiceLine({ description: product.name, unitPrice: 100 }) },
    },
  });
  await db.payment.create({
    data: {
      invoiceId: invoice.id,
      customerId,
      amount: 120,
      method: "CREDIT_CARD",
      status: "PENDING",
      transactionId: options.reference,
      notes: `${options.provider} gateway_meta:${JSON.stringify({
        invoiceIds: [invoice.id],
        customerId,
        context: "cart",
        provider: options.provider,
      })}`,
    },
  });
  createdOrders.push(order.id);
  createdInvoices.push(invoice.id);
  return { order, invoice };
}

async function state(invoiceId: string, orderId: string) {
  const [invoice, payments, job, order] = await Promise.all([
    db.invoice.findUniqueOrThrow({ where: { id: invoiceId } }),
    db.payment.findMany({ where: { invoiceId } }),
    db.provisioningJob.findUnique({ where: { orderId } }),
    db.order.findUniqueOrThrow({ where: { id: orderId } }),
  ]);
  return { invoice, payments, job, order };
}

async function queueJobs(name: string, key: string) {
  const boss = await getBoss();
  return boss.findJobs(name, { key });
}

const ctx = (retryCount = 0) => ({ jobId: "itest", retryCount, retryLimit: 4, isFinalAttempt: retryCount >= 4 });

describe.runIf(enabled)("payment fulfilment (integration, real Postgres)", () => {
  beforeAll(async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    remote.createRemoteService.mockRejectedValue(new Error("WHM_HTTP_500"));
    remote.registerDomainWithRegistrar.mockRejectedValue(new Error("GRI_TIMEOUT"));
    remote.provisionSslCertificate.mockRejectedValue(new Error("SSL_VENDOR_DOWN"));
    await getBoss();
    const user = await db.user.create({
      data: { email: `${tag}@test.local`, password: "x", name: "Entegrasyon", surname: "Test" },
    });
    customerId = user.id;
    admin.id = (await db.user.findFirstOrThrow({ where: { role: "ADMIN" } })).id;
  });

  afterAll(async () => {
    if (customerId) {
      const boss = await getBoss();
      const jobs = await db.provisioningJob.findMany({ where: { orderId: { in: createdOrders } } });
      for (const job of jobs) {
        const queued = await boss.findJobs(PROVISIONING_RUN_JOB, { key: job.id });
        if (queued.length) await boss.deleteJob(PROVISIONING_RUN_JOB, queued.map((q) => q.id));
      }
      for (const invoiceId of createdInvoices) {
        for (const name of [EFATURA_ISSUE_JOB, PAYMENT_SETTLED_JOB]) {
          const queued = await boss.findJobs(name, { key: invoiceId });
          if (queued.length) await boss.deleteJob(name, queued.map((q) => q.id));
        }
      }
      await db.provisioningJob.deleteMany({ where: { orderId: { in: createdOrders } } });
      await db.orderActivity.deleteMany({ where: { orderId: { in: createdOrders } } });
      await db.payment.deleteMany({ where: { customerId } });
      await db.invoice.deleteMany({ where: { customerId } });
      await db.sslCertificate.deleteMany({ where: { customerId } });
      await db.domain.deleteMany({ where: { customerId } });
      await db.order.deleteMany({ where: { customerId } });
      await db.service.deleteMany({ where: { customerId } });
      await db.stripeWebhookEvent.deleteMany({ where: { eventId: { startsWith: tag } } });
      await db.activityLog.deleteMany({ where: { userId: { in: [customerId, admin.id] }, entityId: { in: createdInvoices } } });
      await db.user.delete({ where: { id: customerId } });
    }
    await stopBoss({ graceful: false });
  });

  for (const gateway of [
    { provider: "kuveytturk", notes: "Kuveyt Türk VPOS ödemesi", confirmation: { requestedAmount: 120, currency: "TRY" } },
    { provider: "iyzico", notes: "iyzico Checkout ödemesi", confirmation: { paidAmount: 120, requestedAmount: 120, currency: "TRY" } },
    { provider: "paytr", notes: "PayTR iframe ödemesi", confirmation: { paidAmount: 120, requestedAmount: 120, currency: "TL" } },
  ]) {
    it(`${gateway.provider}: an SSL order without a domain keeps the payment and parks a FAILED job`, async () => {
      const reference = `${tag}-${gateway.provider}-${randomUUID().slice(0, 6)}`;
      const { order, invoice } = await scenario({ slug: "ssl", reference, provider: gateway.provider });

      const result = await fulfillGatewayReference(reference, gateway.notes, gateway.confirmation);

      expect(result).toMatchObject({ fulfilled: true, invoiceIds: [invoice.id] });
      const after = await state(invoice.id, order.id);
      expect(after.invoice.status).toBe("PAID");
      expect(after.invoice.paidAmount.toFixed(2)).toBe("120.00");
      expect(after.payments).toEqual([expect.objectContaining({ status: "COMPLETED", transactionId: reference })]);
      expect(after.job).toMatchObject({ status: "FAILED", lastError: expect.stringMatching(/^DOMAIN_REQUIRED/) });
      expect(remote.provisionSslCertificate).not.toHaveBeenCalled();
      // e-invoice + notification were queued with the commit, exactly once.
      expect(await queueJobs(EFATURA_ISSUE_JOB, invoice.id)).toHaveLength(1);
      expect(await queueJobs(PAYMENT_SETTLED_JOB, invoice.id)).toHaveLength(1);

      // Callback retry: idempotent no-op.
      const again = await fulfillGatewayReference(reference, gateway.notes, gateway.confirmation);
      expect(again).toMatchObject({ fulfilled: false, skipped: true });
      expect((await state(invoice.id, order.id)).payments).toHaveLength(1);
    });
  }

  it("a hosting payment commits before WHM is called; the queued attempt fails and stays retrying", async () => {
    const reference = `${tag}-paytr-host`;
    const { order, invoice } = await scenario({
      slug: "hosting",
      reference,
      provider: "paytr",
      domain: "itest-hosting.com",
    });

    await fulfillGatewayReference(reference, "PayTR iframe ödemesi", { paidAmount: 120 });

    let after = await state(invoice.id, order.id);
    expect(after.invoice.status).toBe("PAID");
    expect(after.payments[0].status).toBe("COMPLETED");
    expect(after.order.status).toBe("COMPLETED");
    expect(after.order.serviceId).toBeTruthy();
    expect(after.job).toMatchObject({ kind: "PROVISION", status: "PENDING", serviceId: after.order.serviceId });
    expect(remote.createRemoteService).not.toHaveBeenCalled();
    expect(await queueJobs(PROVISIONING_RUN_JOB, after.job!.id)).toHaveLength(1);

    // What the worker does with that queue job: WHM fails → retry later.
    await expect(runQueuedProvisioningJob(after.job!.id, ctx(0))).rejects.toThrow("WHM_HTTP_500");
    after = await state(invoice.id, order.id);
    expect(after.job).toMatchObject({ status: "PENDING", attempts: 1, lastError: "WHM_HTTP_500" });
    expect(after.invoice.status).toBe("PAID");
  });

  it("concurrent callbacks of one session settle once (one payment, one job, one follow-up)", async () => {
    const reference = `${tag}-kt-race`;
    const { order, invoice } = await scenario({
      slug: "domain",
      reference,
      provider: "kuveytturk",
      domain: "itest-race-alan.com",
      configuration: { type: "domain", domain: "itest-race-alan.com" },
    });

    const results = await Promise.all([
      fulfillGatewayReference(reference, "Kuveyt Türk", { requestedAmount: 120 }),
      fulfillGatewayReference(reference, "Kuveyt Türk", { requestedAmount: 120 }),
    ]);

    expect(results.filter((result) => result.fulfilled)).toHaveLength(1);
    const after = await state(invoice.id, order.id);
    expect(after.payments.filter((payment) => payment.status === "COMPLETED")).toHaveLength(1);
    expect(after.job).toMatchObject({ kind: "PROVISION", status: "PENDING" });
    expect(await db.domain.findUnique({ where: { name: "itest-race-alan.com" } })).toMatchObject({ status: "PENDING" });
    expect(await queueJobs(PAYMENT_SETTLED_JOB, invoice.id)).toHaveLength(1);
    expect(remote.registerDomainWithRegistrar).not.toHaveBeenCalled();
  });

  it("stripe webhook: activation that throws is rolled back to a savepoint, the payment is kept", async () => {
    // Renewal of a service that no longer exists: applyServiceRenewalFromOrder
    // throws SERVICE_NOT_FOUND inside the payment transaction.
    const reference = `${tag}-cs_test`;
    const { order, invoice } = await scenario({
      slug: "hosting",
      reference,
      provider: "stripe",
      serviceId: `${tag}-missing-service`,
      configuration: { serviceId: `${tag}-missing-service`, renewalMonths: 12 },
    });
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    const { POST } = await import("@/app/api/payments/stripe/webhook/route");
    const event = {
      id: `${tag}-evt-1`,
      type: "checkout.session.completed",
      data: {
        object: {
          id: reference,
          payment_status: "paid",
          metadata: { customerId, invoiceIds: invoice.id },
        },
      },
    };
    const request = () =>
      new Request("http://localhost/api/payments/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=x" },
        body: JSON.stringify(event),
      });

    const response = await POST(request() as never);
    expect(response.status).toBe(200);

    const after = await state(invoice.id, order.id);
    expect(after.invoice.status).toBe("PAID");
    expect(after.payments[0]).toMatchObject({ status: "COMPLETED", transactionId: reference });
    expect(after.order.status).toBe("PROCESSING");
    expect(after.job).toMatchObject({
      status: "FAILED",
      lastError: expect.stringMatching(/^FULFILMENT_ERROR: SERVICE_NOT_FOUND/),
    });

    // Stripe retries the event: skipped.
    const replay = await POST(request() as never);
    expect(await replay.json()).toMatchObject({ skipped: true });

    // Admin "Yeniden dene" while the service is still missing: stays parked.
    const { manualRetryProvisioningJob } = await import("@/lib/provisioning/retry-queue");
    await expect(manualRetryProvisioningJob(after.job!.id)).resolves.toMatchObject({ ok: false });
    expect((await state(invoice.id, order.id)).job).toMatchObject({
      status: "FAILED",
      lastError: expect.stringMatching(/^FULFILMENT_ERROR: SERVICE_NOT_FOUND/),
    });

    // Admin restores the service and retries: the renewal is applied once.
    await db.service.create({
      data: {
        id: `${tag}-missing-service`,
        customerId,
        productId: order.productId,
        label: "Geri yüklenen hizmet",
        billingPeriod: "yearly",
        amount: 100,
        status: "ACTIVE",
        nextDueDate: new Date("2027-01-01T00:00:00Z"),
      },
    });
    await expect(manualRetryProvisioningJob(after.job!.id)).resolves.toEqual({ ok: true });
    const fixed = await state(invoice.id, order.id);
    expect(fixed.order.status).toBe("COMPLETED");
    expect(fixed.job).toMatchObject({ status: "COMPLETED" });
    const service = await db.service.findUniqueOrThrow({ where: { id: `${tag}-missing-service` } });
    expect(service.nextDueDate?.toISOString()).toBe("2028-01-01T00:00:00.000Z");
    expect(remote.createRemoteService).not.toHaveBeenCalled();
  });

  it("admin 'ödendi': payment recorded, registrar failure stays on the queued job", async () => {
    const { order, invoice } = await scenario({
      slug: "domain",
      reference: `${tag}-admin`,
      provider: "manual",
      domain: "itest-admin-alan.com.tr",
      configuration: { type: "domain", domain: "itest-admin-alan.com.tr" },
    });
    const { markPaid } = await import("@/lib/actions/admin/invoices");

    await expect(markPaid(invoice.id)).resolves.toMatchObject({ success: true });

    let after = await state(invoice.id, order.id);
    expect(after.invoice.status).toBe("PAID");
    expect(after.payments[0].status).toBe("COMPLETED");
    expect(after.job).toMatchObject({ status: "PENDING" });

    await expect(runQueuedProvisioningJob(after.job!.id, ctx(4))).rejects.toThrow("GRI_TIMEOUT");
    after = await state(invoice.id, order.id);
    expect(after.job).toMatchObject({ status: "FAILED", lastError: "GRI_TIMEOUT" });
    expect(after.invoice.status).toBe("PAID");
  });
});
