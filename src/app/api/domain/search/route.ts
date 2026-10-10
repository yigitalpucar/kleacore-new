import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/money";
import { checkRateLimit, normalizeRateLimitKey } from "@/lib/rate-limit";
import { getRequestMeta } from "@/lib/request-meta";
import { getRegistrarProvider } from "@/lib/integrations/registrar";
import { createAvailabilityChecker, fetchRdapAnswer } from "@/lib/domains/availability";
import { MAX_TLDS_PER_SEARCH, parseDomainQuery, pickSearchTlds } from "@/lib/domains/search-query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 10 * 60 * 1000;

const checker = createAvailabilityChecker({
  findLocal: async (domains) =>
    (await db.domain.findMany({ where: { name: { in: domains } }, select: { name: true } })).map(
      (domain) => domain.name
    ),
  registrar: getRegistrarProvider,
  rdap: fetchRdapAnswer,
});

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

/**
 * Public domain search for the search-as-you-type box: GET ?q=ornek&tlds=.com,.net
 * Same rate limits as searchDomainAvailability (per query and per IP). Prices
 * come from the active TLD table; availability from the cached checker.
 */
export async function GET(request: NextRequest) {
  const parsed = parseDomainQuery(request.nextUrl.searchParams.get("q") ?? "");
  if (!parsed) {
    return json({ error: "Geçerli bir alan adı girin (harf, rakam ve tire)." }, 400);
  }

  const { ip } = await getRequestMeta();
  const [byQuery, byClient] = await Promise.all([
    checkRateLimit({ key: `domain-search:${normalizeRateLimitKey(parsed.label)}`, limit: 30, windowMs: WINDOW_MS }),
    ip
      ? checkRateLimit({ key: `domain-search:ip:${normalizeRateLimitKey(ip)}`, limit: 60, windowMs: WINDOW_MS })
      : Promise.resolve({ allowed: true, retryAfterSeconds: undefined }),
  ]);
  if (!byQuery.allowed || !byClient.allowed) {
    return json(
      {
        error: "Çok fazla sorgu yapıldı. Lütfen biraz sonra tekrar deneyin.",
        retryAfter: byQuery.retryAfterSeconds ?? byClient.retryAfterSeconds ?? 60,
      },
      429
    );
  }

  const tlds = await db.domainTld.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
    select: { ext: true, registerPrice: true, renewPrice: true },
  });
  const sold = tlds.map((tld) => tld.ext);
  const requested = (request.nextUrl.searchParams.get("tlds") ?? "")
    .split(",")
    .map((ext) => ext.trim().toLowerCase())
    .filter((ext) => sold.includes(ext));
  const exts = requested.length > 0
    ? Array.from(new Set(requested)).slice(0, MAX_TLDS_PER_SEARCH)
    : pickSearchTlds(sold, parsed.ext, MAX_TLDS_PER_SEARCH);

  const domains = exts.map((ext) => `${parsed.label}${ext}`);
  const statuses = await checker.check(domains);
  const priceByExt = new Map(tlds.map((tld) => [tld.ext, tld]));

  return json({
    label: parsed.label,
    typedExt: parsed.ext,
    typedExtSold: parsed.ext ? sold.includes(parsed.ext) : null,
    results: exts.map((ext) => {
      const domain = `${parsed.label}${ext}`;
      const tld = priceByExt.get(ext);
      return {
        domain,
        ext,
        status: statuses.get(domain) ?? "unknown",
        price: toNumber(tld?.registerPrice),
        renewPrice: toNumber(tld?.renewPrice),
      };
    }),
  });
}
