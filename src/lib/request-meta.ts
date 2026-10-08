import { headers } from "next/headers";

/** Client IP and user agent of the current request (server actions / RSC). */
export async function getRequestMeta() {
  try {
    const list = await headers();
    const ip =
      list.get("x-forwarded-for")?.split(",")[0]?.trim() || list.get("x-real-ip")?.trim() || null;
    const userAgent = list.get("user-agent")?.slice(0, 512) || null;
    return { ip, userAgent };
  } catch {
    // Outside a request scope (tests, jobs).
    return { ip: null, userAgent: null };
  }
}
