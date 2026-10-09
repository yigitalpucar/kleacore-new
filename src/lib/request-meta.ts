import { headers } from "next/headers";
import { normalizeCfCountry, resolveIpCountry, type IpCountryResolution } from "@/lib/fraud/ip-country";
import { getFraudConfig } from "@/lib/fraud/settings";
import { createLogger } from "@/lib/logger";

const log = createLogger("request-meta");

/**
 * The one place that reads client network data from request headers
 * (fraud scoring, login history / device notices, trusted devices, audit,
 * rate limits, admin API allowlists).
 *
 *  - IP: first hop of X-Forwarded-For (Traefik in front of the app sets it;
 *    the root domain kleacore.com is not behind Cloudflare), else X-Real-IP.
 *    IPv4-mapped IPv6 (::ffff:a.b.c.d) is reduced to the IPv4 address.
 *  - Country: CF-IPCountry only when it is trustworthy by the fraud rule
 *    (`fraud_trust_cf_header` on, and a home-country header the offline IP DB
 *    contradicts is ignored — it may be forged on the non-proxied host),
 *    otherwise the offline IP → country table (src/lib/fraud/ip-country.ts).
 */

type HeaderList = Pick<Headers, "get">;

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
  /** Resolved client country (trusted CF header or IP DB); null when unknown. */
  country: string | null;
  countrySource: IpCountryResolution["source"];
}

/** "::ffff:1.2.3.4" → "1.2.3.4"; anything else trimmed. */
function normalizeClientIp(ip: string): string {
  const trimmed = ip.trim();
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(trimmed);
  return mapped ? mapped[1] : trimmed;
}

/** Client IP: X-Forwarded-For first hop, else X-Real-IP. */
export function clientIpFromHeaders(list: HeaderList | null | undefined): string | null {
  if (!list) return null;
  const raw = list.get("x-forwarded-for")?.split(",")[0]?.trim() || list.get("x-real-ip")?.trim() || null;
  return raw ? normalizeClientIp(raw) : null;
}

/** Raw (untrusted) Cloudflare country header, normalised; "XX" → null. */
export function cfCountryFromHeaders(list: HeaderList | null | undefined): string | null {
  return normalizeCfCountry(list?.get("cf-ipcountry"));
}

/** Client country by the fraud rule (trusted CF header first, IP DB fallback). */
export async function resolveClientCountry(input: { ip: string | null; cfCountry: string | null }): Promise<IpCountryResolution> {
  let trustCfHeader = false;
  if (input.cfCountry) {
    try {
      trustCfHeader = (await getFraudConfig()).trustCfHeader;
    } catch (error) {
      log.warn("fraud config unavailable; CF-IPCountry not trusted", { error });
    }
  }
  try {
    return await resolveIpCountry({ ip: input.ip, cfCountry: input.cfCountry, trustCfHeader });
  } catch (error) {
    log.warn("client country lookup failed", { error });
    return { country: null, source: null };
  }
}

/** IP, user agent and resolved country from a header list (route handlers, auth). */
export async function requestMetaFromHeaders(list: HeaderList | null | undefined): Promise<RequestMeta> {
  if (!list) return { ip: null, userAgent: null, country: null, countrySource: null };
  const ip = clientIpFromHeaders(list);
  const userAgent = list.get("user-agent")?.slice(0, 512) || null;
  const { country, source } = await resolveClientCountry({ ip, cfCountry: cfCountryFromHeaders(list) });
  return { ip, userAgent, country, countrySource: source };
}

/** Client IP only, from next/headers (no country lookup). */
export async function getRequestIp(): Promise<string | null> {
  try {
    return clientIpFromHeaders(await headers());
  } catch {
    return null;
  }
}

/** Client IP, user agent and country of the current request (server actions / RSC). */
export async function getRequestMeta(): Promise<RequestMeta> {
  let list: HeaderList;
  try {
    list = await headers();
  } catch {
    // Outside a request scope (tests, jobs).
    return { ip: null, userAgent: null, country: null, countrySource: null };
  }
  return requestMetaFromHeaders(list);
}
