import { headers } from "next/headers";
import { countryFromHeaders } from "@/lib/security/device";

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
  /** CDN country header (cf-ipcountry), when present. */
  country: string | null;
}

/** Client IP, user agent and CDN country from a header list. */
export function requestMetaFromHeaders(list: Pick<Headers, "get"> | null | undefined): RequestMeta {
  if (!list) return { ip: null, userAgent: null, country: null };
  const ip = list.get("x-forwarded-for")?.split(",")[0]?.trim() || list.get("x-real-ip")?.trim() || null;
  const userAgent = list.get("user-agent")?.slice(0, 512) || null;
  return { ip, userAgent, country: countryFromHeaders(list) };
}

/** Client IP and user agent of the current request (server actions / RSC). */
export async function getRequestMeta(): Promise<RequestMeta> {
  try {
    return requestMetaFromHeaders(await headers());
  } catch {
    // Outside a request scope (tests, jobs).
    return { ip: null, userAgent: null, country: null };
  }
}
