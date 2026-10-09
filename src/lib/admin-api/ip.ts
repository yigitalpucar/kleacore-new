/**
 * IP allowlist of an admin API token: single addresses or CIDR ranges,
 * IPv4 and IPv6 (node:net BlockList does the matching).
 */
import { BlockList, isIP } from "node:net";
import { clientIpFromHeaders } from "@/lib/request-meta";

/** "::ffff:1.2.3.4" (IPv4-mapped, common behind dual-stack proxies) → "1.2.3.4". */
export function normalizeIp(ip: string): string {
  const trimmed = ip.trim();
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(trimmed);
  return mapped ? mapped[1] : trimmed;
}

type ParsedEntry = { address: string; family: "ipv4" | "ipv6"; prefix: number | null };

export function parseAllowlistEntry(entry: string): ParsedEntry | null {
  const [rawAddress, rawPrefix, extra] = entry.trim().split("/");
  if (extra !== undefined || !rawAddress) return null;
  const address = normalizeIp(rawAddress);
  const version = isIP(address);
  if (version === 0) return null;
  const family = version === 4 ? "ipv4" : "ipv6";
  if (rawPrefix === undefined) return { address, family, prefix: null };
  if (!/^\d{1,3}$/.test(rawPrefix)) return null;
  const prefix = Number(rawPrefix);
  if (prefix > (family === "ipv4" ? 32 : 128)) return null;
  return { address, family, prefix };
}

/** Splits a textarea/comma list into entries; returns the invalid ones too. */
export function parseAllowlist(input: string | string[]): { entries: string[]; invalid: string[] } {
  const raw = (Array.isArray(input) ? input : input.split(/[\s,;]+/)).map((s) => s.trim()).filter(Boolean);
  const entries: string[] = [];
  const invalid: string[] = [];
  for (const entry of raw) {
    if (parseAllowlistEntry(entry)) {
      if (!entries.includes(entry)) entries.push(entry);
    } else {
      invalid.push(entry);
    }
  }
  return { entries, invalid };
}

/** Empty allowlist = any address. Unknown client IP never matches a non-empty list. */
export function isIpAllowed(ip: string | null, allowlist: readonly string[]): boolean {
  if (allowlist.length === 0) return true;
  if (!ip) return false;
  const address = normalizeIp(ip);
  const version = isIP(address);
  if (version === 0) return false;

  const list = new BlockList();
  for (const entry of allowlist) {
    const parsed = parseAllowlistEntry(entry);
    if (!parsed) continue;
    if (parsed.prefix === null) list.addAddress(parsed.address, parsed.family);
    else list.addSubnet(parsed.address, parsed.prefix, parsed.family);
  }
  return list.check(address, version === 4 ? "ipv4" : "ipv6");
}

/** Client IP as the reverse proxy (Traefik / Dokploy) reports it. */
export function clientIp(request: Request): string | null {
  return clientIpFromHeaders(request.headers);
}
