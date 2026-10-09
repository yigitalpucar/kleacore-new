import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { HOME_COUNTRY } from "./rules";

const log = createLogger("fraud.ip-country");

/**
 * IP → country for the fraud rules (docs/fraud-kyc.md):
 *  1. Cloudflare's CF-IPCountry header, when the request came through the
 *     proxied host (www.kleacore.com) and `fraud_trust_cf_header` is on;
 *  2. the offline db-ip "IP to Country Lite" table (ip_country_ranges),
 *     loaded by scripts/load-ip-country-db.ts.
 * kleacore.com (root) is not proxied, so a client can send a forged
 * CF-IPCountry there. Forging a foreign country gains nothing, forging "TR"
 * would hide risk — so a "TR" header the DB contradicts is ignored.
 */

export interface ParsedIp {
  version: 4 | 6;
  value: bigint;
}

function parseIPv4(input: string): bigint | null {
  const parts = input.split(".");
  if (parts.length !== 4) return null;
  let value = BigInt(0);
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = (value << BigInt(8)) + BigInt(octet);
  }
  return value;
}

function parseIPv6(input: string): bigint | null {
  let address = input.toLowerCase();
  const zone = address.indexOf("%");
  if (zone >= 0) address = address.slice(0, zone);

  // Trailing dotted IPv4 (::ffff:1.2.3.4) → two hextets.
  const lastColon = address.lastIndexOf(":");
  if (address.includes(".") && lastColon >= 0) {
    const v4 = parseIPv4(address.slice(lastColon + 1));
    if (v4 === null) return null;
    const high = Number(v4 >> BigInt(16));
    const low = Number(v4 & BigInt(0xffff));
    address = `${address.slice(0, lastColon + 1)}${high.toString(16)}:${low.toString(16)}`;
  }

  const halves = address.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 1) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  if (groups.length !== 8) return null;

  let value = BigInt(0);
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
    value = (value << BigInt(16)) + BigInt(parseInt(group, 16));
  }
  return value;
}

const V4_MAPPED_PREFIX = BigInt("0xffff00000000");
const V4_MAPPED_MASK = BigInt("0xffffffffffffffffffffffff00000000");

/** IPv4 / IPv6 text → integer; IPv4-mapped IPv6 (::ffff:a.b.c.d) is treated as IPv4. */
export function parseIp(input: string | null | undefined): ParsedIp | null {
  const text = input?.trim();
  if (!text) return null;
  if (!text.includes(":")) {
    const v4 = parseIPv4(text);
    return v4 === null ? null : { version: 4, value: v4 };
  }
  const v6 = parseIPv6(text.replace(/^\[|\]$/g, ""));
  if (v6 === null) return null;
  if ((v6 & V4_MAPPED_MASK) === V4_MAPPED_PREFIX) {
    return { version: 4, value: v6 & BigInt(0xffffffff) };
  }
  return { version: 6, value: v6 };
}

function inRange(value: bigint, cidrStart: string, bits: number, total: number) {
  const start = parseIp(cidrStart);
  if (!start) return false;
  const shift = BigInt(total - bits);
  return value >> shift === start.value >> shift;
}

/** Loopback, private, link-local, CGNAT, ULA: no country. */
export function isPrivateIp(ip: ParsedIp): boolean {
  if (ip.version === 4) {
    return [
      ["10.0.0.0", 8],
      ["127.0.0.0", 8],
      ["169.254.0.0", 16],
      ["172.16.0.0", 12],
      ["192.168.0.0", 16],
      ["100.64.0.0", 10],
      ["0.0.0.0", 8],
    ].some(([start, bits]) => inRange(ip.value, start as string, bits as number, 32));
  }
  return (
    ip.value === BigInt(1) ||
    ip.value === BigInt(0) ||
    inRange(ip.value, "fc00::", 7, 128) ||
    inRange(ip.value, "fe80::", 10, 128)
  );
}

/** Two-letter code from CF-IPCountry; "XX" (unknown) → null. Tor ("T1") is kept. */
export function normalizeCfCountry(value: string | null | undefined): string | null {
  const code = value?.trim().toUpperCase();
  if (!code || !/^[A-Z][A-Z0-9]$/.test(code) || code === "XX") return null;
  return code;
}

type LookupClient = Pick<typeof db, "ipCountryRange">;

/** Country of an address from the offline table; null when unknown / table empty. */
export async function lookupIpCountryInDb(ip: string | null | undefined, client: LookupClient = db): Promise<string | null> {
  const parsed = parseIp(ip);
  if (!parsed || isPrivateIp(parsed)) return null;
  try {
    const value = new Prisma.Decimal(parsed.value.toString());
    const range = await client.ipCountryRange.findFirst({
      where: { version: parsed.version, ipFrom: { lte: value } },
      orderBy: { ipFrom: "desc" },
      select: { ipTo: true, country: true },
    });
    if (!range || range.ipTo.lessThan(value)) return null;
    const country = range.country.trim().toUpperCase();
    return country === "ZZ" ? null : country;
  } catch (error) {
    log.warn("ip country lookup failed", { error });
    return null;
  }
}

export interface IpCountryResolution {
  country: string | null;
  source: "cf-header" | "db" | null;
}

/**
 * Header first (when trusted), DB as fallback. A home-country header the DB
 * contradicts is ignored (possible forgery on the non-proxied root domain).
 */
export async function resolveIpCountry(
  input: { ip: string | null | undefined; cfCountry?: string | null; trustCfHeader: boolean },
  lookup: (ip: string | null | undefined) => Promise<string | null> = lookupIpCountryInDb
): Promise<IpCountryResolution> {
  const header = input.trustCfHeader ? normalizeCfCountry(input.cfCountry) : null;
  const fromDb = await lookup(input.ip);
  if (header && (header !== HOME_COUNTRY || !fromDb || fromDb === header)) {
    return { country: header, source: "cf-header" };
  }
  if (fromDb) return { country: fromDb, source: "db" };
  return { country: null, source: null };
}
