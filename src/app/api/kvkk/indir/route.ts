import { NextRequest, NextResponse } from "next/server";
import { consumeExportDownload } from "@/lib/privacy/export";
import { checkRateLimit, normalizeRateLimitKey } from "@/lib/rate-limit";
import { clientIpFromHeaders } from "@/lib/request-meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One-time KVKK export download. POST only (the mailed link opens a page with
 * a button), so link scanners in mail clients can never burn the download.
 */
export async function POST(request: NextRequest) {
  const ip = clientIpFromHeaders(request.headers);
  if (ip) {
    const limit = await checkRateLimit({ key: `kvkk-download:${normalizeRateLimitKey(ip)}`, limit: 20, windowMs: 60 * 60 * 1000 });
    if (!limit.allowed) return redirectBack(request, "limit");
  }

  const form = await request.formData().catch(() => null);
  const token = String(form?.get("token") ?? "");
  const result = await consumeExportDownload(token);
  if (!result.ok) return redirectBack(request, result.reason);

  return new NextResponse(new Uint8Array(result.data), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${result.fileName}"`,
      "Content-Length": String(result.data.length),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function redirectBack(request: NextRequest, reason: string) {
  const url = new URL("/yasal/kvkk-basvuru/indir", request.url);
  url.searchParams.set("hata", reason);
  return NextResponse.redirect(url, 303);
}
