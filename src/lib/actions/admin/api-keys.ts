"use server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/utils/auth-helpers";
import { apiKeyIdSchema } from "@/lib/validations/customer";
import { revalidatePath } from "next/cache";

export async function revokeApiKeyByAdmin(formData: FormData) {
  await requireAdmin();

  try {
    const raw = {
      id: formData.get("id") as string,
    };

    const parsed = apiKeyIdSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message ?? "Geçersiz bilgiler",
      };
    }

    const apiKey = await db.apiKey.findUnique({
      where: { id: parsed.data.id },
    });

    if (!apiKey) {
      return { success: false, error: "API anahtarı bulunamadı" };
    }

    if (!apiKey.isActive) {
      return { success: false, error: "API anahtarı zaten iptal edilmiş" };
    }

    await db.apiKey.update({
      where: { id: parsed.data.id },
      data: { isActive: false },
    });

    revalidatePath("/yonetim/ayarlar");
    return { success: true };
  } catch {
    return { success: false, error: "API anahtarı iptal edilirken bir hata oluştu" };
  }
}