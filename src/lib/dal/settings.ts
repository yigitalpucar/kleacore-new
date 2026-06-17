import { db } from "@/lib/db";
import { resolveSettingValue } from "@/lib/secrets/crypto";

function mapSettingValue<T extends { key: string; value: string }>(setting: T) {
  return {
    ...setting,
    value: resolveSettingValue(setting.key, setting.value),
  };
}

export async function getSettings() {
  const settings = await db.setting.findMany({
    orderBy: [{ group: "asc" }, { key: "asc" }],
  });

  return settings.map(mapSettingValue);
}

export async function getSettingsByGroup(group: string) {
  const settings = await db.setting.findMany({
    where: { group },
    orderBy: { key: "asc" },
  });

  return settings.map(mapSettingValue);
}

export async function getSettingByKey(key: string) {
  const setting = await db.setting.findUnique({
    where: { key },
  });

  if (!setting) {
    return null;
  }

  return mapSettingValue(setting);
}

export async function getAdminUsers() {
  return db.user.findMany({
    where: { role: "ADMIN" },
    select: {
      id: true,
      name: true,
      surname: true,
      email: true,
      lastLoginAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getApiKeys() {
  return db.apiKey.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      createdAt: true,
      lastUsedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getApiKeysByUser(userId: string) {
  return db.apiKey.findMany({
    where: { userId, isActive: true },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      createdAt: true,
      lastUsedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getUserProfile(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      surname: true,
      email: true,
      phone: true,
      companyName: true,
      taxNumber: true,
      taxOffice: true,
      address: true,
      city: true,
      country: true,
    },
  });
}