/**
 * DNS record validation for the customer/admin editors (client + server).
 * Pure: no server imports. Names are entered relative to the zone ("@",
 * "www", "_dmarc") or fully qualified; values are checked per record type.
 */

export const DNS_EDITOR_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "SRV", "CAA", "NS"] as const;
export type DnsEditorType = (typeof DNS_EDITOR_TYPES)[number];

/** Types Cloudflare can proxy (orange cloud). */
export const DNS_PROXIABLE_TYPES: readonly DnsEditorType[] = ["A", "AAAA", "CNAME"];

/** TTL choices; 1 = Cloudflare "Otomatik" (only offered on Cloudflare zones). */
export const DNS_TTL_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 1, label: "Otomatik" },
  { value: 60, label: "1 dakika" },
  { value: 120, label: "2 dakika" },
  { value: 300, label: "5 dakika" },
  { value: 600, label: "10 dakika" },
  { value: 1800, label: "30 dakika" },
  { value: 3600, label: "1 saat" },
  { value: 7200, label: "2 saat" },
  { value: 18000, label: "5 saat" },
  { value: 43200, label: "12 saat" },
  { value: 86400, label: "1 gün" },
];

export const DNS_TYPE_HINTS: Record<DnsEditorType, { value: string; placeholder: string }> = {
  A: { value: "IPv4 adresi", placeholder: "192.0.2.10" },
  AAAA: { value: "IPv6 adresi", placeholder: "2001:db8::10" },
  CNAME: { value: "Hedef alan adı", placeholder: "hedef.ornek.com" },
  MX: { value: "Posta sunucusu", placeholder: "mail.ornek.com" },
  TXT: { value: "Metin", placeholder: "v=spf1 include:_spf.google.com ~all" },
  SRV: { value: "Ağırlık, port ve hedef", placeholder: "5 5060 sip.ornek.com" },
  CAA: { value: "Bayrak, etiket ve değer", placeholder: '0 issue "letsencrypt.org"' },
  NS: { value: "Ad sunucusu", placeholder: "ns1.baska-saglayici.com" },
};

export interface DnsRecordFormInput {
  type: string;
  name: string;
  value: string;
  ttl?: number | null;
  priority?: number | null;
  proxied?: boolean | null;
}

export interface ValidDnsRecord {
  type: DnsEditorType;
  /** Relative name: "@" for the apex, else the labels below the zone ("www", "_sip._tcp"). */
  name: string;
  /** Fully qualified, lower case, no trailing dot. */
  fqdn: string;
  value: string;
  ttl: number;
  priority: number | null;
  proxied: boolean;
}

export type DnsField = "type" | "name" | "value" | "ttl" | "priority" | "proxied";

export type DnsValidationResult =
  | { ok: true; record: ValidDnsRecord }
  | { ok: false; field: DnsField; error: string };

export interface DnsValidationOptions {
  /** Cloudflare zones accept TTL 1 (auto) and the proxy flag. */
  provider: "cloudflare" | "registrar";
}

const LABEL = /^(\*|[a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?)$/;
const HOST_LABEL = /^[a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?$/;

/** IDN → punycode via the URL parser (browser + Node); null when invalid. */
function toAsciiHost(value: string): string | null {
  try {
    return new URL(`http://${value}`).hostname;
  } catch {
    return null;
  }
}

export function isIPv4(value: string) {
  const parts = value.split(".");
  return (
    parts.length === 4 &&
    parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255 && (part === "0" || !part.startsWith("0")))
  );
}

export function isIPv6(value: string) {
  if (!value.includes(":") || !/^[0-9a-fA-F:.]+$/.test(value)) return false;
  try {
    new URL(`http://[${value}]`);
    return true;
  } catch {
    return false;
  }
}

/** A host name with at least two labels (target of CNAME/MX/NS/SRV). */
export function normaliseHostname(value: string): string | null {
  const trimmed = value.trim().toLowerCase().replace(/\.$/, "");
  if (!trimmed || trimmed.length > 253) return null;
  if (isIPv4(trimmed)) return null;
  const ascii = /^[\x00-\x7f]*$/.test(trimmed) ? trimmed : toAsciiHost(trimmed);
  if (!ascii) return null;
  const labels = ascii.split(".");
  if (labels.length < 2 || !labels.every((label) => HOST_LABEL.test(label))) return null;
  return ascii;
}

/**
 * Relative name → { name, fqdn } inside `zone`. Accepts "@", "", "www",
 * "www.ornek.com", "www.ornek.com." and "*.ornek.com".
 */
export function resolveRecordName(raw: string, zone: string): { name: string; fqdn: string } | { error: string } {
  const zoneName = zone.trim().toLowerCase().replace(/\.$/, "");
  let value = raw.trim().toLowerCase();
  if (value === "" || value === "@" || value === `${zoneName}.` || value === zoneName) {
    return { name: "@", fqdn: zoneName };
  }
  const absolute = value.endsWith(".");
  value = value.replace(/\.$/, "");
  if (value.endsWith(`.${zoneName}`)) {
    value = value.slice(0, -(zoneName.length + 1));
  } else if (absolute) {
    return { error: `Kayıt adı ${zoneName} alan adının altında olmalı.` };
  }
  if (!/^[\x00-\x7f]*$/.test(value)) {
    const ascii = toAsciiHost(`${value}.${zoneName}`);
    if (!ascii) return { error: "Kayıt adı geçersiz karakter içeriyor." };
    value = ascii.slice(0, -(zoneName.length + 1));
  }
  const labels = value.split(".");
  if (!labels.every((label, index) => (label === "*" ? index === 0 : LABEL.test(label)))) {
    return { error: "Kayıt adı yalnızca harf, rakam, tire ve alt çizgi içerebilir (her bölüm en fazla 63 karakter)." };
  }
  const fqdn = `${value}.${zoneName}`;
  if (fqdn.length > 253) return { error: "Kayıt adı çok uzun." };
  return { name: value, fqdn };
}

function parsePriority(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return value;
}

function inRange(value: number, min: number, max: number) {
  return Number.isInteger(value) && value >= min && value <= max;
}

export function validateDnsRecord(
  input: DnsRecordFormInput,
  zone: string,
  options: DnsValidationOptions
): DnsValidationResult {
  const type = String(input.type ?? "").trim().toUpperCase();
  if (!(DNS_EDITOR_TYPES as readonly string[]).includes(type)) {
    return { ok: false, field: "type", error: "Geçersiz DNS kayıt tipi." };
  }
  const recordType = type as DnsEditorType;

  const resolved = resolveRecordName(String(input.name ?? ""), zone);
  if ("error" in resolved) return { ok: false, field: "name", error: resolved.error };
  const { name, fqdn } = resolved;
  const isApex = name === "@";
  const wildcard = name === "*" || name.startsWith("*.");

  const rawValue = String(input.value ?? "").trim();
  if (!rawValue) return { ok: false, field: "value", error: "Kayıt değeri zorunludur." };

  const cloudflare = options.provider === "cloudflare";
  const ttl = input.ttl ?? (cloudflare ? 1 : 3600);
  if (!(cloudflare && ttl === 1) && !inRange(ttl, 60, 86400)) {
    return {
      ok: false,
      field: "ttl",
      error: cloudflare ? "TTL Otomatik ya da 60–86400 saniye olmalı." : "TTL 60–86400 saniye arasında olmalı.",
    };
  }

  let priority = parsePriority(input.priority);
  let value = rawValue;

  switch (recordType) {
    case "A":
      if (!isIPv4(rawValue)) return { ok: false, field: "value", error: "A kaydı için geçerli bir IPv4 adresi girin (ör. 192.0.2.10)." };
      break;
    case "AAAA":
      if (!isIPv6(rawValue)) return { ok: false, field: "value", error: "AAAA kaydı için geçerli bir IPv6 adresi girin (ör. 2001:db8::10)." };
      value = rawValue.toLowerCase();
      break;
    case "CNAME": {
      const host = normaliseHostname(rawValue);
      if (!host) return { ok: false, field: "value", error: "CNAME hedefi geçerli bir alan adı olmalı (IP adresi olamaz)." };
      if (host === fqdn) return { ok: false, field: "value", error: "CNAME kaydı kendisini gösteremez." };
      value = host;
      break;
    }
    case "MX": {
      const host = normaliseHostname(rawValue);
      if (!host) return { ok: false, field: "value", error: "MX değeri bir posta sunucusu adı olmalı (IP adresi olamaz)." };
      if (priority === null || !inRange(priority, 0, 65535)) {
        return { ok: false, field: "priority", error: "MX kaydı için 0–65535 arasında bir öncelik girin." };
      }
      value = host;
      break;
    }
    case "NS": {
      if (isApex) return { ok: false, field: "name", error: "Kök (@) NS kayıtları değiştirilemez; alt alan adı için kullanın." };
      const host = normaliseHostname(rawValue);
      if (!host) return { ok: false, field: "value", error: "NS değeri bir ad sunucusu adı olmalı." };
      value = host;
      break;
    }
    case "TXT":
      if (rawValue.length > 2048) return { ok: false, field: "value", error: "TXT değeri en fazla 2048 karakter olabilir." };
      break;
    case "SRV": {
      if (!/^_[a-z0-9-]+\._(tcp|udp|tls)(\.|$)/.test(name)) {
        return { ok: false, field: "name", error: "SRV kayıt adı _servis._protokol biçiminde olmalı (ör. _sip._tcp)." };
      }
      const parts = rawValue.split(/\s+/);
      if (parts.length !== 3) {
        return { ok: false, field: "value", error: "SRV değeri “ağırlık port hedef” biçiminde olmalı (ör. 5 5060 sip.ornek.com)." };
      }
      const [weight, port, target] = parts;
      if (!inRange(Number(weight), 0, 65535) || !inRange(Number(port), 0, 65535)) {
        return { ok: false, field: "value", error: "SRV ağırlık ve port değerleri 0–65535 arasında olmalı." };
      }
      const host = target === "." ? "." : normaliseHostname(target);
      if (!host) return { ok: false, field: "value", error: "SRV hedefi geçerli bir alan adı olmalı." };
      if (priority === null || !inRange(priority, 0, 65535)) {
        return { ok: false, field: "priority", error: "SRV kaydı için 0–65535 arasında bir öncelik girin." };
      }
      value = `${Number(weight)} ${Number(port)} ${host}`;
      break;
    }
    case "CAA": {
      const match = rawValue.match(/^(\d{1,3})\s+([a-zA-Z]+)\s+(.+)$/);
      if (!match) {
        return { ok: false, field: "value", error: "CAA değeri “bayrak etiket değer” biçiminde olmalı (ör. 0 issue \"letsencrypt.org\")." };
      }
      const flags = Number(match[1]);
      const tag = match[2].toLowerCase();
      const caaValue = match[3].trim().replace(/^"(.*)"$/, "$1");
      if (!inRange(flags, 0, 255)) return { ok: false, field: "value", error: "CAA bayrağı 0–255 arasında olmalı." };
      if (!["issue", "issuewild", "iodef"].includes(tag)) {
        return { ok: false, field: "value", error: "CAA etiketi issue, issuewild veya iodef olmalı." };
      }
      if (!caaValue) return { ok: false, field: "value", error: "CAA değeri boş olamaz." };
      value = `${flags} ${tag} "${caaValue}"`;
      break;
    }
  }

  if (recordType !== "MX" && recordType !== "SRV") priority = null;

  const proxiable = DNS_PROXIABLE_TYPES.includes(recordType);
  const proxied = Boolean(input.proxied) && proxiable && cloudflare;
  if (input.proxied && (!proxiable || !cloudflare)) {
    return { ok: false, field: "proxied", error: "Proxy yalnızca Cloudflare'deki A, AAAA ve CNAME kayıtlarında kullanılabilir." };
  }
  if (proxied && wildcard) {
    // Free plan zones can't proxy wildcard records.
    return { ok: false, field: "proxied", error: "Joker (*) kayıtlarda proxy kullanılamaz." };
  }

  return {
    ok: true,
    record: { type: recordType, name, fqdn, value, ttl: proxied ? 1 : ttl, priority, proxied },
  };
}

/** Display name of a stored record relative to the zone ("@", "www"). */
export function relativeRecordName(name: string, zone: string) {
  const value = name.trim().toLowerCase().replace(/\.$/, "");
  const zoneName = zone.trim().toLowerCase();
  if (value === zoneName || value === "@" || value === "") return "@";
  return value.endsWith(`.${zoneName}`) ? value.slice(0, -(zoneName.length + 1)) : value;
}

export function ttlLabel(ttl: number) {
  return DNS_TTL_OPTIONS.find((option) => option.value === ttl)?.label ?? `${ttl} sn`;
}
