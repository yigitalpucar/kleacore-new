"use server";

import { db } from "@/lib/db";
import { persistSettingValue } from "@/lib/secrets/crypto";
import {
  isSecretSettingKey,
  MASKED_SECRET_PLACEHOLDER,
} from "@/lib/secrets/setting-keys";
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

    const secretKeysToPreserve = data
      .filter(
        (setting) =>
          isSecretSettingKey(setting.key) &&
          (!setting.value || setting.value === MASKED_SECRET_PLACEHOLDER)
      )
      .map((setting) => setting.key);

    const preservedValues = secretKeysToPreserve.length
      ? await db.setting.findMany({
          where: { key: { in: secretKeysToPreserve } },
          select: { key: true, value: true },
        })
      : [];

    const preservedMap = new Map(
      preservedValues.map((setting) => [setting.key, setting.value])
    );

    const settingsToPersist = data
      .map((setting) => {
        if (
          isSecretSettingKey(setting.key) &&
          (!setting.value || setting.value === MASKED_SECRET_PLACEHOLDER)
        ) {
          const preserved = preservedMap.get(setting.key);
          if (!preserved) {
            return null;
          }

          return { key: setting.key, value: preserved };
        }

        return {
          key: setting.key,
          value: persistSettingValue(setting.key, setting.value),
        };
      })
      .filter((setting): setting is SettingInput => setting !== null);

    if (settingsToPersist.length === 0) {
      return { success: false, error: "Güncellenecek ayar bulunamadı" };
    }

    await db.$transaction(
      settingsToPersist.map((setting) =>
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
    revalidatePath("/yonetim/entegrasyonlar");
    return { success: true };
  } catch {
    return { success: false, error: "Ayarlar güncellenirken bir hata oluştu" };
  }
}