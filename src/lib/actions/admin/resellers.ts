"use server";

import { logActivity } from "@/lib/activity-log";
import { db } from "@/lib/db";
import {
  assignCustomerToReseller,
  listResellers,
} from "@/lib/reseller";
import { requireAdmin } from "@/lib/utils/auth-helpers";
import { revalidatePath } from "next/cache";

function normalizeDiscountPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Number(value.toFixed(2))));
}

export async function getAdminResellers() {
  await requireAdmin();
  return listResellers();
}

export async function enableReseller(userId: string, enabled: boolean) {
  const session = await requireAdmin();

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        surname: true,
        role: true,
        isReseller: true,
      },
    });

    if (!user || user.role !== "CUSTOMER") {
      return { success: false, error: "Müşteri bulunamadı" };
    }

    if (user.isReseller === enabled) {
      return { success: true, data: { id: user.id, isReseller: user.isReseller } };
    }

    const updated = await db.user.update({
      where: { id: userId },
      data: {
        isReseller: enabled,
        ...(enabled ? {} : { resellerDiscountPercent: 0 }),
      },
      select: {
        id: true,
        isReseller: true,
        resellerDiscountPercent: true,
      },
    });

    if (enabled) {
      await logActivity({
        userId: session.user.id,
        action: "ENABLE_RESELLER",
        entity: "User",
        entityId: user.id,
        details: {
          email: user.email,
          name: user.name,
          surname: user.surname,
        },
      });
    } else {
      await logActivity({
        userId: session.user.id,
        action: "DISABLE_RESELLER",
        entity: "User",
        entityId: user.id,
        details: {
          email: user.email,
          name: user.name,
          surname: user.surname,
        },
      });
    }

    revalidatePath("/yonetim/bayiler");
    revalidatePath("/yonetim/musteriler");
    revalidatePath("/yonetim/aktivite");
    revalidatePath("/musteri/panel/bayilik");

    return { success: true, data: updated };
  } catch {
    return { success: false, error: "Bayi durumu güncellenirken bir hata oluştu" };
  }
}

export async function updateResellerDiscount(userId: string, discountPercent: number) {
  const session = await requireAdmin();

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, isReseller: true, email: true },
    });

    if (!user?.isReseller) {
      return { success: false, error: "Kullanıcı aktif bir bayi değil" };
    }

    const normalizedPercent = normalizeDiscountPercent(discountPercent);

    const updated = await db.user.update({
      where: { id: userId },
      data: { resellerDiscountPercent: normalizedPercent },
      select: {
        id: true,
        resellerDiscountPercent: true,
      },
    });

    await logActivity({
      userId: session.user.id,
      action: "UPDATE_RESELLER_DISCOUNT",
      entity: "User",
      entityId: user.id,
      details: {
        email: user.email,
        discountPercent: normalizedPercent,
      },
    });

    revalidatePath("/yonetim/bayiler");
    revalidatePath("/musteri/panel/bayilik");

    return { success: true, data: updated };
  } catch {
    return { success: false, error: "Bayi indirim oranı güncellenirken bir hata oluştu" };
  }
}

export async function assignCustomer(customerId: string, resellerId: string) {
  const session = await requireAdmin();

  try {
    const result = await assignCustomerToReseller(customerId, resellerId);

    const [customer, reseller] = await Promise.all([
      db.user.findUnique({
        where: { id: customerId },
        select: { email: true },
      }),
      db.user.findUnique({
        where: { id: resellerId },
        select: { email: true },
      }),
    ]);

    await logActivity({
      userId: session.user.id,
      action: "ASSIGN_RESELLER_CUSTOMER",
      entity: "User",
      entityId: customerId,
      details: {
        customerEmail: customer?.email,
        resellerId,
        resellerEmail: reseller?.email,
      },
    });

    revalidatePath("/yonetim/bayiler");
    revalidatePath("/yonetim/musteriler");
    revalidatePath("/musteri/panel/bayilik");

    return { success: true, data: result };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "CUSTOMER_NOT_FOUND") {
        return { success: false, error: "Müşteri bulunamadı" };
      }
      if (error.message === "RESELLER_NOT_FOUND") {
        return { success: false, error: "Bayi bulunamadı veya aktif değil" };
      }
      if (error.message === "RESELLER_SELF_ASSIGN") {
        return { success: false, error: "Müşteri kendi bayisi olarak atanamaz" };
      }
    }

    return { success: false, error: "Müşteri bayiye atanırken bir hata oluştu" };
  }
}