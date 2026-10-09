"use server";

import { createCustomerAccount, updateCustomerProfile, type CustomerType } from "@/lib/customers/admin";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/utils/auth-helpers";
import { logActivity } from "@/lib/activity-log";
import { revalidatePath } from "next/cache";

export async function createCustomer(formData: FormData) {
  const session = await requirePermission("customers.edit");

  try {
    const optional = (key: string) => (formData.get(key) as string) || null;
    const result = await createCustomerAccount(session.user.id, {
      email: (formData.get("email") as string | null) ?? "",
      password: formData.get("password") as string,
      name: formData.get("name") as string,
      surname: formData.get("surname") as string,
      phone: optional("phone"),
      customerType: (formData.get("customerType") as CustomerType) || "INDIVIDUAL",
      companyName: optional("companyName"),
      taxNumber: optional("taxNumber"),
      taxOffice: optional("taxOffice"),
      address: optional("address"),
      city: optional("city"),
    });
    if (!result.success) return result;

    revalidatePath("/yonetim/musteriler");
    revalidatePath("/yonetim/aktivite");
    return result;
  } catch {
    return { success: false, error: "Müşteri oluşturulurken bir hata oluştu" };
  }
}

export async function updateCustomer(id: string, formData: FormData) {
  await requirePermission("customers.edit");

  try {
    const optional = (key: string) => (formData.get(key) as string) || null;
    const result = await updateCustomerProfile(id, {
      name: formData.get("name") as string,
      surname: formData.get("surname") as string,
      phone: optional("phone"),
      customerType: (formData.get("customerType") as CustomerType) || undefined,
      companyName: optional("companyName"),
      taxNumber: optional("taxNumber"),
      taxOffice: optional("taxOffice"),
      address: optional("address"),
      city: optional("city"),
    });
    if (!result.success) return result;

    revalidatePath("/yonetim/musteriler");
    return { success: true };
  } catch {
    return { success: false, error: "Müşteri güncellenirken bir hata oluştu" };
  }
}

export async function suspendCustomer(id: string) {
  await requirePermission("customers.edit");

  try {
    const user = await db.user.findUnique({ where: { id } });
    if (!user) {
      return { success: false, error: "Müşteri bulunamadı" };
    }

    await db.user.update({
      where: { id },
      data: { status: "SUSPENDED" },
    });

    revalidatePath("/yonetim/musteriler");
    return { success: true };
  } catch {
    return { success: false, error: "Müşteri askıya alınırken bir hata oluştu" };
  }
}

export async function activateCustomer(id: string) {
  await requirePermission("customers.edit");

  try {
    const user = await db.user.findUnique({ where: { id } });
    if (!user) {
      return { success: false, error: "Müşteri bulunamadı" };
    }

    await db.user.update({
      where: { id },
      data: { status: "ACTIVE" },
    });

    revalidatePath("/yonetim/musteriler");
    return { success: true };
  } catch {
    return { success: false, error: "Müşteri aktifleştirilirken bir hata oluştu" };
  }
}

/** Marks a customer's e-mail as verified (e.g. verified by phone/support). */
export async function markCustomerEmailVerified(id: string) {
  const session = await requirePermission("customers.edit");

  try {
    const user = await db.user.findUnique({
      where: { id },
      select: { id: true, email: true, emailVerifiedAt: true },
    });
    if (!user) {
      return { success: false, error: "Müşteri bulunamadı" };
    }
    if (user.emailVerifiedAt) {
      return { success: true };
    }

    await db.$transaction([
      db.user.update({ where: { id }, data: { emailVerifiedAt: new Date() } }),
      db.emailVerificationToken.deleteMany({ where: { userId: id, usedAt: null } }),
    ]);

    await logActivity({
      userId: session.user.id,
      action: "MARK_EMAIL_VERIFIED",
      entity: "User",
      entityId: id,
      details: { email: user.email },
    });

    revalidatePath(`/yonetim/musteriler/${id}`);
    return { success: true };
  } catch {
    return { success: false, error: "E-posta doğrulaması kaydedilemedi" };
  }
}

export async function deleteCustomer(id: string) {
  await requirePermission("customers.edit");

  try {
    const user = await db.user.findUnique({ where: { id } });
    if (!user) {
      return { success: false, error: "Müşteri bulunamadı" };
    }

    await db.user.update({
      where: { id },
      data: { status: "CLOSED" },
    });

    revalidatePath("/yonetim/musteriler");
    return { success: true };
  } catch {
    return { success: false, error: "Müşteri silinirken bir hata oluştu" };
  }
}
