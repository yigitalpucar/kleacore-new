/**
 * Staff service lifecycle (suspend / unsuspend / terminate), shared by the
 * admin server actions (src/lib/actions/admin/services.ts) and the admin API
 * (/api/admin/v1/services). Callers check the permission; `actorId` is the
 * staff member the change is attributed to (events, activity log).
 */
import { db } from "@/lib/db";
import {
  suspendRemoteService,
  terminateRemoteService,
  unsuspendRemoteService,
} from "@/lib/integrations/provisioning-provider";
import { emitEvent } from "@/lib/events/emit";
import { logActivity } from "@/lib/activity-log";

/** `status` is the HTTP status the admin API answers with. */
export type LifecycleResult =
  | { success: true; integration: Awaited<ReturnType<typeof suspendRemoteService>> }
  | { success: false; error: string; status: number };

function loadService(id: string) {
  return db.service.findUnique({
    where: { id },
    include: {
      product: { include: { category: true } },
      customer: { select: { id: true, name: true, surname: true, email: true } },
    },
  });
}

export async function suspendServiceAs(actorId: string, id: string, reason: string): Promise<LifecycleResult> {
  const service = await loadService(id);
  if (!service) {
    return { success: false, error: "Hizmet bulunamadı", status: 404 };
  }

  if (service.status !== "ACTIVE") {
    return { success: false, error: "Sadece aktif hizmetler askıya alınabilir", status: 409 };
  }

  const suspendedAt = new Date();
  const serviceLabel = service.label || service.domain || service.product.name;
  // Status + service.suspended (customer notice via the outbox) commit together.
  const updatedService = await db.$transaction(async (tx) => {
    const row = await tx.service.update({
      where: { id },
      data: {
        status: "SUSPENDED",
        suspendedAt,
        suspendReason: reason,
      },
    });
    await emitEvent(
      tx,
      "service.suspended",
      { serviceId: id, customerId: service.customerId, serviceLabel, reason, suspendedAt },
      { actorId }
    );
    return row;
  });
  const integration = await suspendRemoteService(
    { ...updatedService, product: service.product, customer: service.customer },
    reason
  );

  await logActivity({
    userId: actorId,
    action: "SUSPEND_SERVICE",
    entity: "Service",
    entityId: id,
    details: {
      serviceLabel,
      customerId: service.customerId,
      reason,
      suspendedAt: suspendedAt.toISOString(),
    },
  });

  return { success: true, integration };
}

export async function unsuspendServiceAs(actorId: string, id: string): Promise<LifecycleResult> {
  const service = await loadService(id);
  if (!service) {
    return { success: false, error: "Hizmet bulunamadı", status: 404 };
  }

  if (service.status !== "SUSPENDED") {
    return { success: false, error: "Sadece askıdaki hizmetler aktifleştirilebilir", status: 409 };
  }

  const updatedService = await db.$transaction(async (tx) => {
    const row = await tx.service.update({
      where: { id },
      data: {
        status: "ACTIVE",
        suspendedAt: null,
        suspendReason: null,
      },
    });
    await emitEvent(
      tx,
      "service.unsuspended",
      {
        serviceId: service.id,
        customerId: service.customerId,
        serviceLabel: service.label || service.domain || service.product.name,
      },
      { actorId }
    );
    return row;
  });
  const integration = await unsuspendRemoteService({
    ...updatedService,
    product: service.product,
    customer: service.customer,
  });

  return { success: true, integration };
}

/** Terminates (cancels) the service; `reason` goes to the activity log. */
export async function terminateServiceAs(actorId: string, id: string, reason?: string): Promise<LifecycleResult> {
  const service = await loadService(id);
  if (!service) {
    return { success: false, error: "Hizmet bulunamadı", status: 404 };
  }

  if (service.status === "CANCELLED") {
    return { success: false, error: "Bu hizmet zaten iptal edilmiş", status: 409 };
  }

  const terminatedAt = new Date();
  const updatedService = await db.$transaction(async (tx) => {
    const row = await tx.service.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelledAt: terminatedAt,
      },
    });
    await emitEvent(
      tx,
      "service.terminated",
      {
        serviceId: id,
        customerId: service.customerId,
        serviceLabel: service.label || service.domain || service.product.name,
        terminatedAt,
      },
      { actorId }
    );
    return row;
  });
  const integration = await terminateRemoteService({
    ...updatedService,
    product: service.product,
    customer: service.customer,
  });

  if (reason) {
    await logActivity({
      userId: actorId,
      action: "TERMINATE_SERVICE",
      entity: "Service",
      entityId: id,
      details: { customerId: service.customerId, reason, terminatedAt: terminatedAt.toISOString() },
    });
  }

  return { success: true, integration };
}
