"use server";

import { db } from "@/lib/db";
import { requireCustomer } from "@/lib/utils/auth-helpers";
import { revalidatePath } from "next/cache";

async function findOwnedService(serviceId: string, userId: string) {
  return db.service.findFirst({
    where: {
      id: serviceId,
      customerId: userId,
      product: { category: { slug: { in: ["vds", "vps", "server"] } } },
    },
  });
}

export async function restartServer(serviceId: string) {
  const session = await requireCustomer();
  const userId = session.user.id;

  const service = await findOwnedService(serviceId, userId);
  if (!service) {
    return { success: false, error: "Sunucu bulunamadi" };
  }

  if (service.status !== "ACTIVE") {
    return { success: false, error: "Sadece aktif sunucular yeniden baslatilabilir" };
  }

  // Gercek sunucu islemi yerine status guncelleme (simdilik)
  await db.service.update({
    where: { id: serviceId },
    data: { status: "ACTIVE" },
  });

  revalidatePath("/musteri/panel/sunucular");
  return { success: true };
}

export async function stopServer(serviceId: string) {
  const session = await requireCustomer();
  const userId = session.user.id;

  const service = await findOwnedService(serviceId, userId);
  if (!service) {
    return { success: false, error: "Sunucu bulunamadi" };
  }

  if (service.status !== "ACTIVE") {
    return { success: false, error: "Sunucu zaten aktif degil" };
  }

  await db.service.update({
    where: { id: serviceId },
    data: { status: "SUSPENDED", suspendedAt: new Date() },
  });

  revalidatePath("/musteri/panel/sunucular");
  return { success: true };
}

export async function startServer(serviceId: string) {
  const session = await requireCustomer();
  const userId = session.user.id;

  const service = await findOwnedService(serviceId, userId);
  if (!service) {
    return { success: false, error: "Sunucu bulunamadi" };
  }

  if (service.status === "ACTIVE") {
    return { success: false, error: "Sunucu zaten aktif" };
  }

  if (service.status === "CANCELLED") {
    return { success: false, error: "Iptal edilmis sunucu baslatilamaz" };
  }

  await db.service.update({
    where: { id: serviceId },
    data: { status: "ACTIVE", suspendedAt: null },
  });

  revalidatePath("/musteri/panel/sunucular");
  return { success: true };
}
