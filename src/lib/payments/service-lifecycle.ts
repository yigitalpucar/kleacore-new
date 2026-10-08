import type { Prisma } from "@prisma/client";

/**
 * suspendReason written by the overdue-invoice cron. Only services suspended
 * with this reason are reactivated automatically when the debt is paid;
 * admin suspensions (free-text reason) and customer-stopped servers
 * (CUSTOMER_STOPPED, see services/server-power.ts) are left alone.
 */
export const NON_PAYMENT_SUSPEND_REASON = "Gecikmiş fatura ödemesi";

export function isNonPaymentSuspension(service: {
  status: string;
  suspendReason?: string | null;
}): boolean {
  return service.status === "SUSPENDED" && service.suspendReason === NON_PAYMENT_SUSPEND_REASON;
}

/**
 * Reactivates a service suspended for non-payment, inside the payment
 * transaction. The remote unsuspend (WHM unsuspendacct, VPS start, ...) can't
 * run here — it would hold the transaction open on a network call and can't be
 * rolled back — so an UNSUSPEND provisioning job is written in the same
 * transaction. `runUnsuspendJobsForInvoices` executes it right after commit
 * and the provisioning retry cron retries it on failure.
 */
export async function unsuspendServiceIfNeeded(
  tx: Prisma.TransactionClient,
  serviceId: string,
  orderId: string
): Promise<{ unsuspended: boolean }> {
  const service = await tx.service.findUnique({
    where: { id: serviceId },
    select: {
      id: true,
      status: true,
      suspendReason: true,
    },
  });

  if (!service || !isNonPaymentSuspension(service)) {
    return { unsuspended: false };
  }

  const updated = await tx.service.updateMany({
    where: {
      id: serviceId,
      status: "SUSPENDED",
      suspendReason: NON_PAYMENT_SUSPEND_REASON,
    },
    data: {
      status: "ACTIVE",
      suspendedAt: null,
      suspendReason: null,
    },
  });

  if (updated.count === 0) {
    return { unsuspended: false };
  }

  const now = new Date();
  await tx.provisioningJob.upsert({
    where: { orderId },
    create: {
      orderId,
      serviceId,
      kind: "UNSUSPEND",
      status: "PENDING",
      attempts: 0,
      nextRetryAt: now,
    },
    update: {
      serviceId,
      kind: "UNSUSPEND",
      status: "PENDING",
      attempts: 0,
      lastError: null,
      nextRetryAt: now,
      completedAt: null,
    },
  });

  return { unsuspended: true };
}

/**
 * Runs the remote unsuspend for services reactivated by these (just
 * committed) invoice payments. Never throws: failures stay on the job for the
 * retry cron and are logged.
 */
export async function runUnsuspendJobsForInvoices(invoiceIds: string[]) {
  if (invoiceIds.length === 0) {
    return;
  }

  try {
    const { runPendingUnsuspendJobs } = await import("@/lib/provisioning/retry-queue");
    await runPendingUnsuspendJobs(invoiceIds);
  } catch (error) {
    console.error("[Lifecycle] Uzak sunucuda askı kaldırılamadı:", error);
  }
}
