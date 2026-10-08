"use server";

import { signIn } from "@/lib/auth";
import { issueLoginToken } from "@/lib/auth/login-token";
import { db } from "@/lib/db";
import { requireCustomer } from "@/lib/utils/auth-helpers";
import {
  profileUpdateSchema,
  passwordChangeSchema,
} from "@/lib/validations/customer";
import { compare, hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { emitEventAfterCommit } from "@/lib/events/emit";

export async function updateProfile(formData: FormData) {
  const session = await requireCustomer();

  try {
    const raw = {
      name: formData.get("name") as string,
      surname: formData.get("surname") as string,
      phone: (formData.get("phone") as string) || undefined,
      address: (formData.get("address") as string) || undefined,
      city: (formData.get("city") as string) || undefined,
      companyName: (formData.get("companyName") as string) || undefined,
      taxNumber: (formData.get("taxNumber") as string) || undefined,
      taxOffice: (formData.get("taxOffice") as string) || undefined,
    };

    const parsed = profileUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message ?? "Geçersiz bilgiler",
      };
    }

    await db.user.update({
      where: { id: session.user.id },
      data: {
        name: parsed.data.name,
        surname: parsed.data.surname,
        phone: parsed.data.phone ?? null,
        address: parsed.data.address ?? null,
        city: parsed.data.city ?? null,
        companyName: parsed.data.companyName ?? null,
        taxNumber: parsed.data.taxNumber ?? null,
        taxOffice: parsed.data.taxOffice ?? null,
      },
    });

    revalidatePath("/musteri/panel/ayarlar");
    return { success: true };
  } catch {
    return { success: false, error: "Profil güncellenirken bir hata oluştu" };
  }
}

export async function changePassword(formData: FormData) {
  const session = await requireCustomer();

  try {
    const raw = {
      currentPassword: formData.get("currentPassword") as string,
      newPassword: formData.get("newPassword") as string,
      confirmPassword: formData.get("confirmPassword") as string,
    };

    const parsed = passwordChangeSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message ?? "Geçersiz bilgiler",
      };
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, password: true },
    });

    if (!user) {
      return { success: false, error: "Kullanıcı bulunamadı" };
    }

    const isCurrentValid = await compare(
      parsed.data.currentPassword,
      user.password
    );
    if (!isCurrentValid) {
      return { success: false, error: "Mevcut şifre hatalı" };
    }

    const hashedPassword = await hash(parsed.data.newPassword, 12);

    // Bumping sessionVersion revokes every other session of this user.
    await db.user.update({
      where: { id: session.user.id },
      data: { password: hashedPassword, sessionVersion: { increment: 1 } },
    });

    // "Şifreniz değiştirildi" via the outbox (notifications subscriber).
    await emitEventAfterCommit(
      "user.password_changed",
      { userId: session.user.id, changedAt: new Date(), method: "profile" },
      { actorId: session.user.id }
    );

    // Re-issue the current session so the user who just changed the password
    // stays signed in on this device.
    try {
      await signIn("credentials", {
        email: user.email,
        loginToken: await issueLoginToken(user),
        redirect: false,
      });
    } catch (error) {
      console.error("[Profile] session re-issue after password change failed:", error);
    }

    return { success: true };
  } catch {
    return { success: false, error: "Şifre değiştirilirken bir hata oluştu" };
  }
}
