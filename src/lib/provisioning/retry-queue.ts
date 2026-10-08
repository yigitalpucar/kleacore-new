import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  createRemoteService,
  unsuspendRemoteService,
} from "@/lib/integrations/provisioning-provider";
import {
  mapProductSubTypeToSslType,
  provisionSslCertificate,
} from "@/lib/integrations/ssl";
import type { CronJobResult } from "@/lib/cron/jobs/types";
import type { JobContext } from "@/lib/jobs/registry";
import { dismissFailedQueueEntries, queueProvisioningAttempt } from "@/lib/provisioning/queue";

const RETRY_DELAYS_MS = [
  5 * 60 * 1000,
  15 * 60 * 1000,
  60 * 60 * 1000,
  4 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
] as const;

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

/**
 * Records a provisioning failure on the order's ProvisioningJob row and
 * schedules a queue attempt (provisioning.run) in the same transaction.
 */
export async function enqueueProvisioningRetry(
  orderId: string,
  error?: string,
  client: DbClient = db,
  serviceId?: string
) {
  const job = await upsertProvisioningRetry(orderId, error, client, serviceId);
  await queueProvisioningAttempt(client, job, { startAfter: job.nextRetryAt });
  return job;
}

async function upsertProvisioningRetry(
  orderId: string,
  error: string | undefined,
  client: DbClient,
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

  const { submitDomainToRegistrar } = await import("@/lib/provisioning/internal");
  const registrarResult = await submitDomainToRegistrar(db, order, configuredDomain);

  if (registrarResult.ok && !registrarResult.skipped) {
    return { ok: true as const };
  }

  // A disabled registrar (skipped) registered nothing: keep the job open so
  // the domain stays visible as an admin task instead of silently completing.
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

async function retryServiceUnsuspend(serviceId: string | null) {
  if (!serviceId) {
    return { ok: false as const, error: "SERVICE_NOT_FOUND" };
  }

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

  // Suspended again (or cancelled) since the payment: unsuspending the remote
  // account now would contradict the current state.
  if (service.status !== "ACTIVE") {
    return { ok: true as const };
  }

  const result = await unsuspendRemoteService(service);

  if (result.ok || result.skipped) {
    return { ok: true as const };
  }

  return { ok: false as const, error: result.error ?? "REMOTE_UNSUSPEND_FAILED" };
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

  if (job.kind === "UNSUSPEND") {
    return retryServiceUnsuspend(job.serviceId ?? order.serviceId);
  }

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

const STALE_PROCESSING_MS = 15 * 60 * 1000;

export async function recoverStaleProcessingJobs(
  staleAfterMs = STALE_PROCESSING_MS,
  client: DbClient = db
) {
  const threshold = new Date(Date.now() - staleAfterMs);

  const result = await client.provisioningJob.updateMany({
    where: {
      status: "PROCESSING",
      updatedAt: { lt: threshold },
    },
    data: {
      status: "PENDING",
      nextRetryAt: new Date(),
    },
  });

  return result.count;
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

    const finalized = await finalizeProvisioningRetryAttempt(job, result, {
      respectMaxAttempts: false,
    });

    if (finalized.ok) {
      await dismissFailedQueueEntries(job.id);
      return { ok: true as const };
    }

    await db.provisioningJob.update({
      where: { id: job.id },
      data: { status: "FAILED" },
    });

    return { ok: false as const, error: finalized.error ?? "PROVISIONING_RETRY_FAILED" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "PROVISIONING_RETRY_FAILED";
    await finalizeProvisioningRetryAttempt(job, { ok: false, error: message }, {
      respectMaxAttempts: false,
    });
    await db.provisioningJob.update({
      where: { id: job.id },
      data: { status: "FAILED" },
    });

    return { ok: false as const, error: message };
  }
}

/**
 * Outbox reconciliation for the retry-provisioning cron: makes sure every
 * PENDING ProvisioningJob row has a queued provisioning.run job. New failures
 * are enqueued in their own transaction already; this picks up rows written
 * before the queue existed, rows whose enqueue was skipped because the queue
 * was unreachable, and PROCESSING rows left behind by a crash. Idempotent:
 * rows that already have a queued/retrying/running job are deduplicated.
 */
export async function reconcileProvisioningQueue(limit = 100): Promise<CronJobResult> {
  await recoverStaleProcessingJobs(STALE_PROCESSING_MS);

  const jobs = await db.provisioningJob.findMany({
    where: { status: "PENDING" },
    select: { id: true, attempts: true, maxAttempts: true, nextRetryAt: true },
    orderBy: { nextRetryAt: "asc" },
    take: limit,
  });

  const queuedIds: string[] = [];
  let skipped = 0;
  const now = new Date();

  for (const job of jobs) {
    if (job.attempts >= job.maxAttempts) {
      await db.provisioningJob.update({ where: { id: job.id }, data: { status: "FAILED" } });
      skipped += 1;
      continue;
    }

    const result = await queueProvisioningAttempt(db, job, {
      startAfter: job.nextRetryAt > now ? job.nextRetryAt : undefined,
    });
    if (result.queued) {
      queuedIds.push(job.id);
    } else {
      skipped += 1;
    }
  }

  return { processed: queuedIds.length, skipped, ids: queuedIds };
}

/** Rough "next attempt" shown on /yonetim/provisioning (pg-boss adds jitter). */
function estimateQueueRetryAt(retryCount: number, from = new Date()) {
  const seconds = Math.min(10 * 60 * 2 ** retryCount, 6 * 60 * 60);
  return new Date(from.getTime() + seconds * 1000);
}

/**
 * Handler of the provisioning.run queue job: one attempt for one row.
 * Throws on failure so pg-boss applies backoff, and on the last attempt marks
 * the row FAILED (pg-boss marks the queue job failed).
 */
export async function runQueuedProvisioningJob(provisioningJobId: string, context: JobContext) {
  const job = await loadProvisioningJobForRetry(provisioningJobId);

  if (!job) {
    return { skipped: "JOB_NOT_FOUND" };
  }

  if (job.status === "COMPLETED") {
    return { skipped: "ALREADY_COMPLETED" };
  }

  // Same claim as the inline unsuspend runner, so the two never run one row
  // concurrently. A PROCESSING row older than the stale window belongs to a
  // crashed run and may be taken over.
  const claimed = await db.provisioningJob.updateMany({
    where: {
      id: job.id,
      OR: [
        { status: { in: ["PENDING", "FAILED"] } },
        { status: "PROCESSING", updatedAt: { lt: new Date(Date.now() - STALE_PROCESSING_MS) } },
      ],
    },
    data: { status: "PROCESSING" },
  });

  if (claimed.count === 0) {
    throw new Error("JOB_BUSY");
  }

  let result: { ok: boolean; error?: string };
  try {
    result = await retryProvisioningJob(job);
  } catch (error) {
    result = { ok: false, error: error instanceof Error ? error.message : "PROVISIONING_RETRY_FAILED" };
  }

  if (result.ok) {
    await db.provisioningJob.update({
      where: { id: job.id },
      data: { status: "COMPLETED", completedAt: new Date(), lastError: null },
    });
    return { ok: true, orderId: job.orderId };
  }

  const error = result.error ?? "PROVISIONING_RETRY_FAILED";
  await db.provisioningJob.update({
    where: { id: job.id },
    data: {
      status: context.isFinalAttempt ? "FAILED" : "PENDING",
      attempts: job.attempts + 1,
      lastError: error,
      nextRetryAt: context.isFinalAttempt ? job.nextRetryAt : estimateQueueRetryAt(context.retryCount + 1),
    },
  });

  throw new Error(error);
}

/**
 * Executes the UNSUSPEND jobs written by these invoice payments right after
 * their transaction committed. Each job is claimed with a conditional
 * PENDING -> PROCESSING update so the queued provisioning.run job (scheduled
 * a minute later by `unsuspendServiceIfNeeded`) never runs it concurrently; on
 * failure the row stays PENDING and that queue job retries it.
 */
export async function runPendingUnsuspendJobs(invoiceIds: string[]) {
  const jobs = await db.provisioningJob.findMany({
    where: {
      kind: "UNSUSPEND",
      status: "PENDING",
      order: { invoice: { id: { in: invoiceIds } } },
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
  });

  const results: Array<{ jobId: string; ok: boolean; error?: string }> = [];

  for (const job of jobs) {
    const claimed = await db.provisioningJob.updateMany({
      where: { id: job.id, status: "PENDING" },
      data: { status: "PROCESSING" },
    });

    if (claimed.count === 0) {
      continue;
    }

    let result: { ok: boolean; error?: string };
    try {
      result = await retryProvisioningJob(job);
    } catch (error) {
      result = {
        ok: false,
        error: error instanceof Error ? error.message : "REMOTE_UNSUSPEND_FAILED",
      };
    }

    const finalized = await finalizeProvisioningRetryAttempt(job, result);
    if (!finalized.ok) {
      console.error(
        `[Provisioning] Hizmet ${job.serviceId} uzak sunucuda askıdan çıkarılamadı, tekrar denenecek: ${finalized.error}`
      );
    }
    results.push({ jobId: job.id, ok: finalized.ok, error: finalized.ok ? undefined : finalized.error });
  }

  return results;
}
