/**
 * IPv4 CIDR helpers for the mini IPAM (pure, no DB). IPv6 pools are not
 * supported: VDS customers get one public IPv4 each.
 */

/** Largest pool we expand into rows (a /20). */
export const MAX_POOL_ADDRESSES = 4096;

export class CidrError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CidrError";
  }
}

const OCTET = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

export function isIpv4(value: string) {
  const parts = value.trim().split(".");
  return parts.length === 4 && parts.every((part) => OCTET.test(part));
}

export function ipv4ToInt(value: string): number {
  if (!isIpv4(value)) throw new CidrError(`Geçersiz IPv4 adresi: ${value}`);
  return value
    .trim()
    .split(".")
    .reduce((acc, part) => acc * 256 + Number(part), 0);
}

export function intToIpv4(value: number): string {
  return [value >>> 24, (value >>> 16) & 255, (value >>> 8) & 255, value & 255].join(".");
}

export function prefixToNetmask(prefix: number) {
  return intToIpv4(prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0);
}

export interface ParsedCidr {
  /** Normalised "network/prefix". */
  cidr: string;
  network: string;
  networkInt: number;
  prefix: number;
  netmask: string;
  broadcast: string;
  broadcastInt: number;
  /** Total addresses in the block, including network/broadcast. */
  size: number;
}

/** Parses "a.b.c.d/nn". Host bits must be zero ("10.0.0.5/24" is rejected as a likely typo). */
export function parseCidr(input: string): ParsedCidr {
  const [address, prefixText, extra] = input.trim().split("/");
  if (extra !== undefined || !address || !prefixText || !/^\d{1,2}$/.test(prefixText)) {
    throw new CidrError(`Geçersiz CIDR: ${input} (ör. 188.132.235.0/24)`);
  }
  const prefix = Number(prefixText);
  if (prefix > 32) throw new CidrError(`Geçersiz önek: /${prefix}`);

  const ip = ipv4ToInt(address);
  const size = 2 ** (32 - prefix);
  const networkInt = ip - (ip % size);
  if (networkInt !== ip) {
    throw new CidrError(`${input} bir ağ adresi değil; ${intToIpv4(networkInt)}/${prefix} mü demek istediniz?`);
  }
  const broadcastInt = networkInt + size - 1;

  return {
    cidr: `${intToIpv4(networkInt)}/${prefix}`,
    network: intToIpv4(networkInt),
    networkInt,
    prefix,
    netmask: prefixToNetmask(prefix),
    broadcast: intToIpv4(broadcastInt),
    broadcastInt,
    size,
  };
}

export function cidrContains(parsed: ParsedCidr, address: string) {
  const value = ipv4ToInt(address);
  return value >= parsed.networkInt && value <= parsed.broadcastInt;
}

/**
 * "10.0.0.1-10.0.0.9, 10.0.0.20" (comma / newline separated) → inclusive
 * integer ranges. Single addresses become one-address ranges.
 */
export function parseIpRanges(input: string): Array<[number, number]> {
  return input
    .split(/[\n,;]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [startText, endText] = part.split("-").map((item) => item.trim());
      const start = ipv4ToInt(startText);
      const end = endText ? ipv4ToInt(endText) : start;
      if (end < start) throw new CidrError(`Geçersiz aralık: ${part}`);
      return [start, end] as [number, number];
    });
}

export interface ExpandedAddress {
  address: string;
  sortKey: number;
  reserved: boolean;
}

/**
 * Usable host addresses of a block: network and broadcast are skipped for
 * /30 and larger blocks (/31 and /32 use every address, RFC 3021), the
 * gateway is skipped, and addresses inside `reservedRanges` come back with
 * `reserved: true`.
 */
export function expandCidr(
  cidr: string,
  options: { gateway?: string | null; reservedRanges?: Array<[number, number]> } = {}
): ExpandedAddress[] {
  const parsed = parseCidr(cidr);
  if (parsed.size > MAX_POOL_ADDRESSES) {
    throw new CidrError(`Havuz en fazla ${MAX_POOL_ADDRESSES} adres içerebilir (/${32 - Math.log2(MAX_POOL_ADDRESSES)}); daha küçük bloklara bölün.`);
  }

  const skipEdges = parsed.prefix <= 30;
  const first = skipEdges ? parsed.networkInt + 1 : parsed.networkInt;
  const last = skipEdges ? parsed.broadcastInt - 1 : parsed.broadcastInt;
  const gateway = options.gateway?.trim() ? ipv4ToInt(options.gateway) : null;
  const reserved = options.reservedRanges ?? [];

  const addresses: ExpandedAddress[] = [];
  for (let value = first; value <= last; value++) {
    if (value === gateway) continue;
    addresses.push({
      address: intToIpv4(value),
      sortKey: value,
      reserved: reserved.some(([start, end]) => value >= start && value <= end),
    });
  }
  return addresses;
}
