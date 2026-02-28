"use server";

import { db } from "@/lib/db";
import { requireCustomer } from "@/lib/utils/auth-helpers";
import { revalidatePath } from "next/cache";

export async function toggleAutoRenew(certificateId: string) {
  const session = await requireCustomer();
  const userId = session.user.id;

  const cert = await db.sslCertificate.findFirst({
    where: { id: certificateId, customerId: userId },
  });

  if (!cert) {
    return { success: false, error: "Sertifika bulunamadı" };
  }

  if (cert.status === "EXPIRED" || cert.status === "PENDING") {
    return { success: false, error: "Bu sertifika için otomatik yenileme değiştirilemez" };
  }

  await db.sslCertificate.update({
    where: { id: certificateId },
    data: { autoRenew: !cert.autoRenew },
  });

  revalidatePath("/musteri/panel/ssl");
  return { success: true, autoRenew: !cert.autoRenew };
}
