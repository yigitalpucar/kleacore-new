"use server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/utils/auth-helpers";
import {
  createRemoteService,
  suspendRemoteService,
  terminateRemoteService,
  unsuspendRemoteService,
} from "@/lib/integrations/provisioning-provider";
import {
  dispatchNotification,
  loadCustomerRecipient,
  sendServiceSuspendedEmail,
} from "@/lib/notifications/email";
import { logActivity } from "@/lib/activity-log";
import { revalidatePath } from "next/cache";
import type { BillingPeriod } from "@prisma/client";

interface ServiceInput {
  customerId: string;
  productId: string;
  label?: string;
  domain?: string;
  username?: string;
  ipAddress?: string;
  serverName?: string;
  billingPeriod?: BillingPeriod;
  amount?: number;
  nextDueDate?: string;
  expiresAt?: string;
  diskLimit?: number;
  bandwidthLimit?: number;
}

export async function createService(data: ServiceInput) {
  await requireAdmin();

  try {
    const customer = await db.user.findUnique({
      where: { id: data.customerId },
    });
    if (!customer) {
      return { success: false, error: "Müşteri bulunamadı" };
    }

    const product = await db.product.findUnique({
      where: { id: data.productId },
      include: { category: true },
    });
    if (!product) {
      return { success: false, error: "Ürün bulunamadı" };
    }

    const service = await db.service.create({
      data: {
        customerId: data.customerId,
        productId: data.productId,
        label: data.label ?? "",
        domain: data.domain ?? null,
        username: data.username ?? null,
        ipAddress: data.ipAddress ?? null,
        serverName: data.serverName ?? null,
        billingPeriod: data.billingPeriod ?? "monthly",
        amount: data.amount ?? 0,
        nextDueDate: data.nextDueDate ? new Date(data.nextDueDate) : null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        diskLimit: data.diskLimit ?? null,
        bandwidthLimit: data.bandwidthLimit ?? null,
        status: "ACTIVE",
      },
    });

    const integration = await createRemoteService({
      ...service,
      product,
      customer,
    });

    if (integration.ok && integration.reference) {
      await db.service.update({
        where: { id: service.id },
        data: { serverName: integration.reference },
      });
    }

    revalidatePath("/yonetim/hizmetler");
    return { success: true, data: { id: service.id, integration } };
  } catch {
    return { success: false, error: "Hizmet oluşturulurken bir hata oluştu" };
  }
}

export async function suspendService(id: string, reason: string) {
  const session = await requireAdmin();

  try {
    const service = await db.service.findUnique({
      where: { id },
      include: {
        product: {
          include: { category: true },
        },
        customer: {
          select: { id: true, name: true, surname: true, email: true },
        },
      },
    });
    if (!service) {
      return { success: false, error: "Hizmet bulunamadı" };
    }

    if (service.status !== "ACTIVE") {
      return { success: false, error: "Sadece aktif hizmetler askıya alınabilir" };
    }

    const suspendedAt = new Date();
    const updatedService = await db.service.update({
      where: { id },
      data: {
        status: "SUSPENDED",
        suspendedAt,
        suspendReason: reason,
      },
    });
    const integration = await suspendRemoteService(
      { ...updatedService, product: service.product, customer: service.customer },
      reason
    );

    dispatchNotification(async () => {
      const customer = await loadCustomerRecipient(service.customerId);
      if (!customer) {
        return;
      }

      await sendServiceSuspendedEmail({
        customer,
        serviceId: service.id,
        serviceLabel: service.label || service.domain || service.product.name,
        reason,
        suspendedAt,
      });
    });

    await logActivity({
      userId: session.user.id,
      action: "SUSPEND_SERVICE",
      entity: "Service",
      entityId: id,
      details: {
        serviceLabel: service.label || service.domain || service.product.name,
        customerId: service.customerId,
        reason,
        suspendedAt: suspendedAt.toISOString(),
      },
    });

    revalidatePath("/yonetim/hizmetler");
    revalidatePath("/yonetim/aktivite");
    revalidatePath("/musteri/panel/hizmetlerim");
    revalidatePath("/musteri/panel/e-posta");
    return { success: true, integration };
  } catch {
    return { success: false, error: "Hizmet askıya alınırken bir hata oluştu" };
  }
}

export async function activateService(id: string) {
  await requireAdmin();

  try {
    const service = await db.service.findUnique({
      where: { id },
      include: {
        product: { include: { category: true } },
        customer: {
          select: { id: true, name: true, surname: true, email: true },
        },
      },
    });
    if (!service) {
      return { success: false, error: "Hizmet bulunamadı" };
    }

    if (service.status !== "SUSPENDED") {
      return { success: false, error: "Sadece askıdaki hizmetler aktifleştirilebilir" };
    }

    const updatedService = await db.service.update({
      where: { id },
      data: {
        status: "ACTIVE",
        suspendedAt: null,
        suspendReason: null,
      },
    });
    const integration = await unsuspendRemoteService({
      ...updatedService,
      product: service.product,
      customer: service.customer,
    });

    revalidatePath("/yonetim/hizmetler");
    return { success: true, integration };
  } catch {
    return { success: false, error: "Hizmet aktifleştirilirken bir hata oluştu" };
  }
}

export async function cancelService(id: string) {
  await requireAdmin();

  try {
    const service = await db.service.findUnique({
      where: { id },
      include: {
        product: { include: { category: true } },
        customer: {
          select: { id: true, name: true, surname: true, email: true },
        },
      },
    });
    if (!service) {
      return { success: false, error: "Hizmet bulunamadı" };
    }

    if (service.status === "CANCELLED") {
      return { success: false, error: "Bu hizmet zaten iptal edilmiş" };
    }

    const updatedService = await db.service.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
      },
    });
    const integration = await terminateRemoteService({
      ...updatedService,
      product: service.product,
      customer: service.customer,
    });

    revalidatePath("/yonetim/hizmetler");
    return { success: true, integration };
  } catch {
    return { success: false, error: "Hizmet iptal edilirken bir hata oluştu" };
  }
}
