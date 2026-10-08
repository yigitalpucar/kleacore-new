"use server";

import { db } from "@/lib/db";
import { requireCustomer } from "@/lib/utils/auth-helpers";
import {
  updateRegistrarDnsRecords,
  updateRegistrarNameservers,
} from "@/lib/integrations/registrar";
import { revalidatePath } from "next/cache";
import type { DnsRecordType } from "@prisma/client";
import { validateDnsRecord, type ValidDnsRecord } from "@/lib/dns/validation";

export interface DnsRecordInput {
  type: DnsRecordType;
  name: string;
  value: string;
  ttl?: number;
  priority?: number;
  /** Cloudflare zones only (A/AAAA/CNAME). */
  proxied?: boolean;
}

/** Type-specific validation (src/lib/dns/validation.ts); names are stored relative ("@", "www"). */
function normalizeDnsRecordInput(record: DnsRecordInput, zone: string, provider: "cloudflare" | "registrar") {
  const result = validateDnsRecord(record, zone, { provider });
  if (!result.ok) return { error: result.error };
  return { record: result.record };
}

function legacyRecordData(record: ValidDnsRecord) {
  return {
    type: record.type as DnsRecordType,
    name: record.name,
    value: record.value,
    ttl: record.ttl,
    priority: record.priority,
  };
}

async function getOwnedDomain(domainId: string, customerId: string) {
  const domain = await db.domain.findUnique({
    where: { id: domainId },
    include: { dnsRecords: true, dnsZone: true },
  });

  if (!domain) {
    return { error: "Alan adı bulunamadı" as const };
  }

  if (domain.customerId !== customerId) {
    return { error: "Bu alan adına erişim yetkiniz yok" as const };
  }

  return { domain };
}

async function syncDnsRecordsToRegistrar(
  domain: NonNullable<Awaited<ReturnType<typeof getOwnedDomain>>["domain"]>
) {
  const records = await db.dnsRecord.findMany({
    where: { domainId: domain.id },
    select: {
      type: true,
      name: true,
      value: true,
      ttl: true,
      priority: true,
    },
  });

  return updateRegistrarDnsRecords({
    domain,
    records,
  });
}

function revalidateDomainPaths(domainId: string) {
  revalidatePath(`/musteri/panel/domainler/${domainId}`);
  revalidatePath("/musteri/panel/domainler");
}

export async function addDnsRecord(domainId: string, record: DnsRecordInput) {
  const session = await requireCustomer();

  try {
    const owned = await getOwnedDomain(domainId, session.user.id);
    if ("error" in owned) {
      return { success: false, error: owned.error };
    }

    const normalized = normalizeDnsRecordInput(record, owned.domain.name, owned.domain.dnsZone ? "cloudflare" : "registrar");
    if ("error" in normalized) {
      return { success: false, error: normalized.error };
    }

    if (owned.domain.dnsZone) {
      const { saveZoneRecord } = await import("@/lib/dns/zones");
      const saved = await saveZoneRecord(domainId, normalized.record);
      revalidateDomainPaths(domainId);
      return saved.ok ? { success: true, recordId: saved.data.recordId } : { success: false, error: saved.error };
    }

    const created = await db.dnsRecord.create({
      data: {
        domainId,
        ...legacyRecordData(normalized.record),
      },
    });

    const registrar = await syncDnsRecordsToRegistrar(owned.domain);
    revalidateDomainPaths(domainId);

    return { success: true, recordId: created.id, registrar };
  } catch {
    return { success: false, error: "DNS kaydı eklenirken bir hata oluştu" };
  }
}

export async function updateDnsRecord(
  domainId: string,
  recordId: string,
  record: DnsRecordInput
) {
  const session = await requireCustomer();

  try {
    const owned = await getOwnedDomain(domainId, session.user.id);
    if ("error" in owned) {
      return { success: false, error: owned.error };
    }

    const normalized = normalizeDnsRecordInput(record, owned.domain.name, owned.domain.dnsZone ? "cloudflare" : "registrar");
    if ("error" in normalized) {
      return { success: false, error: normalized.error };
    }

    if (owned.domain.dnsZone) {
      const { saveZoneRecord } = await import("@/lib/dns/zones");
      const saved = await saveZoneRecord(domainId, normalized.record, { recordId });
      revalidateDomainPaths(domainId);
      return saved.ok ? { success: true } : { success: false, error: saved.error };
    }

    const existing = await db.dnsRecord.findFirst({
      where: { id: recordId, domainId },
    });

    if (!existing) {
      return { success: false, error: "DNS kaydı bulunamadı" };
    }

    await db.dnsRecord.update({
      where: { id: recordId },
      data: legacyRecordData(normalized.record),
    });

    const registrar = await syncDnsRecordsToRegistrar(owned.domain);
    revalidateDomainPaths(domainId);

    return { success: true, registrar };
  } catch {
    return { success: false, error: "DNS kaydı güncellenirken bir hata oluştu" };
  }
}

export async function deleteDnsRecord(domainId: string, recordId: string) {
  const session = await requireCustomer();

  try {
    const owned = await getOwnedDomain(domainId, session.user.id);
    if ("error" in owned) {
      return { success: false, error: owned.error };
    }

    if (owned.domain.dnsZone) {
      const { deleteZoneRecord } = await import("@/lib/dns/zones");
      const deleted = await deleteZoneRecord(domainId, recordId);
      revalidateDomainPaths(domainId);
      return deleted.ok ? { success: true } : { success: false, error: deleted.error };
    }

    const existing = await db.dnsRecord.findFirst({
      where: { id: recordId, domainId },
    });

    if (!existing) {
      return { success: false, error: "DNS kaydı bulunamadı" };
    }

    await db.dnsRecord.delete({
      where: { id: recordId },
    });

    const registrar = await syncDnsRecordsToRegistrar(owned.domain);
    revalidateDomainPaths(domainId);

    return { success: true, registrar };
  } catch {
    return { success: false, error: "DNS kaydı silinirken bir hata oluştu" };
  }
}

export async function updateDnsRecords(
  domainId: string,
  records: DnsRecordInput[]
) {
  const session = await requireCustomer();

  try {
    const owned = await getOwnedDomain(domainId, session.user.id);
    if ("error" in owned) {
      return { success: false, error: owned.error };
    }

    if (!Array.isArray(records)) {
      return { success: false, error: "Geçersiz DNS kayıt formatı" };
    }

    if (owned.domain.dnsZone) {
      return { success: false, error: "Cloudflare DNS bölgesindeki kayıtları tek tek düzenleyin" };
    }

    const normalizedRecords = [];
    for (const record of records) {
      const normalized = normalizeDnsRecordInput(record, owned.domain.name, "registrar");
      if ("error" in normalized) {
        return { success: false, error: normalized.error };
      }
      normalizedRecords.push(legacyRecordData(normalized.record));
    }

    await db.$transaction([
      db.dnsRecord.deleteMany({ where: { domainId } }),
      ...(normalizedRecords.length > 0
        ? [
            db.dnsRecord.createMany({
              data: normalizedRecords.map((item) => ({
                domainId,
                ...item,
              })),
            }),
          ]
        : []),
    ]);

    const registrar = await syncDnsRecordsToRegistrar(owned.domain);
    revalidateDomainPaths(domainId);

    return { success: true, registrar };
  } catch {
    return { success: false, error: "DNS kayıtları güncellenirken bir hata oluştu" };
  }
}

export async function updateNameservers(domainId: string, nameservers: string[]) {
  const session = await requireCustomer();

  try {
    const owned = await getOwnedDomain(domainId, session.user.id);
    if ("error" in owned) {
      return { success: false, error: owned.error };
    }

    const normalizedNameservers = nameservers
      .map((nameserver) => nameserver.trim().toLowerCase())
      .filter(Boolean);

    if (normalizedNameservers.length < 2) {
      return { success: false, error: "En az iki nameserver girilmelidir" };
    }

    await db.domain.update({
      where: { id: domainId },
      data: { nameservers: normalizedNameservers },
    });

    const registrar = await updateRegistrarNameservers({
      domain: owned.domain.name,
      nameservers: normalizedNameservers,
    });

    revalidateDomainPaths(domainId);
    return { success: true, registrar };
  } catch {
    return { success: false, error: "Nameserver kayıtları güncellenirken bir hata oluştu" };
  }
}
export async function setDomainAutoRenew(domainId: string, enabled: boolean) {
  const session = await requireCustomer();

  try {
    const { setAutoRenewForCustomer } = await import("@/lib/domains/self-service");
    const result = await setAutoRenewForCustomer(domainId, session.user.id, enabled);
    if (result.success) revalidateDomainPaths(domainId);
    return result;
  } catch (error) {
    console.error("[Domains] Otomatik yenileme güncellenemedi:", error);
    return { success: false as const, error: "Otomatik yenileme ayarı kaydedilemedi" };
  }
}

export async function requestDomainRenewal(domainId: string) {
  const session = await requireCustomer();

  try {
    const { requestRenewalForCustomer } = await import("@/lib/domains/self-service");
    const result = await requestRenewalForCustomer(domainId, session.user.id);
    if (result.success) {
      revalidateDomainPaths(domainId);
      revalidatePath("/musteri/panel/faturalar");
    }
    return result;
  } catch (error) {
    console.error("[Domains] Yenileme faturası oluşturulamadı:", error);
    return { success: false as const, error: "Yenileme faturası oluşturulamadı" };
  }
}

/**
 * "DNS'i Cloudflare'de yönet": creates the domain's zone in our Cloudflare
 * account (existing records are copied). Only offered while
 * dns_default_provider = "cloudflare" (owner decision #6).
 */
export async function enableCloudflareDns(domainId: string) {
  const session = await requireCustomer();

  try {
    const owned = await getOwnedDomain(domainId, session.user.id);
    if ("error" in owned) return { success: false as const, error: owned.error };
    if (!owned.domain.dnsZone) {
      const { getDnsDefaultProvider } = await import("@/lib/dns/settings");
      if ((await getDnsDefaultProvider()) !== "cloudflare") {
        return { success: false as const, error: "Cloudflare DNS yönetimi şu anda kullanıma açık değil" };
      }
    }

    const { ensureDomainZone } = await import("@/lib/dns/zones");
    const result = await ensureDomainZone(domainId);
    revalidateDomainPaths(domainId);
    if (!result.ok) return { success: false as const, error: result.error };
    return {
      success: true as const,
      nameservers: result.data.zone.nameservers,
      importErrors: result.data.importErrors,
    };
  } catch (error) {
    console.error("[Domains] Cloudflare DNS bölgesi oluşturulamadı:", error);
    return { success: false as const, error: "DNS bölgesi oluşturulamadı" };
  }
}

/** "Yenile": re-reads the zone's records from Cloudflare. */
export async function refreshDnsZone(domainId: string) {
  const session = await requireCustomer();

  try {
    const owned = await getOwnedDomain(domainId, session.user.id);
    if ("error" in owned) return { success: false as const, error: owned.error };
    if (!owned.domain.dnsZone) return { success: false as const, error: "Bu alan adı için DNS bölgesi yok" };
    const { syncZoneMirror } = await import("@/lib/dns/zones");
    const result = await syncZoneMirror(domainId);
    revalidateDomainPaths(domainId);
    return result.ok ? { success: true as const } : { success: false as const, error: result.error };
  } catch (error) {
    console.error("[Domains] DNS kayıtları yenilenemedi:", error);
    return { success: false as const, error: "DNS kayıtları yenilenemedi" };
  }
}

/**
 * "Nameserver'ları Cloudflare'e çevir": for domains registered through us
 * (Gri), sets the registrar nameservers to the zone's assigned ones.
 */
export async function switchNameserversToCloudflare(domainId: string) {
  const session = await requireCustomer();

  try {
    const owned = await getOwnedDomain(domainId, session.user.id);
    if ("error" in owned) return { success: false as const, error: owned.error };
    const { isRegisteredThroughUs, nameserversMatch } = await import("@/lib/dns/zones");
    const zone = owned.domain.dnsZone;
    if (!zone || zone.nameservers.length < 2) {
      return { success: false as const, error: "Önce DNS bölgesini oluşturun" };
    }
    if (!isRegisteredThroughUs(owned.domain.registrar)) {
      return { success: false as const, error: "Bu alan adı başka bir kayıt firmasında; nameserver'ları oradan değiştirin" };
    }
    if (owned.domain.status !== "ACTIVE") {
      return { success: false as const, error: "Yalnızca aktif alan adlarının nameserver'ları değiştirilebilir" };
    }
    if (nameserversMatch(owned.domain.nameservers, zone.nameservers)) {
      return { success: true as const, unchanged: true };
    }

    const registrar = await updateRegistrarNameservers({ domain: owned.domain.name, nameservers: zone.nameservers });
    if (!registrar.ok || registrar.skipped) {
      return {
        success: false as const,
        error: registrar.skipped
          ? "Kayıt firması entegrasyonu etkin değil; destek talebi açın"
          : `Kayıt firması nameserver değişikliğini kabul etmedi${registrar.error ? `: ${registrar.error}` : ""}`,
      };
    }

    await db.$transaction([
      db.domain.update({ where: { id: domainId }, data: { nameservers: zone.nameservers } }),
      db.domainLifecycleEvent.create({
        data: {
          domainId,
          type: "nameservers.cloudflare",
          message: `Nameserver'lar Cloudflare'e çevrildi: ${zone.nameservers.join(", ")}`,
          actorId: session.user.id,
        },
      }),
    ]);
    revalidateDomainPaths(domainId);
    return { success: true as const, unchanged: false };
  } catch (error) {
    console.error("[Domains] Nameserver'lar Cloudflare'e çevrilemedi:", error);
    return { success: false as const, error: "Nameserver'lar değiştirilemedi" };
  }
}
