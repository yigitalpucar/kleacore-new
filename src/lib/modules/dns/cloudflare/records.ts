/**
 * Conversions between DnsModuleRecord (module contract) and Cloudflare's
 * dns_records shape. Pure functions, unit-tested in cloudflare.contract.test.ts.
 */
import {
  DNS_RECORD_TYPES,
  SINGLE_VALUE_DNS_TYPES,
  type DnsModuleRecord,
  type DnsModuleRecordType,
} from "../../contracts";

/** Cloudflare dns_record as returned by the API (fields we use). */
export interface CloudflareDnsRecord {
  id: string;
  type: string;
  name: string;
  content?: string;
  ttl?: number;
  priority?: number;
  proxied?: boolean;
  proxiable?: boolean;
  comment?: string | null;
  data?: Record<string, unknown>;
}

export const PROXIABLE_TYPES: readonly DnsModuleRecordType[] = ["A", "AAAA", "CNAME"];

export function normaliseDnsName(name: string) {
  return name.trim().toLowerCase().replace(/\.+$/, "");
}

function isSupportedType(type: string): type is DnsModuleRecordType {
  return (DNS_RECORD_TYPES as readonly string[]).includes(type);
}

/**
 * TXT content as one plain string: Cloudflare returns TXT values quoted
 * ("v=spf1 …") and long values split into several quoted chunks.
 */
export function unquoteTxt(content: string) {
  const trimmed = content.trim();
  if (!trimmed.startsWith('"') || !trimmed.endsWith('"')) return trimmed;
  const chunks = [...trimmed.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((match) => match[1]);
  if (!chunks.length) return trimmed;
  return chunks.join("").replace(/\\(["\\])/g, "$1");
}

/** Comparable content per type (host names lower-case without trailing dot). */
export function canonicalContent(type: DnsModuleRecordType, content: string) {
  const value = content.trim();
  switch (type) {
    case "TXT":
      return unquoteTxt(value);
    case "CNAME":
    case "MX":
    case "NS":
      return normaliseDnsName(value);
    case "AAAA":
      return value.toLowerCase();
    case "SRV": {
      const [weight, port, target] = value.split(/\s+/);
      return [weight, port, normaliseDnsName(target ?? "")].join(" ");
    }
    case "CAA": {
      const match = value.match(/^(\d+)\s+(\S+)\s+(.*)$/);
      if (!match) return value;
      return `${match[1]} ${match[2].toLowerCase()} ${unquoteTxt(match[3])}`;
    }
    default:
      return value;
  }
}

/** Cloudflare record → contract record (null for types we don't manage, e.g. HTTPS). */
export function fromCloudflareRecord(record: CloudflareDnsRecord): (DnsModuleRecord & { id: string }) | null {
  if (!isSupportedType(record.type)) return null;
  const type = record.type;
  const data = record.data ?? {};
  let content = record.content ?? "";
  let priority = record.priority;

  if (type === "SRV" && data.target !== undefined) {
    content = `${data.weight ?? 0} ${data.port ?? 0} ${normaliseDnsName(String(data.target))}`;
    priority = typeof data.priority === "number" ? data.priority : priority;
  } else if (type === "CAA" && data.tag !== undefined) {
    content = `${data.flags ?? 0} ${data.tag} "${data.value ?? ""}"`;
  } else if (type === "SRV" && content) {
    // Older payloads: content "priority weight port target" without data.
    const parts = content.trim().split(/\s+/);
    if (parts.length === 4) {
      priority = Number(parts[0]);
      content = parts.slice(1).join(" ");
    }
  }

  return {
    id: record.id,
    type,
    name: normaliseDnsName(record.name),
    content: type === "TXT" ? unquoteTxt(content) : canonicalContent(type, content),
    ttl: record.ttl,
    ...(priority !== undefined && (type === "MX" || type === "SRV") ? { priority } : {}),
    ...(PROXIABLE_TYPES.includes(type) ? { proxied: Boolean(record.proxied) } : {}),
  };
}

export interface RecordDefaults {
  ttl: number;
  proxied: boolean;
}

/** Contract record → Cloudflare create/overwrite body. */
export function toCloudflareBody(record: DnsModuleRecord, defaults: RecordDefaults) {
  const type = record.type;
  const name = normaliseDnsName(record.name);
  const proxied = PROXIABLE_TYPES.includes(type) ? (record.proxied ?? defaults.proxied) : undefined;
  // Proxied records always use automatic TTL on Cloudflare.
  const rawTtl = proxied ? 1 : (record.ttl ?? defaults.ttl);
  const ttl = rawTtl === 1 ? 1 : Math.min(86400, Math.max(60, rawTtl));
  const body: Record<string, unknown> = { type, name, ttl, comment: "KLEACORE" };
  if (proxied !== undefined) body.proxied = proxied;

  if (type === "SRV") {
    const [weight, port, target] = record.content.trim().split(/\s+/);
    body.data = {
      priority: record.priority ?? 0,
      weight: Number(weight),
      port: Number(port),
      target: normaliseDnsName(target ?? ""),
    };
  } else if (type === "CAA") {
    const match = record.content.trim().match(/^(\d+)\s+(\S+)\s+(.*)$/);
    body.data = match
      ? { flags: Number(match[1]), tag: match[2].toLowerCase(), value: unquoteTxt(match[3]) }
      : { flags: 0, tag: "issue", value: record.content.trim() };
  } else {
    body.content = type === "TXT" ? record.content.trim() : canonicalContent(type, record.content);
    if (type === "MX") body.priority = record.priority ?? 10;
  }
  return body;
}

/** Does `existing` satisfy the upsert key of `wanted` (contract rule)? */
export function isUpsertMatch(existing: DnsModuleRecord, wanted: DnsModuleRecord) {
  if (existing.type !== wanted.type) return false;
  if (normaliseDnsName(existing.name) !== normaliseDnsName(wanted.name)) return false;
  if (SINGLE_VALUE_DNS_TYPES.includes(wanted.type)) return true;
  return canonicalContent(existing.type, existing.content) === canonicalContent(wanted.type, wanted.content);
}

/** True when writing `wanted` over `existing` would change nothing. */
export function isSameRecord(existing: DnsModuleRecord, wanted: DnsModuleRecord, defaults: RecordDefaults) {
  const a = toCloudflareBody(existing, defaults);
  const b = toCloudflareBody(wanted, defaults);
  return JSON.stringify({ ...a, comment: null }) === JSON.stringify({ ...b, comment: null });
}
