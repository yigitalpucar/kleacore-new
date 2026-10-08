/**
 * DNS automation after a service goes live (roadmap 2.5).
 *
 * Hosting: @ and www → server IP (A, or AAAA for IPv6), mail → server IP,
 * MX → mail.<domain> (only if the name has no MX yet), SPF TXT (only if none).
 * Server (VDS/VPS): the hostname the customer chose under their domain → IP.
 *
 * Runs as the `dns.service-setup` queue job, queued next to the "hizmet
 * aktif" notice (post-commit / in the activation transaction). Idempotent:
 * every write is an upsert, conflicting web records are replaced, MX/SPF are
 * never added twice. Only acts when the domain is ours (same customer) and
 * its DNS is managed by us: it has a DnsZone, or dns_default_provider is
 * "cloudflare" (then the zone is created). With the default "registrar"
 * setting and no zones nothing is queued — production behaviour unchanged.
 */
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCpanelWhmConfig } from "@/lib/integrations/provisioning/config";
import { getSettingValue } from "@/lib/integrations/settings";
import { DNS_SERVICE_SETUP_JOB } from "@/lib/jobs/definitions";
import { enqueue } from "@/lib/jobs/enqueue";
import { createLogger } from "@/lib/logger";
import type { DnsModule, DnsModuleRecord } from "@/lib/modules/contracts";
import { createContract } from "@/lib/modules/instances";
import { activationKindForCategory } from "@/lib/provisioning/activation-notice";
import { DNS_HOSTING_IP_SETTING, getDnsDefaultProvider } from "./settings";
import { isIPv4, isIPv6 } from "./validation";
import { ensureDomainZone, mirrorRecord, resolveDnsInstance, serviceManagedKey, syncZoneMirror } from "./zones";

const log = createLogger("dns.activation");

type DbClient = Prisma.TransactionClient | typeof db;

export { DNS_SERVICE_SETUP_JOB };

export interface DnsSetupService {
  id: string;
  customerId: string;
  domain: string | null;
  serverName: string | null;
  ipAddress: string | null;
}

function normaliseHost(value: string | null | undefined) {
  const host = value?.trim().toLowerCase().replace(/\.$/, "");
  return host && host.includes(".") ? host : null;
}

/** The host whose records we manage: hosting → service domain; server → chosen hostname. */
export function dnsHostForService(service: Pick<DnsSetupService, "domain" | "serverName">, kind: "hosting" | "server" | "other") {
  if (kind === "hosting") return normaliseHost(service.domain);
  if (kind === "server") return normaliseHost(service.serverName) ?? normaliseHost(service.domain);
  return null;
}

/** The customer's Domain row that contains `host` (longest match). */
export async function findOwnedDomainForHost(client: DbClient, customerId: string, host: string) {
  const labels = host.split(".");
  const candidates = labels.slice(0, -1).map((_, index) => labels.slice(index).join("."));
  const domains = await client.domain.findMany({
    where: { customerId, name: { in: candidates } },
    include: { dnsZone: true },
  });
  return domains.sort((a, b) => b.name.length - a.name.length)[0] ?? null;
}

/**
 * Queues the DNS setup job for a freshly activated service when its DNS is
 * ours to manage. Pass the activation transaction (`tx`) so the job commits
 * with the activation; without it the caller has already committed.
 */
export async function queueServiceDnsSetup(
  tx: Prisma.TransactionClient | undefined,
  service: DnsSetupService,
  categorySlug: string
) {
  try {
    const kind = activationKindForCategory(categorySlug);
    const host = dnsHostForService(service, kind);
    if (!host) return { queued: false as const, reason: "NO_HOST" };
    const client = tx ?? db;
    const domain = await findOwnedDomainForHost(client, service.customerId, host);
    if (!domain) return { queued: false as const, reason: "NOT_OUR_DOMAIN" };
    if (!domain.dnsZone && (await getDnsDefaultProvider()) !== "cloudflare") {
      return { queued: false as const, reason: "DNS_NOT_MANAGED" };
    }
    await enqueue(DNS_SERVICE_SETUP_JOB, { serviceId: service.id }, { singletonKey: service.id, tx });
    return { queued: true as const };
  } catch (error) {
    // DNS automation must never break an activation; the admin can run it from the domain page.
    log.error("queueing DNS setup failed", { serviceId: service.id, error });
    return { queued: false as const, reason: "QUEUE_ERROR" };
  }
}

/** Hosting server IP: service → its server/instance → legacy WHM host → setting. */
export async function resolveHostingIp(service: {
  ipAddress: string | null;
  moduleInstanceId: string | null;
}): Promise<string | null> {
  const valid = (value: string | null | undefined) => (value && (isIPv4(value) || isIPv6(value)) ? value : null);
  if (valid(service.ipAddress)) return service.ipAddress;

  if (service.moduleInstanceId) {
    const server = await db.server.findFirst({
      where: { moduleInstanceId: service.moduleInstanceId, isActive: true },
      orderBy: { createdAt: "asc" },
      select: { ipAddress: true },
    });
    if (valid(server?.ipAddress)) return server!.ipAddress;
  }

  const whmHost = (await getCpanelWhmConfig()).host?.replace(/^https?:\/\//, "").replace(/[:/].*$/, "");
  if (whmHost) {
    if (valid(whmHost)) return whmHost;
    const server = await db.server.findFirst({
      where: { OR: [{ hostname: whmHost }, { ipAddress: whmHost }] },
      select: { ipAddress: true },
    });
    if (valid(server?.ipAddress)) return server!.ipAddress;
  }

  return valid((await getSettingValue(DNS_HOSTING_IP_SETTING, "DNS_HOSTING_IP")).trim());
}

/** Mail host of the hosting account (cPanel: mail.<domain>). */
export function mailHostFor(host: string) {
  return `mail.${host}`;
}

export interface PlannedRecord {
  record: DnsModuleRecord;
  /** Replace other A/AAAA/CNAME on the same name (web/host records). */
  replaceAddress?: boolean;
  /** Only add when the name has no record of this kind yet (MX, SPF). */
  onlyIfMissing?: "MX" | "SPF";
}

export function planServiceRecords(kind: "hosting" | "server", host: string, ip: string): PlannedRecord[] {
  const type = isIPv6(ip) ? "AAAA" : "A";
  const address = (name: string): PlannedRecord => ({
    record: { type, name, content: ip, proxied: false },
    replaceAddress: true,
  });
  if (kind === "server") return [address(host)];

  const mailHost = mailHostFor(host);
  const spfMechanism = type === "A" ? `ip4:${ip}` : `ip6:${ip}`;
  return [
    address(host),
    address(`www.${host}`),
    address(mailHost),
    { record: { type: "MX", name: host, content: mailHost, priority: 0 }, onlyIfMissing: "MX" },
    { record: { type: "TXT", name: host, content: `v=spf1 +a +mx +${spfMechanism} ~all` }, onlyIfMissing: "SPF" },
  ];
}

const isSpf = (record: DnsModuleRecord) => record.type === "TXT" && /^"?v=spf1(\s|"|$)/i.test(record.content.trim());

/**
 * Applies the plan against the zone's current records. Returns the records
 * written (for the mirror's managedBy) and what was skipped.
 */
export async function applyRecordPlan(dns: DnsModule, zone: string, plan: PlannedRecord[]) {
  const listed = await dns.listRecords(zone);
  if (!listed.ok || !listed.data) throw new Error(listed.error ?? "DNS_LIST_FAILED");
  const current = listed.data;
  const written: Array<DnsModuleRecord & { id: string }> = [];
  const skipped: string[] = [];

  for (const item of plan) {
    const { record } = item;
    const sameName = current.filter((existing) => existing.name === record.name);

    if (item.onlyIfMissing === "MX" && sameName.some((existing) => existing.type === "MX")) {
      skipped.push(`MX ${record.name} (mevcut MX korunuyor)`);
      continue;
    }
    if (item.onlyIfMissing === "SPF" && sameName.some(isSpf)) {
      skipped.push(`SPF ${record.name} (mevcut SPF korunuyor)`);
      continue;
    }

    if (item.replaceAddress) {
      const conflicting = sameName.filter(
        (existing) =>
          ["A", "AAAA", "CNAME"].includes(existing.type) &&
          !(existing.type === record.type && existing.content === record.content)
      );
      for (const existing of conflicting) {
        const removed = await dns.deleteRecord(zone, existing.id);
        if (!removed.ok) throw new Error(removed.error ?? "DNS_DELETE_FAILED");
      }
    }

    const result = await dns.upsertRecord(zone, record);
    if (!result.ok || !result.data) throw new Error(result.error ?? "DNS_UPSERT_FAILED");
    written.push(result.data);
  }

  return { written, skipped };
}

export type DnsSetupOutcome =
  | { status: "done"; zone: string; written: number; skipped: string[] }
  | { status: "skipped"; reason: string };

/** Job handler. Throws on remote failures so pg-boss retries. */
export async function runServiceDnsSetup(serviceId: string): Promise<DnsSetupOutcome> {
  const service = await db.service.findUnique({
    where: { id: serviceId },
    include: { product: { include: { category: true } } },
  });
  if (!service) return { status: "skipped", reason: "SERVICE_NOT_FOUND" };
  if (service.status !== "ACTIVE") return { status: "skipped", reason: `SERVICE_${service.status}` };

  const kind = activationKindForCategory(service.product.category.slug);
  if (kind === "other") return { status: "skipped", reason: "CATEGORY_WITHOUT_DNS" };
  const host = dnsHostForService(service, kind);
  if (!host) return { status: "skipped", reason: "NO_HOST" };

  const domain = await findOwnedDomainForHost(db, service.customerId, host);
  if (!domain) return { status: "skipped", reason: "NOT_OUR_DOMAIN" };
  if (!domain.dnsZone && (await getDnsDefaultProvider()) !== "cloudflare") {
    return { status: "skipped", reason: "DNS_NOT_MANAGED" };
  }

  const ip = kind === "hosting" ? await resolveHostingIp(service) : service.ipAddress;
  if (!ip || !(isIPv4(ip) || isIPv6(ip))) {
    if (kind === "server") return { status: "skipped", reason: "NO_SERVER_IP" };
    throw new Error("DNS_HOSTING_IP_UNKNOWN: hosting sunucusunun IP adresi bulunamadı (Yönetim → DNS → Hosting IP).");
  }

  const ensured = await ensureDomainZone(domain.id);
  if (!ensured.ok) throw new Error(`DNS_ZONE_FAILED: ${ensured.error}`);

  const instance = await resolveDnsInstance(ensured.data.zone);
  if (!instance) throw new Error("DNS_MODULE_UNAVAILABLE");
  const dns = createContract(instance, "dns");

  const { written, skipped } = await applyRecordPlan(dns, domain.name, planServiceRecords(kind, host, ip));
  const managedBy = serviceManagedKey(service.id);
  for (const record of written) await mirrorRecord(domain, record, managedBy);

  // Records we replaced/deleted at the provider disappear from the mirror.
  await syncZoneMirror(domain.id);

  log.info("service DNS set up", { serviceId, zone: domain.name, written: written.length, skipped });
  return { status: "done", zone: domain.name, written: written.length, skipped };
}
