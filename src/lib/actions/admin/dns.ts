"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity-log";
import { DNS_PROVIDERS, saveDnsSettings, type DnsDefaultProvider } from "@/lib/dns/settings";
import { isIPv4, isIPv6 } from "@/lib/dns/validation";
import { requireAdmin } from "@/lib/utils/auth-helpers";

function revalidateDns(domainId?: string) {
  revalidatePath("/yonetim/dns");
  if (domainId) {
    revalidatePath(`/yonetim/domainler/${domainId}`);
    revalidatePath(`/musteri/panel/domainler/${domainId}`);
  }
}

/** DNS ownership setting + hosting IP fallback (Yönetim → DNS). */
export async function saveDnsSettingsAction(input: { provider: string; hostingIp: string }) {
  const session = await requireAdmin();
  if (!(DNS_PROVIDERS as readonly string[]).includes(input.provider)) {
    return { success: false as const, error: "Geçersiz DNS sağlayıcısı" };
  }
  const hostingIp = input.hostingIp.trim();
  if (hostingIp && !isIPv4(hostingIp) && !isIPv6(hostingIp)) {
    return { success: false as const, error: "Hosting IP geçerli bir IPv4/IPv6 adresi olmalı" };
  }
  await saveDnsSettings({ provider: input.provider as DnsDefaultProvider, hostingIp });
  await logActivity({
    userId: session.user.id,
    action: "DNS_SETTINGS_UPDATE",
    entity: "Setting",
    entityId: "dns_default_provider",
    details: { provider: input.provider, hostingIp: hostingIp || null },
  });
  revalidateDns();
  return { success: true as const };
}

/** "Zone oluştur / senkronize et": ensure the Cloudflare zone, store NS/status, refresh the mirror. */
export async function adminEnsureDnsZone(domainId: string) {
  const session = await requireAdmin();
  try {
    const { ensureDomainZone } = await import("@/lib/dns/zones");
    const result = await ensureDomainZone(domainId);
    revalidateDns(domainId);
    if (!result.ok) return { success: false as const, error: result.error };
    await logActivity({
      userId: session.user.id,
      action: result.data.created ? "DNS_ZONE_CREATE" : "DNS_ZONE_SYNC",
      entity: "Domain",
      entityId: domainId,
      details: { providerZoneId: result.data.zone.providerZoneId, importErrors: result.data.importErrors.length },
    });
    const imported = result.data.importErrors.length
      ? ` ${result.data.importErrors.length} eski kayıt aktarılamadı.`
      : "";
    return {
      success: true as const,
      message: (result.data.created ? "Zone Cloudflare'de oluşturuldu." : "Zone senkronize edildi.") + imported,
    };
  } catch (error) {
    console.error("[DNS] Zone oluşturma/senkron başarısız:", error);
    return { success: false as const, error: "Zone oluşturulamadı veya senkronize edilemedi" };
  }
}

/** Admin only: deletes the zone at Cloudflare; the domain falls back to registrar DNS. */
export async function adminDeleteDnsZone(domainId: string) {
  const session = await requireAdmin();
  try {
    const { deleteDomainZone } = await import("@/lib/dns/zones");
    const result = await deleteDomainZone(domainId);
    revalidateDns(domainId);
    if (!result.ok) return { success: false as const, error: result.error };
    await logActivity({ userId: session.user.id, action: "DNS_ZONE_DELETE", entity: "Domain", entityId: domainId });
    return { success: true as const };
  } catch (error) {
    console.error("[DNS] Zone silinemedi:", error);
    return { success: false as const, error: "Zone silinemedi" };
  }
}
