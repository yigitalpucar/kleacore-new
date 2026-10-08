import { db } from "@/lib/db";
import { getSettingValue } from "@/lib/integrations/settings";
import { suspendRemoteService } from "@/lib/integrations/provisioning-provider";
import { NON_PAYMENT_SUSPEND_REASON } from "@/lib/payments/service-lifecycle";
import { emitEvent } from "@/lib/events/emit";
import type { CronJobResult } from "./types";

export const SUSPEND_GRACE_DAYS_SETTING = "suspend_grace_days";
const DEFAULT_SUSPEND_GRACE_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export function parseSuspendGraceDays(value: string | null | undefined): number {
  const trimmed = value?.trim() ?? "";
  if (!/^\d+$/.test(trimmed)) {
    return DEFAULT_SUSPEND_GRACE_DAYS;
  }
  return Number(trimmed);
}

export async function getSuspendGraceDays(): Promise<number> {
  return parseSuspendGraceDays(
    await getSettingValue(SUSPEND_GRACE_DAYS_SETTING, undefined, String(DEFAULT_SUSPEND_GRACE_DAYS))
  );
}

/**
 * Suspends services whose own invoice is still unpaid `suspend_grace_days`
 * after its due date. Only the service the overdue invoice belongs to (via
 * its order) is suspended — an unrelated overdue invoice (manual invoice, new
 * order not yet provisioned) never takes down the customer's other services.
 */
export async function suspendOverdueServices(now = new Date()): Promise<CronJobResult> {
  const graceDays = await getSuspendGraceDays();
  const dueBefore = new Date(now.getTime() - graceDays * DAY_MS);

  const overdueInvoices = await db.invoice.findMany({
    where: {
      status: "OVERDUE",
      dueDate: { lt: dueBefore },
      order: { serviceId: { not: null } },
    },
    select: {
      order: {
        select: { serviceId: true },
      },
    },
  });

  const serviceIds = new Set<string>();
  for (const invoice of overdueInvoices) {
    if (invoice.order?.serviceId) {
      serviceIds.add(invoice.order.serviceId);
    }
  }

  if (serviceIds.size === 0) {
    return { processed: 0, skipped: 0, ids: [] };
  }

  const services = await db.service.findMany({
    where: {
      id: { in: [...serviceIds] },
      status: "ACTIVE",
    },
    include: {
      product: {
        include: { category: true },
      },
      customer: {
        select: { id: true, name: true, surname: true, email: true },
      },
    },
  });

  const suspendedIds: string[] = [];

  for (const service of services) {
    // Status change + service.suspended ("hizmetiniz askıya alındı") commit together.
    const updated = await db.$transaction(async (tx) => {
      const row = await tx.service.update({
        where: { id: service.id },
        data: {
          status: "SUSPENDED",
          suspendedAt: now,
          suspendReason: NON_PAYMENT_SUSPEND_REASON,
        },
      });
      await emitEvent(tx, "service.suspended", {
        serviceId: service.id,
        customerId: service.customerId,
        serviceLabel: service.label || service.domain || service.product.name,
        reason: NON_PAYMENT_SUSPEND_REASON,
        suspendedAt: now,
      });
      return row;
    });

    const remote = await suspendRemoteService(
      { ...updated, product: service.product, customer: service.customer },
      NON_PAYMENT_SUSPEND_REASON
    );
    if (!remote.ok && !remote.skipped) {
      console.error(
        `[Cron] Hizmet ${service.id} uzak sunucuda askıya alınamadı: ${remote.error ?? "bilinmeyen hata"}`
      );
    }
    suspendedIds.push(service.id);
  }

  return {
    processed: suspendedIds.length,
    skipped: serviceIds.size - suspendedIds.length,
    ids: suspendedIds,
  };
}
