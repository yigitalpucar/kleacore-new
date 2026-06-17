"use server";

import { db } from "@/lib/db";
import { requireCustomer } from "@/lib/utils/auth-helpers";
import { runRemoteServerAction } from "@/lib/integrations/provisioning-provider";
import { revalidatePath } from "next/cache";

async function findOwnedService(serviceId: string, userId: string) {
  return db.service.findFirst({
    where: {
      id: serviceId,
      customerId: userId,
      product: { category: { slug: { in: ["vds", "vps", "cloud", "server"] } } },
    },
    include: {
      product: {
        include: {
          category: true,
        },
      },
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

  const integration = await runRemoteServerAction(service, "restart");

  await db.service.update({
    where: { id: serviceId },
    data: { status: "ACTIVE" },
  });

  revalidatePath("/musteri/panel/sunucular");
  return { success: true, integration };
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

  const integration = await runRemoteServerAction(service, "stop");

  await db.service.update({
    where: { id: serviceId },
    data: { status: "SUSPENDED", suspendedAt: new Date() },
  });

  revalidatePath("/musteri/panel/sunucular");
  return { success: true, integration };
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

  const integration = await runRemoteServerAction(service, "start");

  await db.service.update({
    where: { id: serviceId },
    data: { status: "ACTIVE", suspendedAt: null },
  });

  revalidatePath("/musteri/panel/sunucular");
  return { success: true, integration };
}
