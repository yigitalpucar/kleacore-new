"use server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/utils/auth-helpers";
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

    revalidatePath("/yonetim/hizmetler");
    return { success: true, data: { id: service.id } };
  } catch {
    return { success: false, error: "Hizmet oluşturulurken bir hata oluştu" };
  }
}

export async function suspendService(id: string, reason: string) {
  await requireAdmin();

  try {
    const service = await db.service.findUnique({ where: { id } });
    if (!service) {
      return { success: false, error: "Hizmet bulunamadı" };
    }

    if (service.status !== "ACTIVE") {
      return { success: false, error: "Sadece aktif hizmetler askıya alınabilir" };
    }

    await db.service.update({
      where: { id },
      data: {
        status: "SUSPENDED",
        suspendedAt: new Date(),
        suspendReason: reason,
      },
    });

    revalidatePath("/yonetim/hizmetler");
    return { success: true };
  } catch {
    return { success: false, error: "Hizmet askıya alınırken bir hata oluştu" };
  }
}

export async function activateService(id: string) {
  await requireAdmin();

  try {
    const service = await db.service.findUnique({ where: { id } });
    if (!service) {
      return { success: false, error: "Hizmet bulunamadı" };
    }

    if (service.status !== "SUSPENDED") {
      return { success: false, error: "Sadece askıdaki hizmetler aktifleştirilebilir" };
    }

    await db.service.update({
      where: { id },
      data: {
        status: "ACTIVE",
        suspendedAt: null,
        suspendReason: null,
      },
    });

    revalidatePath("/yonetim/hizmetler");
    return { success: true };
  } catch {
    return { success: false, error: "Hizmet aktifleştirilirken bir hata oluştu" };
  }
}

export async function cancelService(id: string) {
  await requireAdmin();

  try {
    const service = await db.service.findUnique({ where: { id } });
    if (!service) {
      return { success: false, error: "Hizmet bulunamadı" };
    }

    if (service.status === "CANCELLED") {
      return { success: false, error: "Bu hizmet zaten iptal edilmiş" };
    }

    await db.service.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
      },
    });

    revalidatePath("/yonetim/hizmetler");
    return { success: true };
  } catch {
    return { success: false, error: "Hizmet iptal edilirken bir hata oluştu" };
  }
}
