"use server";

import { db } from "@/lib/db";
import { syncRegistrarTldPricing } from "@/lib/integrations/registrar";
import { requirePermission } from "@/lib/utils/auth-helpers";
import { revalidatePath } from "next/cache";

export async function syncRegistrarTldsFromProvider() {
  await requirePermission("domains.manage");

  const result = await syncRegistrarTldPricing();
  if (!result.ok || !result.data) {
    return {
      success: false as const,
      error: result.error ?? "TLD fiyatları alınamadı",
    };
  }

  let upserted = 0;
  const now = new Date();

  // Gri's price list is OUR cost, not the customer price: store it as cost
  // only. Sale prices change solely when an admin applies the suggestions on
  // /yonetim/urunler/tld-fiyatlari (or the opt-in auto-apply does). A TLD
  // seen for the first time is created inactive with no sale price.
  for (const row of result.data) {
    const cost = {
      costRegister: row.register > 0 ? row.register : null,
      costRenew: row.renew > 0 ? row.renew : null,
      costTransfer: row.transfer > 0 ? row.transfer : null,
      costCurrency: (row.currency || "TRY").toUpperCase(),
      costUpdatedAt: now,
    };
    await db.domainTld.upsert({
      where: { ext: row.tld },
      create: {
        ext: row.tld,
        category: "generic",
        registerPrice: 0,
        renewPrice: 0,
        transferPrice: 0,
        isActive: false,
        ...cost,
      },
      update: cost,
    });
    upserted += 1;
  }

  revalidatePath("/yonetim/ayarlar");
  revalidatePath("/yonetim/entegrasyonlar");
  revalidatePath("/domain/kayit");
  revalidatePath("/yonetim/urunler/tld-fiyatlari");

  return {
    success: true as const,
    data: { upserted },
  };
}