import { db } from "@/lib/db";

export async function getSettings() {
  return db.setting.findMany({
    orderBy: [{ group: "asc" }, { key: "asc" }],
  });
}

export async function getSettingsByGroup(group: string) {
  return db.setting.findMany({
    where: { group },
    orderBy: { key: "asc" },
  });
}

export async function getSettingByKey(key: string) {
  return db.setting.findUnique({
    where: { key },
  });
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
      key: true,
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
      key: true,
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
