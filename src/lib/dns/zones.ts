/**
 * Domain ↔ DNS module glue (server only) — docs/dns-cloudflare.md.
 *
 * A domain is "Cloudflare-managed" when it has a DnsZone row. Then Cloudflare
 * is the source of truth and dns_records rows are a mirror (providerRecordId
 * set) refreshed after every change and on sync. Without a zone the legacy
 * registrar flow (src/lib/actions/customer/domains.ts) is unchanged.
 */
import type { DnsRecord, DnsRecordType, DnsZone, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import type { DnsModule, DnsModuleRecord } from "@/lib/modules/contracts";
import { createContract, getInstance, listActiveInstances } from "@/lib/modules/instances";
import type { ResolvedModuleInstance } from "@/lib/modules/types";
import { relativeRecordName, validateDnsRecord, type ValidDnsRecord } from "./validation";

const log = createLogger("dns.zones");

type DbClient = Prisma.TransactionClient | typeof db;

export type DnsResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/** Re-list the provider zone when the mirror is older than this. */
export const DNS_MIRROR_MAX_AGE_MS = 2 * 60 * 1000;

const MIRROR_TYPES: readonly DnsRecordType[] = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV", "CAA"];

export function zoneStatusFromProvider(status: string | undefined): DnsZone["status"] {
  return status === "active" ? "ACTIVE" : "PENDING";
}

export function serviceManagedKey(serviceId: string) {
  return `service:${serviceId}`;
}

/** The DNS instance a zone lives on, or the preferred active DNS instance for new zones. */
export async function resolveDnsInstance(zone?: Pick<DnsZone, "moduleInstanceId"> | null): Promise<ResolvedModuleInstance | null> {
  if (zone?.moduleInstanceId) {
    try {
      return await getInstance(zone.moduleInstanceId);
    } catch (error) {
      log.error("DNS instance config invalid", { instanceId: zone.moduleInstanceId, error });
      return null;
    }
  }
  // New zone, or a zone whose instance was deleted (SetNull): preferred active instance.
  const [instance] = await listActiveInstances("dns");
  return instance ?? null;
}

async function dnsModuleFor(zone?: Pick<DnsZone, "moduleInstanceId"> | null) {
  const instance = await resolveDnsInstance(zone);
  if (!instance) return null;
  return { instance, module: createContract(instance, "dns") as DnsModule };
}

const NO_DNS_MODULE = "Etkin bir DNS modülü (Cloudflare) tanımlı değil. Yönetim → Modüller'den ekleyin.";

export async function getDomainZone(domainId: string, client: DbClient = db) {
  return client.dnsZone.findUnique({ where: { domainId } });
}

function mirrorData(record: DnsModuleRecord & { id: string }, zoneName: string) {
  return {
    type: record.type as DnsRecordType,
    name: relativeRecordName(record.name, zoneName),
    value: record.content,
    ttl: record.ttl ?? 1,
    priority: record.priority ?? null,
    proxied: Boolean(record.proxied),
  };
}

/** Upserts one provider record into the mirror (managedBy is only set, never cleared here). */
export async function mirrorRecord(
  domain: { id: string; name: string },
  record: DnsModuleRecord & { id: string },
  managedBy?: string | null
) {
  const data = mirrorData(record, domain.name);
  return db.dnsRecord.upsert({
    where: { domainId_providerRecordId: { domainId: domain.id, providerRecordId: record.id } },
    create: { domainId: domain.id, providerRecordId: record.id, ...data, managedBy: managedBy ?? null },
    update: { ...data, ...(managedBy ? { managedBy } : {}) },
  });
}

/**
 * Replace the mirror with the provider's records: upsert by
 * providerRecordId (keeps managedBy), delete rows that disappeared.
 */
export async function syncZoneMirror(domainId: string): Promise<DnsResult<{ count: number }>> {
  const domain = await db.domain.findUnique({ where: { id: domainId }, include: { dnsZone: true } });
  if (!domain?.dnsZone) return { ok: false, error: "Bu alan adı için DNS bölgesi yok." };
  const binding = await dnsModuleFor(domain.dnsZone);
  if (!binding) return { ok: false, error: NO_DNS_MODULE };

  const listed = await binding.module.listRecords(domain.name);
  if (!listed.ok || !listed.data) {
    const error = listed.error ?? "DNS kayıtları alınamadı.";
    await db.dnsZone.update({ where: { id: domain.dnsZone.id }, data: { lastError: error } });
    return { ok: false, error };
  }

  const records = listed.data.filter((record) => MIRROR_TYPES.includes(record.type as DnsRecordType));
  const ids = records.map((record) => record.id);
  for (const record of records) await mirrorRecord(domain, record);
  await db.dnsRecord.deleteMany({
    where: { domainId, OR: [{ providerRecordId: null }, { providerRecordId: { notIn: ids } }] },
  });
  await db.dnsZone.update({
    where: { id: domain.dnsZone.id },
    data: { lastSyncedAt: new Date(), lastError: null },
  });
  return { ok: true, data: { count: records.length } };
}

/** Best-effort refresh when the mirror is stale (page loads). Never throws. */
export async function refreshZoneMirrorIfStale(domainId: string) {
  try {
    const zone = await getDomainZone(domainId);
    if (!zone) return null;
    if (zone.lastSyncedAt && Date.now() - zone.lastSyncedAt.getTime() < DNS_MIRROR_MAX_AGE_MS) return null;
    const result = await syncZoneMirror(domainId);
    return result.ok ? null : result.error;
  } catch (error) {
    log.error("DNS mirror refresh failed", { domainId, error });
    return "DNS kayıtları Cloudflare'den yenilenemedi.";
  }
}

/**
 * Finds or creates the domain's zone at the DNS module, stores DnsZone
 * (nameservers, status) and refreshes the mirror. On first creation the
 * legacy dns_records rows (registrar mode) are copied to the zone so the
 * customer keeps what they saw. Idempotent.
 */
export async function ensureDomainZone(
  domainId: string
): Promise<DnsResult<{ zone: DnsZone; created: boolean; importErrors: string[] }>> {
  const domain = await db.domain.findUnique({ where: { id: domainId }, include: { dnsZone: true } });
  if (!domain) return { ok: false, error: "Alan adı bulunamadı." };

  const binding = await dnsModuleFor(domain.dnsZone);
  if (!binding) return { ok: false, error: domain.dnsZone ? "Bu bölgenin DNS modülü kullanılamıyor." : NO_DNS_MODULE };

  const ensured = await binding.module.ensureZone(domain.name);
  if (!ensured.ok || !ensured.data) {
    const error = ensured.error ?? "DNS bölgesi oluşturulamadı.";
    if (domain.dnsZone) {
      await db.dnsZone.update({ where: { id: domain.dnsZone.id }, data: { status: "ERROR", lastError: error } });
    }
    return { ok: false, error };
  }

  const info = ensured.data;
  const isNewRow = !domain.dnsZone;
  const zone = await db.dnsZone.upsert({
    where: { domainId },
    create: {
      domainId,
      moduleInstanceId: binding.instance.id,
      providerZoneId: info.zoneId,
      nameservers: info.nameservers,
      status: zoneStatusFromProvider(info.status),
      providerStatus: info.status ?? null,
    },
    update: {
      moduleInstanceId: binding.instance.id,
      providerZoneId: info.zoneId,
      nameservers: info.nameservers,
      status: zoneStatusFromProvider(info.status),
      providerStatus: info.status ?? null,
      lastError: null,
    },
  });

  const importErrors: string[] = [];
  if (isNewRow) {
    const legacy = await db.dnsRecord.findMany({ where: { domainId, providerRecordId: null } });
    for (const row of legacy) {
      // Legacy rows were barely validated: re-check before sending them to Cloudflare.
      const checked = validateDnsRecord(
        { type: row.type, name: row.name, value: row.value, ttl: row.ttl, priority: row.priority },
        domain.name,
        { provider: "cloudflare" }
      );
      if (!checked.ok) {
        importErrors.push(`${row.type} ${row.name}: ${checked.error}`);
        continue;
      }
      const result = await binding.module.upsertRecord(domain.name, toModuleRecord(checked.record));
      if (!result.ok) importErrors.push(`${row.type} ${row.name}: ${result.error ?? "aktarılamadı"}`);
    }
  }

  const synced = await syncZoneMirror(domainId);
  if (!synced.ok) log.warn("zone created but mirror sync failed", { domainId, error: synced.error });

  return { ok: true, data: { zone, created: info.created, importErrors } };
}

export function toModuleRecord(record: ValidDnsRecord, providerRecordId?: string | null): DnsModuleRecord {
  return {
    ...(providerRecordId ? { id: providerRecordId } : {}),
    type: record.type,
    name: record.fqdn,
    content: record.value,
    ttl: record.ttl,
    ...(record.priority !== null ? { priority: record.priority } : {}),
    proxied: record.proxied,
  };
}

const PROTECTED_ERROR = "Bu kayıt hosting/sunucu hizmetiniz için otomatik yönetiliyor; değiştirilemez veya silinemez.";

/** Create (recordId null) or update a record on the domain's zone, then mirror it. */
export async function saveZoneRecord(
  domainId: string,
  record: ValidDnsRecord,
  options: { recordId?: string | null; allowManaged?: boolean } = {}
): Promise<DnsResult<{ recordId: string }>> {
  const domain = await db.domain.findUnique({ where: { id: domainId }, include: { dnsZone: true } });
  if (!domain?.dnsZone) return { ok: false, error: "Bu alan adı için DNS bölgesi yok." };
  const binding = await dnsModuleFor(domain.dnsZone);
  if (!binding) return { ok: false, error: NO_DNS_MODULE };

  let existing: DnsRecord | null = null;
  if (options.recordId) {
    existing = await db.dnsRecord.findFirst({ where: { id: options.recordId, domainId } });
    if (!existing?.providerRecordId) return { ok: false, error: "DNS kaydı bulunamadı." };
    if (existing.managedBy && !options.allowManaged) return { ok: false, error: PROTECTED_ERROR };
  }

  const result = await binding.module.upsertRecord(domain.name, toModuleRecord(record, existing?.providerRecordId));
  if (!result.ok || !result.data) {
    // The record was deleted at Cloudflare meanwhile: drop the stale mirror row.
    if (existing && result.error === "DNS kaydı bulunamadı.") await syncZoneMirror(domainId);
    return { ok: false, error: result.error ?? "DNS kaydı kaydedilemedi." };
  }
  const saved = await mirrorRecord(domain, result.data);
  return { ok: true, data: { recordId: saved.id } };
}

export async function deleteZoneRecord(
  domainId: string,
  recordId: string,
  options: { allowManaged?: boolean } = {}
): Promise<DnsResult> {
  const domain = await db.domain.findUnique({ where: { id: domainId }, include: { dnsZone: true } });
  if (!domain?.dnsZone) return { ok: false, error: "Bu alan adı için DNS bölgesi yok." };
  const existing = await db.dnsRecord.findFirst({ where: { id: recordId, domainId } });
  if (!existing) return { ok: false, error: "DNS kaydı bulunamadı." };
  if (existing.managedBy && !options.allowManaged) return { ok: false, error: PROTECTED_ERROR };

  if (existing.providerRecordId) {
    const binding = await dnsModuleFor(domain.dnsZone);
    if (!binding) return { ok: false, error: NO_DNS_MODULE };
    const result = await binding.module.deleteRecord(domain.name, existing.providerRecordId);
    if (!result.ok) return { ok: false, error: result.error ?? "DNS kaydı silinemedi." };
  }
  await db.dnsRecord.delete({ where: { id: existing.id } });
  return { ok: true, data: undefined };
}

/**
 * Admin only: deletes the zone at the provider and the local zone + mirror.
 * The domain falls back to registrar mode (its nameservers are not changed).
 */
export async function deleteDomainZone(domainId: string): Promise<DnsResult> {
  const domain = await db.domain.findUnique({ where: { id: domainId }, include: { dnsZone: true } });
  if (!domain?.dnsZone) return { ok: false, error: "Bu alan adı için DNS bölgesi yok." };
  const binding = await dnsModuleFor(domain.dnsZone);
  if (binding) {
    if (!binding.module.deleteZone) return { ok: false, error: "Bu DNS modülü bölge silmeyi desteklemiyor." };
    const result = await binding.module.deleteZone(domain.name);
    if (!result.ok) return { ok: false, error: result.error ?? "DNS bölgesi silinemedi." };
  }
  await db.$transaction([
    db.dnsRecord.deleteMany({ where: { domainId, providerRecordId: { not: null } } }),
    db.dnsZone.delete({ where: { id: domain.dnsZone.id } }),
  ]);
  return { ok: true, data: undefined };
}

/** Does the domain's registrar NS set already point at the zone's nameservers? */
export function nameserversMatch(current: unknown, expected: string[]) {
  const normalise = (list: unknown) =>
    (Array.isArray(list) ? list : [])
      .map((ns) => String(ns).trim().toLowerCase().replace(/\.$/, ""))
      .filter(Boolean)
      .sort();
  const a = normalise(current);
  const b = normalise(expected);
  return a.length > 0 && a.length === b.length && a.every((ns, index) => ns === b[index]);
}

/** Domains registered through our registrar (Gri) — the "NS'leri çevir" button. */
export function isRegisteredThroughUs(registrar: string) {
  return ["gri", "kleacore"].includes(registrar.trim().toLowerCase());
}
