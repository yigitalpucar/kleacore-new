"use server";

import { db } from "@/lib/db";
import { requireCustomer } from "@/lib/utils/auth-helpers";
import {
  updateRegistrarDnsRecords,
  updateRegistrarNameservers,
} from "@/lib/integrations/registrar";
import { revalidatePath } from "next/cache";
import type { DnsRecordType } from "@prisma/client";

const ALLOWED_DNS_TYPES: DnsRecordType[] = [
  "A",
  "AAAA",
  "CNAME",
  "MX",
  "TXT",
  "NS",
  "SRV",
];

export interface DnsRecordInput {
  type: DnsRecordType;
  name: string;
  value: string;
  ttl?: number;
  priority?: number;
}

function isValidDnsRecordType(type: string): type is DnsRecordType {
  return ALLOWED_DNS_TYPES.includes(type as DnsRecordType);
}

function normalizeDnsRecordInput(record: DnsRecordInput) {
  const type = record.type.toString().toUpperCase();

  if (!isValidDnsRecordType(type)) {
    return { error: "Geçersiz DNS kayıt tipi" as const };
  }

  const name = record.name.trim();
  const value = record.value.trim();

  if (!name) {
    return { error: "Kayıt adı zorunludur" as const };
  }

  if (!value) {
    return { error: "Kayıt değeri zorunludur" as const };
  }

  const ttl = record.ttl ?? 3600;
  if (!Number.isFinite(ttl) || ttl <= 0) {
    return { error: "TTL değeri geçersiz" as const };
  }

  let priority: number | null = null;
  if (type === "MX" || type === "SRV") {
    if (record.priority == null || !Number.isFinite(record.priority)) {
      return { error: "MX ve SRV kayıtları için öncelik zorunludur" as const };
    }
    priority = record.priority;
  } else if (record.priority != null && Number.isFinite(record.priority)) {
    priority = record.priority;
  }

  return {
    data: {
      type: type as DnsRecordType,
      name,
      value,
      ttl,
      priority,
    },
  };
}

async function getOwnedDomain(domainId: string, customerId: string) {
  const domain = await db.domain.findUnique({
    where: { id: domainId },
    include: { dnsRecords: true },
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
    const normalized = normalizeDnsRecordInput(record);
    if ("error" in normalized) {
      return { success: false, error: normalized.error };
    }

    const owned = await getOwnedDomain(domainId, session.user.id);
    if ("error" in owned) {
      return { success: false, error: owned.error };
    }

    const created = await db.dnsRecord.create({
      data: {
        domainId,
        ...normalized.data,
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
    const normalized = normalizeDnsRecordInput(record);
    if ("error" in normalized) {
      return { success: false, error: normalized.error };
    }

    const owned = await getOwnedDomain(domainId, session.user.id);
    if ("error" in owned) {
      return { success: false, error: owned.error };
    }

    const existing = await db.dnsRecord.findFirst({
      where: { id: recordId, domainId },
    });

    if (!existing) {
      return { success: false, error: "DNS kaydı bulunamadı" };
    }

    await db.dnsRecord.update({
      where: { id: recordId },
      data: normalized.data,
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

    const normalizedRecords = [];
    for (const record of records) {
      const normalized = normalizeDnsRecordInput(record);
      if ("error" in normalized) {
        return { success: false, error: normalized.error };
      }
      normalizedRecords.push(normalized.data);
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
