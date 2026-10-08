"use server";

import { generateUniqueAffiliateCode } from "@/lib/affiliate";
import { findUserByEmail, normalizeEmail } from "@/lib/auth/email";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/utils/auth-helpers";
import { logActivity } from "@/lib/activity-log";
import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";

export async function createCustomer(formData: FormData) {
  const session = await requireAdmin();

  try {
    const email = normalizeEmail((formData.get("email") as string | null) ?? "");
    const password = formData.get("password") as string;
    const name = formData.get("name") as string;
    const surname = formData.get("surname") as string;
    const phone = (formData.get("phone") as string) || null;
    const customerType = (formData.get("customerType") as "INDIVIDUAL" | "CORPORATE") || "INDIVIDUAL";
    const companyName = (formData.get("companyName") as string) || null;
    const taxNumber = (formData.get("taxNumber") as string) || null;
    const taxOffice = (formData.get("taxOffice") as string) || null;
    const address = (formData.get("address") as string) || null;
    const city = (formData.get("city") as string) || null;

    if (!email || !password || !name) {
      return { success: false, error: "E-posta, şifre ve ad zorunludur" };
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return { success: false, error: "Bu e-posta adresi zaten kayıtlı" };
    }

    const hashedPassword = await hash(password, 12);

    const user = await db.$transaction(async (tx) => {
      const affiliateCode = await generateUniqueAffiliateCode(tx, name);

      return tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          surname: surname || "",
          phone,
          customerType,
          companyName,
          taxNumber,
          taxOffice,
          address,
          city,
          role: "CUSTOMER",
          status: "ACTIVE",
          affiliateCode,
          // Created by an admin: the address is vouched for, no verification mail.
          emailVerifiedAt: new Date(),
        },
      });
    });

    await logActivity({
      userId: session.user.id,
      action: "CREATE_CUSTOMER",
      entity: "User",
      entityId: user.id,
      details: {
        email: user.email,
        name: user.name,
        surname: user.surname,
        customerType: user.customerType,
      },
    });

    revalidatePath("/yonetim/musteriler");
    revalidatePath("/yonetim/aktivite");
    return { success: true, data: { id: user.id } };
  } catch {
    return { success: false, error: "Müşteri oluşturulurken bir hata oluştu" };
  }
}

export async function updateCustomer(id: string, formData: FormData) {
  await requireAdmin();

  try {
    const name = formData.get("name") as string;
    const surname = formData.get("surname") as string;
    const phone = (formData.get("phone") as string) || null;
    const customerType = (formData.get("customerType") as "INDIVIDUAL" | "CORPORATE") || undefined;
    const companyName = (formData.get("companyName") as string) || null;
    const taxNumber = (formData.get("taxNumber") as string) || null;
    const taxOffice = (formData.get("taxOffice") as string) || null;
    const address = (formData.get("address") as string) || null;
    const city = (formData.get("city") as string) || null;

    const user = await db.user.findUnique({ where: { id } });
    if (!user) {
      return { success: false, error: "Müşteri bulunamadı" };
    }

    await db.user.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(surname && { surname }),
        phone,
        ...(customerType && { customerType }),
        companyName,
        taxNumber,
        taxOffice,
        address,
        city,
      },
    });

    revalidatePath("/yonetim/musteriler");
    return { success: true };
  } catch {
    return { success: false, error: "Müşteri güncellenirken bir hata oluştu" };
  }
}

export async function suspendCustomer(id: string) {
  await requireAdmin();

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
  await requireAdmin();

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
  const session = await requireAdmin();

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
  await requireAdmin();

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
