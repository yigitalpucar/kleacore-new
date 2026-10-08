/**
 * Minimal example module (docs/modules.md): an in-memory DnsModule. Not
 * registered in manifests.ts — it exists to show the shape of a module and
 * to exercise the shared contract helpers. Each instance id gets its own
 * store, so tests can create fresh, isolated modules.
 */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  SINGLE_VALUE_DNS_TYPES,
  type DnsModule,
  type DnsModuleRecord,
} from "../contracts";
import { defineModule, type ResolvedModuleInstance } from "../types";

export const memoryDnsConfigSchema = z.object({
  nameservers: z.array(z.string().trim().min(1)).min(1).default(["ns1.example.test", "ns2.example.test"]),
  /** Pretend to be an API with a token (shows how secrets are declared). */
  apiToken: z.string().min(1),
  defaultTtl: z.coerce.number().int().min(1).max(86400).default(300),
});

export type MemoryDnsConfig = z.infer<typeof memoryDnsConfigSchema>;

type StoredRecord = DnsModuleRecord & { id: string };

const stores = new Map<string, Map<string, StoredRecord[]>>();

function normaliseName(name: string) {
  return name.trim().toLowerCase().replace(/\.$/, "");
}

export function createMemoryDnsModule(instance: ResolvedModuleInstance<MemoryDnsConfig>): DnsModule {
  const zones = stores.get(instance.id) ?? new Map<string, StoredRecord[]>();
  stores.set(instance.id, zones);
  const ok = <T>(data: T) => ({ ok: true, provider: "memory-dns", data });
  const missingZone = { ok: false, provider: "memory-dns", error: "DNS_ZONE_NOT_FOUND" };

  return {
    moduleId: "memory-dns",
    async ensureZone(zone) {
      const name = normaliseName(zone);
      const created = !zones.has(name);
      if (created) zones.set(name, []);
      return ok({ zoneId: `zone_${name}`, nameservers: instance.config.nameservers, created });
    },
    async listRecords(zone) {
      const records = zones.get(normaliseName(zone));
      return records ? ok(records.map((record) => ({ ...record }))) : missingZone;
    },
    async upsertRecord(zone, input) {
      const records = zones.get(normaliseName(zone));
      if (!records) return missingZone;
      const record: StoredRecord = {
        ...input,
        id: input.id ?? "",
        name: normaliseName(input.name),
        ttl: input.ttl ?? instance.config.defaultTtl,
      };

      const index = input.id
        ? records.findIndex((existing) => existing.id === input.id)
        : records.findIndex(
            (existing) =>
              existing.type === record.type &&
              existing.name === record.name &&
              (SINGLE_VALUE_DNS_TYPES.includes(record.type) || existing.content === record.content)
          );

      if (index >= 0) {
        records[index] = { ...record, id: records[index].id };
        return ok({ ...records[index] });
      }
      if (input.id) return { ok: false, provider: "memory-dns", error: "DNS_RECORD_NOT_FOUND" };
      const created = { ...record, id: randomUUID() };
      records.push(created);
      return ok({ ...created });
    },
    async deleteRecord(zone, recordId) {
      const records = zones.get(normaliseName(zone));
      if (!records) return missingZone;
      const index = records.findIndex((record) => record.id === recordId);
      if (index >= 0) records.splice(index, 1);
      return { ok: true, provider: "memory-dns", reference: recordId };
    },
  };
}

export const memoryDnsModule = defineModule({
  id: "memory-dns",
  kind: "dns",
  name: "Bellek içi DNS (örnek)",
  description: "Belgelerdeki örnek modül; kayıtları bellekte tutar.",
  hidden: true,
  configSchema: memoryDnsConfigSchema,
  secretFields: ["apiToken"],
  configFields: {
    nameservers: { label: "Ad sunucuları", hint: "Her satıra bir ad sunucusu." },
    apiToken: { label: "API token" },
    defaultTtl: { label: "Varsayılan TTL (sn)" },
  },
  capabilities: ["zones", "records"],
  async healthCheck(instance) {
    return instance.config.apiToken ? { ok: true, message: "Bellek içi DNS hazır." } : { ok: false, message: "Token yok" };
  },
  create: createMemoryDnsModule,
});
