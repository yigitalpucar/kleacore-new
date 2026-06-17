"use server";

import { db } from "@/lib/db";
import {
  generateApiKeyValue,
  getApiKeyPrefix,
  hashApiKey,
} from "@/lib/secrets/api-keys";
import { requireCustomer } from "@/lib/utils/auth-helpers";
import { apiKeyCreateSchema, apiKeyIdSchema } from "@/lib/validations/customer";
import { revalidatePath } from "next/cache";

async function getOwnedApiKey(userId: string, id: string) {
  return db.apiKey.findFirst({
    where: { id, userId },
  });
}

export async function createApiKey(formData: FormData) {
  const session = await requireCustomer();

  try {
    const raw = {
      name: formData.get("name") as string,
    };

    const parsed = apiKeyCreateSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message ?? "Geçersiz bilgiler",
      };
    }

    const key = generateApiKeyValue();

    const apiKey = await db.apiKey.create({
      data: {
        userId: session.user.id,
        name: parsed.data.name,
        keyPrefix: getApiKeyPrefix(key),
        keyHash: hashApiKey(key),
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    });

    revalidatePath("/musteri/panel/ayarlar");
    return {
      success: true,
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        key,
        createdAt: apiKey.createdAt.toISOString(),
      },
    };
  } catch {
    return { success: false, error: "API anahtarı oluşturulurken bir hata oluştu" };
  }
}

export async function revokeApiKey(formData: FormData) {
  const session = await requireCustomer();

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

    const apiKey = await getOwnedApiKey(session.user.id, parsed.data.id);
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

    revalidatePath("/musteri/panel/ayarlar");
    return { success: true };
  } catch {
    return { success: false, error: "API anahtarı iptal edilirken bir hata oluştu" };
  }
}

export async function deleteApiKey(formData: FormData) {
  const session = await requireCustomer();

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

    const apiKey = await getOwnedApiKey(session.user.id, parsed.data.id);
    if (!apiKey) {
      return { success: false, error: "API anahtarı bulunamadı" };
    }

    await db.apiKey.delete({
      where: { id: parsed.data.id },
    });

    revalidatePath("/musteri/panel/ayarlar");
    return { success: true };
  } catch {
    return { success: false, error: "API anahtarı silinirken bir hata oluştu" };
  }
}