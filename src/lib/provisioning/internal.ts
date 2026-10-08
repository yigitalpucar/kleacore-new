import type { BillingPeriod, Prisma } from "@prisma/client";
import type { db } from "@/lib/db";
import {
  registerDomainWithRegistrar,
  transferDomainWithRegistrar,
} from "@/lib/integrations/registrar";
import { mapProductSubTypeToSslType } from "@/lib/integrations/ssl";
import { queueProvisioningAttempt } from "@/lib/provisioning/queue";
import { decryptSecret } from "@/lib/secrets/crypto";
import { checkDomainName } from "@/lib/validations/domain-name";

const billingMonths: Record<BillingPeriod, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  yearly: 12,
  biennial: 24,
  triennial: 36,
};

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function makeServiceUsername(orderNumber: string) {
  return orderNumber.toLowerCase().replace(/[^a-z0-9]/g, "").slice(-12);
}

export const DEFAULT_NAMESERVERS = ["ns1.kleacore.com", "ns2.kleacore.com"];

type DbClient = Prisma.TransactionClient | typeof db;

type DomainOrder = Prisma.OrderGetPayload<{ include: { customer: true; items: true } }>;

type ProvisioningOrder = {
  domain: string | null;
  product: { sku: string; subType: string | null; category: { slug: string } };
  items: Array<{ configuration: unknown }>;
};

function orderItemConfig(order: { items: Array<{ configuration: unknown }> }) {
  const firstItemConfig = order.items[0]?.configuration;
  return firstItemConfig && typeof firstItemConfig === "object" && !Array.isArray(firstItemConfig)
    ? (firstItemConfig as Record<string, unknown>)
    : {};
}

/** Wildcard certificates accept a "*.example.com" common name. */
export function sslAllowsWildcard(product: { sku: string; subType: string | null }) {
  return product.subType === "wildcard" || /(^|-)WC(-|$)/i.test(product.sku);
}

/**
 * The domain a paid order provisions and whether it is usable. Domain and
 * SSL orders can't be provisioned without one; checkout rejects such carts
 * (src/lib/checkout/validate-cart.ts), this re-checks old or hand-made orders.
 */
export function resolveProvisioningDomain(
  order: ProvisioningOrder
): { required: boolean; domain: string | null; error?: string } {
  const config = orderItemConfig(order);
  const raw = (typeof config.domain === "string" && config.domain.trim()) || order.domain || null;
  const slug = order.product.category.slug;
  const required = slug === "domain" || slug === "ssl";

  if (!raw) {
    return required
      ? {
          required,
          domain: null,
          error:
            slug === "ssl"
              ? "DOMAIN_REQUIRED: SSL siparişinde alan adı yok. Siparişe alan adı ekleyip yeniden deneyin."
              : "DOMAIN_REQUIRED: Alan adı siparişinde alan adı yok.",
        }
      : { required, domain: null };
  }

  const check = checkDomainName(raw, {
    allowWildcard: slug === "ssl" && sslAllowsWildcard(order.product),
  });
  if (!check.ok) {
    return required
      ? { required, domain: null, error: `DOMAIN_INVALID: ${check.message}. Siparişi düzeltip yeniden deneyin.` }
      : { required, domain: null };
  }

  return { required, domain: check.domain };
}

/**
 * Registers (or, for a transfer order, starts the transfer of) a paid domain
 * and marks it ACTIVE / TRANSFERRING only when the registrar accepted it.
 * Runs in the provisioning.run job, never inside the payment transaction. A
 * skipped result means the registrar is disabled: nothing was registered.
 */
export async function submitDomainToRegistrar(
  client: DbClient,
  order: DomainOrder,
  domain: string
) {
  const config = orderItemConfig(order);
  const isTransfer = config.type === "domain_transfer";

  const registrarResult = isTransfer
    ? await transferDomainWithRegistrar({
        domain,
        eppCode: decryptSecret(typeof config.eppCode === "string" ? config.eppCode : ""),
        customer: { ...order.customer, country: order.customer.country ?? "TR" },
      })
    : await registerDomainWithRegistrar({
        domain,
        years: Math.max(1, Math.round((billingMonths[order.billingPeriod] ?? 12) / 12)),
        nameservers: DEFAULT_NAMESERVERS,
        customer: order.customer,
      });

  if (registrarResult.ok && !registrarResult.skipped) {
    await client.domain.update({
      where: { name: domain },
      data: {
        registrar: registrarResult.provider ?? "Gri",
        status: isTransfer ? "TRANSFERRING" : "ACTIVE",
      },
    });
  }

  return registrarResult;
}

/**
 * The customer's domain row, PENDING until the registrar confirms. Created at
 * payment time and again by the job if an admin fixed the order's domain.
 */
export async function upsertPendingDomain(
  client: DbClient,
  order: { customerId: string; billingPeriod: BillingPeriod },
  domain: string
) {
  const now = new Date();
  const expiresAt = addMonths(now, billingMonths[order.billingPeriod] ?? 12);

  return client.domain.upsert({
    where: { name: domain },
    update: {
      customerId: order.customerId,
      status: "PENDING",
      expiresAt,
    },
    create: {
      customerId: order.customerId,
      name: domain,
      registrar: "Gri",
      registeredAt: now,
      expiresAt,
      status: "PENDING",
      nameservers: DEFAULT_NAMESERVERS,
    },
  });
}

/**
 * Writes the order's PROVISION job (PENDING) and queues a provisioning.run
 * attempt in the same transaction, so the remote work starts only after the
 * payment committed — and is never lost if it did.
 */
async function scheduleProvisioning(
  tx: Prisma.TransactionClient,
  orderId: string,
  serviceId?: string
) {
  const now = new Date();
  const job = await tx.provisioningJob.upsert({
    where: { orderId },
    create: { orderId, serviceId, kind: "PROVISION", status: "PENDING", attempts: 0, nextRetryAt: now },
    update: {
      serviceId,
      kind: "PROVISION",
      status: "PENDING",
      attempts: 0,
      lastError: null,
      nextRetryAt: now,
      completedAt: null,
    },
  });
  await queueProvisioningAttempt(tx, job);
  return job;
}

/**
 * Bad order data found after payment (e.g. an SSL order without a domain):
 * the payment stays recorded, the job is FAILED with the reason so it shows
 * up on /yonetim/provisioning, and nothing is queued until an admin fixes the
 * order and presses "Yeniden dene".
 */
async function recordProvisioningNeedsAction(
  tx: Prisma.TransactionClient,
  orderId: string,
  error: string
) {
  const now = new Date();
  return tx.provisioningJob.upsert({
    where: { orderId },
    create: { orderId, kind: "PROVISION", status: "FAILED", attempts: 0, lastError: error, nextRetryAt: now },
    update: { kind: "PROVISION", status: "FAILED", lastError: error, nextRetryAt: now, completedAt: null },
  });
}

export type PreparedProvisioning =
  | { type: "domain" | "ssl" | "service"; identifier: string; status: "QUEUED"; jobId: string }
  | { type: "service"; identifier: string; status: "EXISTING" }
  | { type: "domain" | "ssl"; identifier: null; status: "NEEDS_ACTION"; jobId: string; error: string };

/**
 * Local half of provisioning a paid order, run inside the payment
 * transaction: creates the customer's records (domain PENDING, SSL
 * certificate PENDING, service ACTIVE) and a PROVISION job. Never calls a
 * registrar, SSL vendor or WHM, and never throws for bad order data — the
 * remote half runs in the provisioning.run job after commit
 * (retry-queue.ts → executeProvisioningJob), with retries.
 */
export async function prepareOrderProvisioning(
  tx: Prisma.TransactionClient,
  orderId: string
): Promise<PreparedProvisioning> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: {
      product: { include: { category: true } },
      items: true,
    },
  });

  if (!order) {
    throw new Error("ORDER_NOT_FOUND");
  }

  const slug = order.product.category.slug;
  const resolved = resolveProvisioningDomain(order);

  if (slug === "domain" || slug === "ssl") {
    if (!resolved.domain) {
      const error = resolved.error ?? "DOMAIN_REQUIRED";
      const job = await recordProvisioningNeedsAction(tx, order.id, error);
      return { type: slug, identifier: null, status: "NEEDS_ACTION", jobId: job.id, error };
    }

    if (slug === "domain") {
      await upsertPendingDomain(tx, order, resolved.domain);
      const job = await scheduleProvisioning(tx, order.id);
      return { type: "domain", identifier: resolved.domain, status: "QUEUED", jobId: job.id };
    }

    const certificate = await tx.sslCertificate.create({
      data: {
        customerId: order.customerId,
        domain: resolved.domain,
        type: mapProductSubTypeToSslType(order.product.subType),
        status: "PENDING",
      },
    });
    const job = await scheduleProvisioning(tx, order.id);
    return { type: "ssl", identifier: certificate.id, status: "QUEUED", jobId: job.id };
  }

  if (order.serviceId) {
    return { type: "service", identifier: order.serviceId, status: "EXISTING" };
  }

  const service = await createServiceForOrder(tx, order, resolved.domain);
  const job = await scheduleProvisioning(tx, order.id, service.id);
  return { type: "service", identifier: service.id, status: "QUEUED", jobId: job.id };
}

/** The customer's service row for a paid hosting/server order (local only). */
export async function createServiceForOrder(
  client: DbClient,
  order: {
    id: string;
    orderNumber: string;
    customerId: string;
    productId: string;
    billingPeriod: BillingPeriod;
    basePrice: Prisma.Decimal;
    product: { name: string };
  },
  domain: string | null
) {
  const expiresAt = addMonths(new Date(), billingMonths[order.billingPeriod] ?? 1);

  const service = await client.service.create({
    data: {
      customerId: order.customerId,
      productId: order.productId,
      label: order.product.name,
      domain,
      username: makeServiceUsername(order.orderNumber),
      billingPeriod: order.billingPeriod,
      // Recurring amount = pre-tax list price for one billing period. KDV is
      // added again by every renewal (cron + renewService), so storing the
      // tax-inclusive total here would charge KDV twice on renewal.
      amount: order.basePrice,
      nextDueDate: expiresAt,
      expiresAt,
      status: "ACTIVE",
    },
  });

  await client.order.update({
    where: { id: order.id },
    data: { serviceId: service.id },
  });

  return service;
}
