import { headers } from "next/headers";

/**
 * Cloudflare's visitor country header of the current request (only present
 * on proxied hosts — www.kleacore.com; see ip-country.ts for how it is
 * trusted). Null outside a request scope.
 */
export async function getCfCountryHeader(): Promise<string | null> {
  try {
    const list = await headers();
    return list.get("cf-ipcountry")?.trim() || null;
  } catch {
    return null;
  }
}
