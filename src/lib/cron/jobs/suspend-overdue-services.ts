import { db } from "@/lib/db";
import { suspendRemoteService } from "@/lib/integrations/provisioning-provider";
import type { CronJobResult } from "./types";

const SUSPEND_REASON = "Gecikmiş fatura ödemesi";

export async function suspendOverdueServices(): Promise<CronJobResult> {
  const overdueInvoices = await db.invoice.findMany({
    where: { status: "OVERDUE" },
    select: {
      customerId: true,
      order: {
        select: { serviceId: true },
      },
    },
  });

  if (overdueInvoices.length === 0) {
    return { processed: 0, ids: [] };
  }

  const serviceIds = new Set<string>();
  const customerIdsWithoutService = new Set<string>();

  for (const invoice of overdueInvoices) {
    if (invoice.order?.serviceId) {
      serviceIds.add(invoice.order.serviceId);
    } else {
      customerIdsWithoutService.add(invoice.customerId);
    }
  }

  if (customerIdsWithoutService.size > 0) {
    const customerServices = await db.service.findMany({
      where: {
        customerId: { in: [...customerIdsWithoutService] },
        status: "ACTIVE",
      },
      select: { id: true },
    });

    for (const service of customerServices) {
      serviceIds.add(service.id);
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
    const updated = await db.service.update({
      where: { id: service.id },
      data: {
        status: "SUSPENDED",
        suspendedAt: new Date(),
        suspendReason: SUSPEND_REASON,
      },
    });

    await suspendRemoteService(
      { ...updated, product: service.product, customer: service.customer },
      SUSPEND_REASON
    );
    suspendedIds.push(service.id);
  }

  return {
    processed: suspendedIds.length,
    skipped: serviceIds.size - suspendedIds.length,
    ids: suspendedIds,
  };
}