/**
 * Cloudflare DNS module (roadmap 2.5) — docs/modules.md, docs/dns-cloudflare.md.
 *
 * One instance = one Cloudflare account + API token (Zone:Read, Zone:Edit,
 * DNS:Edit). Zones are created in that account; records are written through
 * the DnsModule contract (idempotent upsert by type+name(+content)).
 */
import { z } from "zod";
import type { IntegrationResult } from "@/lib/integrations/settings";
import type { DnsModule, DnsModuleRecord, DnsZoneInfo, OperationResult } from "../../contracts";
import { defineModule, type ResolvedModuleInstance } from "../../types";
import { CloudflareApiError, createCloudflareClient, type CloudflareClient } from "./client";
import {
  fromCloudflareRecord,
  isSameRecord,
  isUpsertMatch,
  normaliseDnsName,
  toCloudflareBody,
  type CloudflareDnsRecord,
} from "./records";

const MODULE_ID = "cloudflare";

export const cloudflareConfigSchema = z.object({
  apiToken: z.string().trim().min(1, "API token gerekli"),
  accountId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{32}$/, "Cloudflare hesap kimliği 32 karakterlik onaltılık bir değer olmalı"),
  defaultProxied: z.boolean().default(false),
  /** Seconds; 1 = Cloudflare "Otomatik". */
  defaultTtl: z.coerce.number().int().min(1).max(86400).default(1),
  /** Vanity nameservers shown to customers instead of the assigned ones. */
  displayNameservers: z.array(z.string().trim().min(1)).default([]),
});

export type CloudflareModuleConfig = z.infer<typeof cloudflareConfigSchema>;

export interface CloudflareZone {
  id: string;
  name: string;
  status?: string;
  name_servers?: string[];
  account?: { id: string };
}

export interface CloudflareModuleOptions {
  /** Injected in tests (429 Retry-After waits). */
  sleep?: (ms: number) => Promise<void>;
  baseUrl?: string;
}

function failure<T>(error: unknown): IntegrationResult<T> {
  if (error instanceof CloudflareApiError) {
    return {
      ok: false,
      provider: MODULE_ID,
      error: error.userMessage,
      ...(error.codes.length ? { reference: `cf:${error.codes.join(",")}` } : {}),
    };
  }
  return { ok: false, provider: MODULE_ID, error: error instanceof Error ? error.message : "CLOUDFLARE_ERROR" };
}

const ZONE_NOT_FOUND = "Cloudflare'de bu alan adı için zone yok.";

export function createCloudflareModule(
  instance: ResolvedModuleInstance<CloudflareModuleConfig>,
  options: CloudflareModuleOptions = {}
): DnsModule & { deleteZone(zone: string): Promise<OperationResult> } {
  const config = instance.config;
  const client: CloudflareClient = createCloudflareClient({
    apiToken: config.apiToken,
    sleep: options.sleep,
    baseUrl: options.baseUrl,
  });
  const defaults = { ttl: config.defaultTtl, proxied: config.defaultProxied };
  const zoneCache = new Map<string, CloudflareZone>();

  function nameserversFor(zone: CloudflareZone) {
    return config.displayNameservers.length ? config.displayNameservers : (zone.name_servers ?? []);
  }

  async function findZone(name: string): Promise<CloudflareZone | null> {
    const zoneName = normaliseDnsName(name);
    const cached = zoneCache.get(zoneName);
    if (cached) return cached;
    const zones = await client.request<CloudflareZone[]>("GET", "/zones", {
      query: { name: zoneName, "account.id": config.accountId, per_page: 5 },
    });
    const zone = zones.find((candidate) => normaliseDnsName(candidate.name) === zoneName) ?? null;
    // Only cache zones that are final for this lookup; a miss is re-checked next time.
    if (zone) zoneCache.set(zoneName, zone);
    return zone;
  }

  async function requireZoneId(name: string) {
    const zone = await findZone(name);
    if (!zone) throw new CloudflareApiError(404, [{ code: 1001, message: "zone not found" }], ZONE_NOT_FOUND);
    return zone.id;
  }

  async function listZoneRecords(zoneId: string, query: Record<string, string> = {}) {
    const records = await client.paginate<CloudflareDnsRecord>(`/zones/${zoneId}/dns_records`, query);
    return records.map(fromCloudflareRecord).filter((record): record is DnsModuleRecord & { id: string } => record !== null);
  }

  async function writeRecord(zoneId: string, record: DnsModuleRecord, recordId?: string) {
    const body = toCloudflareBody(record, defaults);
    const result = recordId
      ? await client.request<CloudflareDnsRecord>("PUT", `/zones/${zoneId}/dns_records/${recordId}`, { body })
      : await client.request<CloudflareDnsRecord>("POST", `/zones/${zoneId}/dns_records`, { body });
    const mapped = fromCloudflareRecord(result);
    if (!mapped) throw new Error("CLOUDFLARE_UNEXPECTED_RECORD");
    return mapped;
  }

  return {
    moduleId: MODULE_ID,

    async ensureZone(zone): Promise<IntegrationResult<DnsZoneInfo>> {
      const zoneName = normaliseDnsName(zone);
      try {
        const existing = await findZone(zoneName);
        if (existing) {
          return {
            ok: true,
            provider: MODULE_ID,
            reference: existing.id,
            data: { zoneId: existing.id, nameservers: nameserversFor(existing), created: false, status: existing.status },
          };
        }
        let created: CloudflareZone;
        try {
          created = await client.request<CloudflareZone>("POST", "/zones", {
            // jump_start: Cloudflare imports the records it can find in the
            // current public DNS, so switching nameservers later keeps mail/web.
            body: { name: zoneName, account: { id: config.accountId }, type: "full", jump_start: true },
          });
        } catch (error) {
          // Lost a race with a concurrent ensureZone: the zone is ours now.
          if (error instanceof CloudflareApiError && error.has(1061)) {
            const raced = await findZone(zoneName);
            if (raced) {
              return {
                ok: true,
                provider: MODULE_ID,
                reference: raced.id,
                data: { zoneId: raced.id, nameservers: nameserversFor(raced), created: false, status: raced.status },
              };
            }
          }
          throw error;
        }
        zoneCache.set(zoneName, created);
        return {
          ok: true,
          provider: MODULE_ID,
          reference: created.id,
          data: { zoneId: created.id, nameservers: nameserversFor(created), created: true, status: created.status },
        };
      } catch (error) {
        return failure(error);
      }
    },

    async listRecords(zone) {
      try {
        return { ok: true, provider: MODULE_ID, data: await listZoneRecords(await requireZoneId(zone)) };
      } catch (error) {
        return failure(error);
      }
    },

    async upsertRecord(zone, input) {
      try {
        const zoneId = await requireZoneId(zone);
        const record: DnsModuleRecord = { ...input, name: normaliseDnsName(input.name) };

        if (record.id) {
          return { ok: true, provider: MODULE_ID, data: await writeRecord(zoneId, record, record.id) };
        }

        const candidates = await listZoneRecords(zoneId, { type: record.type, name: record.name });
        const match = candidates.find((existing) => isUpsertMatch(existing, record));
        if (match) {
          // Fields the caller left out keep their current value.
          const merged: DnsModuleRecord = {
            ...match,
            ...Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)),
            id: match.id,
          };
          if (isSameRecord(match, merged, defaults)) {
            return { ok: true, provider: MODULE_ID, reference: match.id, data: match };
          }
          return { ok: true, provider: MODULE_ID, data: await writeRecord(zoneId, merged, match.id) };
        }
        const created = await writeRecord(zoneId, record);
        return { ok: true, provider: MODULE_ID, reference: created.id, data: created };
      } catch (error) {
        return failure(error);
      }
    },

    async deleteRecord(zone, recordId) {
      try {
        const zoneId = await requireZoneId(zone);
        try {
          await client.request("DELETE", `/zones/${zoneId}/dns_records/${encodeURIComponent(recordId)}`);
        } catch (error) {
          if (!(error instanceof CloudflareApiError && error.isNotFound)) throw error;
        }
        return { ok: true, provider: MODULE_ID, reference: recordId };
      } catch (error) {
        return failure(error);
      }
    },

    async deleteZone(zone) {
      const zoneName = normaliseDnsName(zone);
      try {
        const existing = await findZone(zoneName);
        if (!existing) return { ok: true, provider: MODULE_ID, reference: zoneName };
        try {
          await client.request("DELETE", `/zones/${existing.id}`);
        } catch (error) {
          if (!(error instanceof CloudflareApiError && error.isNotFound)) throw error;
        }
        zoneCache.delete(zoneName);
        return { ok: true, provider: MODULE_ID, reference: existing.id };
      } catch (error) {
        return failure(error);
      }
    },
  };
}

export const cloudflareModule = defineModule({
  id: MODULE_ID,
  kind: "dns",
  name: "Cloudflare DNS",
  description:
    "Müşteri alan adları için Cloudflare zone'ları ve DNS kayıtları; hosting/VDS aktivasyonunda otomatik A/MX/SPF kayıtları.",
  configSchema: cloudflareConfigSchema,
  secretFields: ["apiToken"],
  configFields: {
    apiToken: {
      label: "API token",
      hint: "Yalnızca bu hesaba kapsamlı token: Zone:Read, Zone:Edit, DNS:Edit. Global API key kullanmayın.",
    },
    accountId: {
      label: "Hesap kimliği (Account ID)",
      hint: "Cloudflare panelinde alan adı özet sayfasının sağ alt köşesinde. Yeni zone'lar bu hesaba açılır.",
      placeholder: "32 karakter",
    },
    defaultProxied: {
      label: "Yeni A/AAAA/CNAME kayıtlarını proxy'le (turuncu bulut)",
      hint: "Müşteri kayıt eklerken değiştirebilir. Hosting için kapalı önerilir (cPanel/mail erişimi).",
    },
    defaultTtl: { label: "Varsayılan TTL (sn)", hint: "1 = Otomatik. Aksi halde 60–86400." },
    displayNameservers: {
      label: "Gösterilecek ad sunucuları",
      hint: "Özel (vanity) ad sunucusu kullanıyorsanız her satıra bir tane. Boşsa Cloudflare'in atadığı ad sunucuları gösterilir.",
    },
  },
  capabilities: ["zones", "records", "proxy", "deleteZone"],
  async healthCheck(instance) {
    try {
      const client = createCloudflareClient({ apiToken: instance.config.apiToken, maxRetries: 0 });
      const token = await client.request<{ status?: string }>("GET", "/user/tokens/verify");
      if (token.status && token.status !== "active") {
        return { ok: false, message: `Cloudflare API token etkin değil (durum: ${token.status}).` };
      }
      return { ok: true, message: "Cloudflare API token geçerli ve etkin." };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof CloudflareApiError ? error.userMessage : "Cloudflare bağlantı testi başarısız.",
      };
    }
  },
  create: (instance) => createCloudflareModule(instance),
});
