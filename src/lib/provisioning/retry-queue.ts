import type { BillingPeriod, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createRemoteService } from "@/lib/integrations/provisioning-provider";
import { registerDomainWithRegistrar } from "@/lib/integrations/registrar";
import {
  mapProductSubTypeToSslType,
  provisionSslCertificate,
} from "@/lib/integrations/ssl";
import type { CronJobResult } from "@/lib/cron/jobs/types";

const RETRY_DELAYS_MS = [
  5 * 60 * 1000,
  15 * 60 * 1000,
  60 * 60 * 1000,
  4 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
] as const;

const billingMonths: Record<BillingPeriod, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  yearly: 12,
  biennial: 24,
  triennial: 36,
};

type DbClient = Prisma.TransactionClient | typeof db;

function normalizeDomain(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}

export function getRetryDelayMs(attempt: number): number {
  const index = Math.min(Math.max(attempt, 0), RETRY_DELAYS_MS.length - 1);
  return RETRY_DELAYS_MS[index];
}

export function getNextRetryAt(attempt: number, from = new Date()): Date {
  return new Date(from.getTime() + getRetryDelayMs(attempt));
}

export async function enqueueProvisioningRetry(
  orderId: string,
  error?: string,
  client: DbClient = db,
  serviceId?: string
) {
  const existing = await client.provisioningJob.findUnique({
    where: { orderId },
  });

  if (existing) {
    if (existing.status === "COMPLETED") {
      return client.provisioningJob.update({
        where: { id: existing.id },
        data: {
          status: "PENDING",
          attempts: 0,
          lastError: error,
          serviceId: serviceId ?? existing.serviceId,
          nextRetryAt: getNextRetryAt(0),
          completedAt: null,
        },
      });
    }

    return client.provisioningJob.update({
      where: { id: existing.id },
      data: {
        status: "PENDING",
        lastError: error,
        serviceId: serviceId ?? existing.serviceId,
        nextRetryAt: getNextRetryAt(existing.attempts),
      },
    });
  }

  return client.provisioningJob.create({
    data: {
      orderId,
      serviceId,
      status: "PENDING",
      attempts: 0,
      lastError: error,
      nextRetryAt: getNextRetryAt(0),
    },
  });
}

async function retryDomainProvisioning(
  order: Prisma.OrderGetPayload<{
    include: {
      product: { include: { category: true } };
      customer: true;
      items: true;
    };
  }>
) {
  const firstItemConfig = order.items[0]?.configuration;
  const config =
    firstItemConfig && typeof firstItemConfig === "object" && !Array.isArray(firstItemConfig)
      ? (firstItemConfig as Record<string, unknown>)
      : {};
  const configuredDomain =
    normalizeDomain(typeof config.domain === "string" ? config.domain : undefined) ??
    normalizeDomain(order.domain);

  if (!configuredDomain) {
    return { ok: false as const, error: "DOMAIN_REQUIRED" };
  }

  const registrarResult = await registerDomainWithRegistrar({
    domain: configuredDomain,
    years: Math.max(1, Math.round((billingMonths[order.billingPeriod] ?? 12) / 12)),
    nameservers: ["ns1.kleacore.com", "ns2.kleacore.com"],
    customer: order.customer,
  });

  if (registrarResult.ok && !registrarResult.skipped) {
    await db.domain.update({
      where: { name: configuredDomain },
      data: { registrar: registrarResult.provider ?? "Gri" },
    });
    return { ok: true as const };
  }

  if (registrarResult.skipped) {
    return { ok: true as const };
  }

  return { ok: false as const, error: registrarResult.error ?? "REGISTRAR_PROVISIONING_FAILED" };
}

async function retrySslProvisioning(
  order: Prisma.OrderGetPayload<{
    include: {
      product: { include: { category: true } };
      customer: true;
      items: true;
    };
  }>
) {
  const firstItemConfig = order.items[0]?.configuration;
  const config =
    firstItemConfig && typeof firstItemConfig === "object" && !Array.isArray(firstItemConfig)
      ? (firstItemConfig as Record<string, unknown>)
      : {};
  const configuredDomain =
    normalizeDomain(typeof config.domain === "string" ? config.domain : undefined) ??
    normalizeDomain(order.domain);

  if (!configuredDomain) {
    return { ok: false as const, error: "DOMAIN_REQUIRED" };
  }

  const sslType = mapProductSubTypeToSslType(order.product.subType);
  const existing = await db.sslCertificate.findFirst({
    where: {
      customerId: order.customerId,
      domain: configuredDomain,
    },
    orderBy: { createdAt: "desc" },
  });

  const certificate =
    existing ??
    (await db.sslCertificate.create({
      data: {
        customerId: order.customerId,
        domain: configuredDomain,
        type: sslType,
        status: "PENDING",
      },
    }));

  const sslResult = await provisionSslCertificate({
    certificateId: certificate.id,
    domain: configuredDomain,
    type: sslType,
    customerId: order.customerId,
  });

  if (sslResult.ok && !sslResult.skipped) {
    await db.sslCertificate.update({
      where: { id: certificate.id },
      data: {
        status: sslResult.status ?? "PENDING",
        provider: sslResult.provider ?? certificate.provider,
        issuedAt: sslResult.issuedAt,
        expiresAt: sslResult.expiresAt,
      },
    });
    return { ok: true as const };
  }

  if (sslResult.skipped) {
    return { ok: true as const };
  }

  return { ok: false as const, error: sslResult.error ?? "SSL_PROVISIONING_FAILED" };
}

async function retryServiceProvisioning(
  order: Prisma.OrderGetPayload<{
    include: {
      product: { include: { category: true } };
      customer: true;
    };
  }>,
  serviceId: string
) {
  const service = await db.service.findUnique({
    where: { id: serviceId },
    include: {
      product: { include: { category: true } },
      customer: true,
    },
  });

  if (!service) {
    return { ok: false as const, error: "SERVICE_NOT_FOUND" };
  }

  const provisioning = await createRemoteService({
    ...service,
    product: order.product,
    customer: order.customer,
  });

  if (provisioning.ok && provisioning.reference) {
    await db.service.update({
      where: { id: service.id },
      data: { serverName: provisioning.reference },
    });
  }

  if (provisioning.ok || provisioning.skipped) {
    return { ok: true as const };
  }

  return { ok: false as const, error: provisioning.error ?? "REMOTE_PROVISIONING_FAILED" };
}

type ProvisioningJobWithOrder = Prisma.ProvisioningJobGetPayload<{
  include: {
    order: {
      include: {
        product: { include: { category: true } };
        customer: true;
        items: true;
      };
    };
  };
}>;

async function retryProvisioningJob(job: ProvisioningJobWithOrder) {
  const { order } = job;

  if (order.product.category.slug === "domain") {
    return retryDomainProvisioning(order);
  }

  if (order.product.category.slug === "ssl") {
    return retrySslProvisioning(order);
  }

  const serviceId = job.serviceId ?? order.serviceId;
  if (serviceId) {
    return retryServiceProvisioning(order, serviceId);
  }

  const { provisionCompletedOrder } = await import("@/lib/provisioning/internal");
  const provisioned = await db.$transaction((tx) => provisionCompletedOrder(tx, order.id));

  if ("partialFailure" in provisioned && provisioned.partialFailure) {
    const error =
      provisioned.type === "domain"
        ? provisioned.registrar.error
        : provisioned.type === "ssl"
          ? provisioned.ssl.error
          : provisioned.provisioning.error;
    return { ok: false as const, error: error ?? "PROVISIONING_PARTIAL_FAILURE" };
  }

  return { ok: true as const };
}

async function loadProvisioningJobForRetry(jobId: string) {
  return db.provisioningJob.findUnique({
    where: { id: jobId },
    include: {
      order: {
        include: {
          product: { include: { category: true } },
          customer: true,
          items: true,
        },
      },
    },
  });
}

async function finalizeProvisioningRetryAttempt(
  job: ProvisioningJobWithOrder,
  result: { ok: boolean; error?: string },
  options?: { respectMaxAttempts?: boolean }
) {
  const now = new Date();
  const respectMaxAttempts = options?.respectMaxAttempts ?? true;

  if (result.ok) {
    await db.provisioningJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        completedAt: now,
        lastError: null,
      },
    });
    return { ok: true as const };
  }

  const nextAttempts = job.attempts + 1;
  const exhausted = respectMaxAttempts && nextAttempts >= job.maxAttempts;

  await db.provisioningJob.update({
    where: { id: job.id },
    data: {
      status: exhausted ? "FAILED" : "PENDING",
      attempts: nextAttempts,
      lastError: result.error,
      nextRetryAt: exhausted ? job.nextRetryAt : getNextRetryAt(nextAttempts),
    },
  });

  return { ok: false as const, error: result.error ?? "PROVISIONING_RETRY_FAILED" };
}

export async function manualRetryProvisioningJob(jobId: string) {
  const job = await loadProvisioningJobForRetry(jobId);

  if (!job) {
    return { ok: false as const, error: "JOB_NOT_FOUND" };
  }

  if (job.status === "COMPLETED") {
    return { ok: false as const, error: "JOB_ALREADY_COMPLETED" };
  }

  if (job.status === "PROCESSING") {
    return { ok: false as const, error: "JOB_ALREADY_PROCESSING" };
  }

  await db.provisioningJob.update({
    where: { id: job.id },
    data: {
      status: "PROCESSING",
      nextRetryAt: new Date(),
    },
  });

  try {
    const result = await retryProvisioningJob(job);

    if (result.ok) {
      await db.provisioningJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          lastError: null,
        },
      });
      return { ok: true as const };
    }

    await db.provisioningJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        attempts: job.attempts + 1,
        lastError: result.error,
      },
    });

    return { ok: false as const, error: result.error ?? "PROVISIONING_RETRY_FAILED" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "PROVISIONING_RETRY_FAILED";

    await db.provisioningJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        attempts: job.attempts + 1,
        lastError: message,
      },
    });

    return { ok: false as const, error: message };
  }
}

export async function processProvisioningRetries(limit = 10): Promise<CronJobResult> {
  const now = new Date();

  const jobs = await db.provisioningJob.findMany({
    where: {
      status: "PENDING",
      nextRetryAt: { lte: now },
    },
    include: {
      order: {
        include: {
          product: { include: { category: true } },
          customer: true,
          items: true,
        },
      },
    },
    orderBy: { nextRetryAt: "asc" },
    take: limit * 2,
  });

  const dueJobs = jobs.filter((job) => job.attempts < job.maxAttempts).slice(0, limit);
  const processedIds: string[] = [];
  let skipped = 0;

  for (const job of dueJobs) {
    await db.provisioningJob.update({
      where: { id: job.id },
      data: { status: "PROCESSING" },
    });

    try {
      const result = await retryProvisioningJob(job);
      const finalized = await finalizeProvisioningRetryAttempt(job, result);

      if (finalized.ok) {
        processedIds.push(job.id);
        continue;
      }

      const nextAttempts = job.attempts + 1;
      if (nextAttempts >= job.maxAttempts) {
        skipped += 1;
      } else {
        processedIds.push(job.id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "PROVISIONING_RETRY_FAILED";
      await finalizeProvisioningRetryAttempt(job, { ok: false, error: message });

      const nextAttempts = job.attempts + 1;
      if (nextAttempts >= job.maxAttempts) {
        skipped += 1;
      }
    }
  }

  return {
    processed: processedIds.length,
    skipped,
    ids: processedIds,
  };
}