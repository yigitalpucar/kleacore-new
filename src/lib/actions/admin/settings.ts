"use server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/utils/auth-helpers";
import { revalidatePath } from "next/cache";

interface SettingInput {
  key: string;
  value: string;
}

export async function updateSettings(data: SettingInput[]) {
  await requireAdmin();

  try {
    if (!Array.isArray(data) || data.length === 0) {
      return { success: false, error: "Güncellenecek ayar bulunamadı" };
    }

    await db.$transaction(
      data.map((setting) =>
        db.setting.upsert({
          where: { key: setting.key },
          update: { value: setting.value },
          create: {
            key: setting.key,
            value: setting.value,
          },
        })
      )
    );

    revalidatePath("/yonetim/ayarlar");
    return { success: true };
  } catch {
    return { success: false, error: "Ayarlar güncellenirken bir hata oluştu" };
  }
}
