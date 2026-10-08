"use server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/utils/auth-helpers";
import {
  createRemoteService,
  suspendRemoteService,
  terminateRemoteService,
  unsuspendRemoteService,
} from "@/lib/integrations/provisioning-provider";
import { emitEvent } from "@/lib/events/emit";
import { logActivity } from "@/lib/activity-log";
import { productPeriodPricing } from "@/lib/billing/period-price";
import { revalidatePath } from "next/cache";
import type { BillingPeriod } from "@prisma/client";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin.services");

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
      include: {
        category: true,
        pricingTiers: {
          where: { isActive: true },
          select: { period: true, price: true, isDefault: true },
        },
      },
    });
    if (!product) {
      return { success: false, error: "Ürün bulunamadı" };
    }

    const billingPeriod = data.billingPeriod ?? "monthly";
    // Service.amount is the VAT-exclusive charge for one full billing period
    // (what renewals bill), so a yearly hosting stores the yearly total, not
    // the monthly-equivalent tier price.
    const amount =
      data.amount ??
      productPeriodPricing(
        {
          basePrice: Number(product.basePrice),
          categorySlug: product.category.slug,
          pricingTiers: product.pricingTiers,
        },
        billingPeriod
      ).total;

    // Bound product (Faz 2.2): the new account goes to the instance the
    // product resolves to; unbound products keep the legacy provider.
    const plan = product.moduleInstanceId
      ? await (await import("@/lib/modules/provisioning")).planProductProvisioning(product)
      : null;

    const service = await db.service.create({
      data: {
        moduleInstanceId: plan?.mode === "module" ? plan.instanceId : null,
        customerId: data.customerId,
        productId: data.productId,
        label: data.label ?? "",
        domain: data.domain ?? null,
        username: data.username ?? null,
        ipAddress: data.ipAddress ?? null,
        serverName: data.serverName ?? null,
        billingPeriod,
        amount,
        nextDueDate: data.nextDueDate ? new Date(data.nextDueDate) : null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        diskLimit: data.diskLimit ?? null,
        bandwidthLimit: data.bandwidthLimit ?? null,
        status: "ACTIVE",
      },
    });

    const integration =
      plan?.mode === "manual"
        ? { ok: false, provider: "module", error: plan.reason, reference: undefined }
        : await createRemoteService({
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
  } catch (error) {
    log.error("create service failed", { error });
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
        { actorId: session.user.id }
      );
      return row;
    });
    const integration = await suspendRemoteService(
      { ...updatedService, product: service.product, customer: service.customer },
      reason
    );

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
  } catch (error) {
    log.error("suspend service failed", { error });
    return { success: false, error: "Hizmet askıya alınırken bir hata oluştu" };
  }
}

export async function activateService(id: string) {
  const session = await requireAdmin();

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
        { actorId: session.user.id }
      );
      return row;
    });
    const integration = await unsuspendRemoteService({
      ...updatedService,
      product: service.product,
      customer: service.customer,
    });

    revalidatePath("/yonetim/hizmetler");
    return { success: true, integration };
  } catch (error) {
    log.error("activate service failed", { error });
    return { success: false, error: "Hizmet aktifleştirilirken bir hata oluştu" };
  }
}

export async function cancelService(id: string) {
  const session = await requireAdmin();

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
        { actorId: session.user.id }
      );
      return row;
    });
    const integration = await terminateRemoteService({
      ...updatedService,
      product: service.product,
      customer: service.customer,
    });

    revalidatePath("/yonetim/hizmetler");
    return { success: true, integration };
  } catch (error) {
    log.error("cancel service failed", { error });
    return { success: false, error: "Hizmet iptal edilirken bir hata oluştu" };
  }
}
