import type { BillingPeriod, Prisma } from "@prisma/client";
import type { db } from "@/lib/db";
import {
  registerDomainWithRegistrar,
  transferDomainWithRegistrar,
} from "@/lib/integrations/registrar";
import { createRemoteService } from "@/lib/integrations/provisioning-provider";
import {
  mapProductSubTypeToSslType,
  provisionSslCertificate,
  serializeSslProvisionResult,
} from "@/lib/integrations/ssl";
import { enqueueProvisioningRetry } from "@/lib/provisioning/retry-queue";
import { decryptSecret } from "@/lib/secrets/crypto";

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

function normalizeDomain(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}

function makeServiceUsername(orderNumber: string) {
  return orderNumber.toLowerCase().replace(/[^a-z0-9]/g, "").slice(-12);
}

const DEFAULT_NAMESERVERS = ["ns1.kleacore.com", "ns2.kleacore.com"];

type DbClient = Prisma.TransactionClient | typeof db;

type DomainOrder = Prisma.OrderGetPayload<{ include: { customer: true; items: true } }>;

function orderItemConfig(order: { items: Array<{ configuration: unknown }> }) {
  const firstItemConfig = order.items[0]?.configuration;
  return firstItemConfig && typeof firstItemConfig === "object" && !Array.isArray(firstItemConfig)
    ? (firstItemConfig as Record<string, unknown>)
    : {};
}

/**
 * Registers (or, for a transfer order, starts the transfer of) a paid domain
 * and marks it ACTIVE / TRANSFERRING only when the registrar accepted it.
 * Shared by first provisioning and the retry queue. A skipped result means
 * the registrar is disabled: nothing was registered.
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

export async function provisionCompletedOrder(
  tx: Prisma.TransactionClient,
  orderId: string
) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: {
      product: {
        include: {
          category: true,
        },
      },
      customer: true,
      items: true,
    },
  });

  if (!order) {
    throw new Error("ORDER_NOT_FOUND");
  }

  const now = new Date();
  const expiresAt = addMonths(now, billingMonths[order.billingPeriod] ?? 1);
  const domain = normalizeDomain(order.domain);
  const config = orderItemConfig(order);
  const configuredDomain =
    normalizeDomain(typeof config.domain === "string" ? config.domain : undefined) ?? domain;

  if (order.product.category.slug === "domain") {
    if (!configuredDomain) {
      throw new Error("DOMAIN_REQUIRED");
    }

    // The domain only becomes ACTIVE once the registrar confirmed it. Until
    // then it stays PENDING so a disabled or failing registrar never shows
    // the customer a domain that was not actually registered.
    await tx.domain.upsert({
      where: { name: configuredDomain },
      update: {
        customerId: order.customerId,
        status: "PENDING",
        expiresAt,
      },
      create: {
        customerId: order.customerId,
        name: configuredDomain,
        registrar: "Gri",
        registeredAt: now,
        expiresAt,
        status: "PENDING",
        nameservers: DEFAULT_NAMESERVERS,
      },
    });

    const registrarResult = await submitDomainToRegistrar(tx, order, configuredDomain);

    if (!registrarResult.ok || registrarResult.skipped) {
      await enqueueProvisioningRetry(
        order.id,
        registrarResult.error ?? "REGISTRAR_PROVISIONING_FAILED",
        tx
      );
      return {
        type: "domain" as const,
        identifier: configuredDomain,
        registrar: registrarResult,
        partialFailure: true as const,
      };
    }

    return { type: "domain" as const, identifier: configuredDomain, registrar: registrarResult };
  }

  if (order.product.category.slug === "ssl") {
    if (!configuredDomain) {
      throw new Error("DOMAIN_REQUIRED");
    }

    const sslType = mapProductSubTypeToSslType(order.product.subType);

    const certificate = await tx.sslCertificate.create({
      data: {
        customerId: order.customerId,
        domain: configuredDomain,
        type: sslType,
        status: "PENDING",
      },
    });

    const sslResult = await provisionSslCertificate({
      certificateId: certificate.id,
      domain: configuredDomain,
      type: sslType,
      customerId: order.customerId,
    });

    if (sslResult.ok && !sslResult.skipped) {
      await tx.sslCertificate.update({
        where: { id: certificate.id },
        data: {
          status: sslResult.status ?? "PENDING",
          provider: sslResult.provider ?? certificate.provider,
          issuedAt: sslResult.issuedAt,
          expiresAt: sslResult.expiresAt,
        },
      });
    }

    if (!sslResult.ok && !sslResult.skipped) {
      await enqueueProvisioningRetry(
        order.id,
        sslResult.error ?? "SSL_PROVISIONING_FAILED",
        tx
      );
      return {
        type: "ssl" as const,
        identifier: certificate.id,
        ssl: serializeSslProvisionResult(sslResult),
        partialFailure: true as const,
      };
    }

    return {
      type: "ssl" as const,
      identifier: certificate.id,
      ssl: serializeSslProvisionResult(sslResult),
    };
  }

  if (order.serviceId) {
    return { type: "service" as const, identifier: order.serviceId };
  }

  const service = await tx.service.create({
    data: {
      customerId: order.customerId,
      productId: order.productId,
      label: order.product.name,
      domain: configuredDomain,
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

  await tx.order.update({
    where: { id: order.id },
    data: { serviceId: service.id },
  });

  const provisioning = await createRemoteService({
    ...service,
    product: order.product,
    customer: order.customer,
  });

  if (provisioning.ok && provisioning.reference) {
    await tx.service.update({
      where: { id: service.id },
      data: { serverName: provisioning.reference },
    });
  }

  if (!provisioning.ok && !provisioning.skipped) {
    await enqueueProvisioningRetry(
      order.id,
      provisioning.error ?? "REMOTE_PROVISIONING_FAILED",
      tx,
      service.id
    );
    return {
      type: "service" as const,
      identifier: service.id,
      provisioning,
      partialFailure: true as const,
    };
  }

  return { type: "service" as const, identifier: service.id, provisioning };
}
