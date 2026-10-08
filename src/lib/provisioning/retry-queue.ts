import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  changeRemoteServicePlan,
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
import { sendNotification } from "@/lib/notifications/send";

const RETRY_DELAYS_MS = [
  5 * 60 * 1000,
  15 * 60 * 1000,
  60 * 60 * 1000,
  4 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
] as const;

type DbClient = Prisma.TransactionClient | typeof db;

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
  const { resolveProvisioningDomain, submitDomainToRegistrar, upsertPendingDomain } = await import(
    "@/lib/provisioning/internal"
  );
  const resolved = resolveProvisioningDomain(order);

  if (!resolved.domain) {
    return { ok: false as const, error: resolved.error ?? "DOMAIN_REQUIRED", permanent: true };
  }

  // The row exists when the order had its domain at payment time; after an
  // admin fixed a missing/invalid domain it is created here.
  const existing = await db.domain.findUnique({ where: { name: resolved.domain }, select: { id: true } });
  if (!existing) {
    await upsertPendingDomain(db, order, resolved.domain);
  }

  const registrarResult = await submitDomainToRegistrar(db, order, resolved.domain);

  if (registrarResult.ok && !registrarResult.skipped) {
    const { DEFAULT_NAMESERVERS } = await import("@/lib/provisioning/internal");
    const domain = await db.domain.findUnique({ where: { name: resolved.domain }, select: { expiresAt: true } });
    const config = order.items[0]?.configuration as Record<string, unknown> | null | undefined;
    await sendNotification({
      userId: order.customerId,
      template: "domain.registered",
      data: {
        domain: resolved.domain,
        expiresAt: domain?.expiresAt ?? undefined,
        nameservers: DEFAULT_NAMESERVERS,
        transfer: config?.type === "domain_transfer",
      },
      dedupeKey: `domain.registered:${order.id}`,
    });
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
  const { resolveProvisioningDomain } = await import("@/lib/provisioning/internal");
  const resolved = resolveProvisioningDomain(order);

  if (!resolved.domain) {
    return { ok: false as const, error: resolved.error ?? "DOMAIN_REQUIRED", permanent: true };
  }
  const configuredDomain = resolved.domain;

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

  if (provisioning.ok && !provisioning.skipped) {
    const { activationKindForCategory, queueServiceActivatedNotice } = await import(
      "@/lib/provisioning/activation-notice"
    );
    const kind = activationKindForCategory(order.product.category.slug);
    // Provisioning just wrote the username / remote id / IP (module bridge)
    // and, for cPanel, the generated panel password (encrypted). Hosting: the
    // notice shows that password once (encrypted in the queue/log, redacted in
    // the inbox copy). Server modules (Proxmox) keep the initial password in
    // the panel (shown once, moduleData), never in the e-mail.
    const fresh = await db.service.findUnique({ where: { id: service.id }, include: { product: true } });
    const bound = service.moduleInstanceId && fresh ? fresh : null;
    const { readStoredPanelPassword } = await import("@/lib/services/panel-access");
    const password = kind === "hosting" ? (readStoredPanelPassword(fresh?.panelPassword) ?? undefined) : undefined;
    const base = bound ? { ...bound, serverName: null } : { ...service, serverName: provisioning.reference ?? service.serverName };
    await queueServiceActivatedNotice(undefined, {
      service: { ...base, username: fresh?.username ?? fresh?.remoteId ?? service.username },
      kind,
      ...(bound && kind === "server" ? { passwordDelivery: "panel" as const } : {}),
      ...(password ? { password, passwordDelivery: "included" as const } : {}),
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

/**
 * Remote half of a paid plan change: the service row already points at the
 * new product (applied in the payment transaction); this moves the remote
 * account (WHM changepackage, VPS resize) to that package.
 */
async function retryServicePlanChange(serviceId: string | null) {
  if (!serviceId) {
    return { ok: false as const, error: "SERVICE_NOT_FOUND", permanent: true };
  }

  const service = await db.service.findUnique({
    where: { id: serviceId },
    include: {
      product: { include: { category: true } },
      customer: true,
    },
  });

  if (!service) {
    return { ok: false as const, error: "SERVICE_NOT_FOUND", permanent: true };
  }

  if (service.status === "CANCELLED") {
    return { ok: true as const };
  }

  const result = await changeRemoteServicePlan(service, service.product.sku);

  if (result.ok || result.skipped) {
    return { ok: true as const };
  }

  return { ok: false as const, error: result.error ?? "REMOTE_PLAN_CHANGE_FAILED" };
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

type RetryResult = { ok: boolean; error?: string; permanent?: boolean; rescheduled?: boolean };

/**
 * The order's activation failed inside the payment transaction (rolled back
 * to a savepoint, payment kept). Re-run the same local step now; it may
 * re-queue this row itself (provisioning / plan change / unsuspend), in which
 * case the caller must leave the row alone.
 */
async function retryPaidOrderEffects(job: ProvisioningJobWithOrder): Promise<RetryResult> {
  const { applyPaidOrderEffects } = await import("@/lib/payments/fulfillment");
  const invoice = await db.invoice.findUnique({ where: { orderId: job.orderId }, select: { id: true } });

  try {
    await db.$transaction((tx) =>
      applyPaidOrderEffects(tx, job.orderId, { performedBy: "system", invoiceId: invoice?.id ?? "" })
    );
  } catch (error) {
    // Keep the FULFILMENT_ERROR prefix so the next retry takes this path again.
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, permanent: true, error: `FULFILMENT_ERROR: ${reason}. Ödeme kaydedildi; sipariş teslim edilmedi.` };
  }

  const current = await db.provisioningJob.findUnique({ where: { id: job.id } });
  if (current?.status === "PENDING") {
    return { ok: true, rescheduled: true };
  }
  if (current?.status === "FAILED" && current.lastError !== job.lastError) {
    return { ok: false, permanent: true, error: current.lastError ?? "PROVISIONING_NEEDS_ACTION" };
  }
  return { ok: true };
}

async function retryProvisioningJob(job: ProvisioningJobWithOrder): Promise<RetryResult> {
  const { order } = job;

  if (job.kind === "PROVISION" && job.lastError?.startsWith("FULFILMENT_ERROR")) {
    return retryPaidOrderEffects(job);
  }

  if (job.kind === "UNSUSPEND") {
    return retryServiceUnsuspend(job.serviceId ?? order.serviceId);
  }

  if (job.kind === "PLAN_CHANGE") {
    return retryServicePlanChange(job.serviceId ?? order.serviceId);
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

  // Job written before the service row existed (legacy rows): create it
  // locally first, then provision it remotely like any other attempt.
  const { createServiceForOrder, resolveProvisioningDomain } = await import("@/lib/provisioning/internal");
  const service = await db.$transaction(async (tx) => {
    const current = await tx.order.findUnique({ where: { id: order.id }, select: { serviceId: true } });
    if (current?.serviceId) {
      return { id: current.serviceId };
    }
    return createServiceForOrder(tx, order, resolveProvisioningDomain(order).domain);
  });
  await db.provisioningJob.update({ where: { id: job.id }, data: { serviceId: service.id } });

  return retryServiceProvisioning(order, service.id);
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

/**
 * A PROVISION row just became FAILED (no more automatic retries): a
 * module-bound service gives its reserved IPs back and the leftover remote
 * resources are flagged for the admin (src/lib/modules/provisioning.ts).
 */
async function onProvisioningGivenUp(job: { kind: string; serviceId: string | null; order?: { serviceId: string | null } | null }) {
  if (job.kind !== "PROVISION") return;
  const serviceId = job.serviceId ?? job.order?.serviceId ?? null;
  if (!serviceId) return;
  try {
    const { abandonModuleProvisioning } = await import("@/lib/modules/provisioning");
    const result = await abandonModuleProvisioning(serviceId);
    if (result?.error) throw new Error(result.error);
  } catch (error) {
    // Never let cleanup hide the provisioning failure itself.
    console.error(
      `[Provisioning] Hizmet ${serviceId} için yarım kalan kurulum temizlenemedi: ${error instanceof Error ? error.message : error}`
    );
  }
}

export async function recoverStaleProcessingJobs(
  staleAfterMs = STALE_PROCESSING_MS,
  client: DbClient = db
) {
  const threshold = new Date(Date.now() - staleAfterMs);

  const result = await client.provisioningJob.updateMany({
    where: {
      status: "PROCESSING",
      kind: { not: "MANUAL" },
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

  if (job.kind === "MANUAL") {
    return { ok: false as const, error: "JOB_IS_MANUAL" };
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

    if (result.rescheduled) {
      return { ok: true as const };
    }

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
    await onProvisioningGivenUp(job);

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
    await onProvisioningGivenUp(job);

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
    // MANUAL tasks wait for an admin (/yonetim/kurulumlar), never for the queue.
    where: { status: "PENDING", kind: { not: "MANUAL" } },
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

  if (job.kind === "MANUAL") {
    return { skipped: "MANUAL_TASK" };
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

  let result: RetryResult;
  try {
    result = await retryProvisioningJob(job);
  } catch (error) {
    result = { ok: false, error: error instanceof Error ? error.message : "PROVISIONING_RETRY_FAILED" };
  }

  if (result.rescheduled) {
    return { ok: true, orderId: job.orderId, rescheduled: true };
  }

  if (result.ok) {
    await db.provisioningJob.update({
      where: { id: job.id },
      data: { status: "COMPLETED", completedAt: new Date(), lastError: null },
    });
    return { ok: true, orderId: job.orderId };
  }

  const error = result.error ?? "PROVISIONING_RETRY_FAILED";

  // Bad order data (no / invalid domain): retrying can't help. Park the row
  // as FAILED with the reason for the admin instead of burning the retries.
  if (result.permanent) {
    await db.provisioningJob.update({
      where: { id: job.id },
      data: { status: "FAILED", attempts: job.attempts + 1, lastError: error },
    });
    await onProvisioningGivenUp(job);
    return { ok: false, orderId: job.orderId, needsAction: error };
  }

  await db.provisioningJob.update({
    where: { id: job.id },
    data: {
      status: context.isFinalAttempt ? "FAILED" : "PENDING",
      attempts: job.attempts + 1,
      lastError: error,
      nextRetryAt: context.isFinalAttempt ? job.nextRetryAt : estimateQueueRetryAt(context.retryCount + 1),
    },
  });
  if (context.isFinalAttempt) await onProvisioningGivenUp(job);

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
