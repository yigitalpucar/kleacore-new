"use server";

import { db } from "@/lib/db";
import { syncRegistrarTldPricing } from "@/lib/integrations/registrar";
import { requireAdmin } from "@/lib/utils/auth-helpers";
import { revalidatePath } from "next/cache";

export async function syncRegistrarTldsFromProvider() {
  await requireAdmin();

  const result = await syncRegistrarTldPricing();
  if (!result.ok || !result.data) {
    return {
      success: false as const,
      error: result.error ?? "TLD fiyatları alınamadı",
    };
  }

  let upserted = 0;

  for (const row of result.data) {
    await db.domainTld.upsert({
      where: { ext: row.tld },
      create: {
        ext: row.tld,
        category: "generic",
        registerPrice: row.register,
        renewPrice: row.renew,
        transferPrice: row.transfer,
        isActive: true,
      },
      update: {
        registerPrice: row.register,
        renewPrice: row.renew,
        transferPrice: row.transfer,
        isActive: true,
      },
    });
    upserted += 1;
  }

  revalidatePath("/yonetim/ayarlar");
  revalidatePath("/yonetim/entegrasyonlar");
  revalidatePath("/domain/kayit");

  return {
    success: true as const,
    data: { upserted },
  };
}