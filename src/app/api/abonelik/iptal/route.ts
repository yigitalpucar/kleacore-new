import { NextRequest, NextResponse } from "next/server";
import { setMarketingConsent, UNSUBSCRIBE_PATH, verifyUnsubscribeToken } from "@/lib/broadcasts/consent";
import { getAppBaseUrl } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * RFC 8058 one-click unsubscribe: mail clients POST
 * "List-Unsubscribe=One-Click" to the URL in the List-Unsubscribe header.
 * No session, no CSRF token — the signed `t` parameter is the authorisation,
 * and it can only turn marketing mail off.
 */
export async function POST(request: NextRequest) {
  const userId = verifyUnsubscribeToken(request.nextUrl.searchParams.get("t"));
  if (!userId) return NextResponse.json({ ok: false, error: "INVALID_TOKEN" }, { status: 400 });
  const result = await setMarketingConsent(userId, false, {
    source: "one_click",
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: request.headers.get("user-agent")?.slice(0, 512) || null,
  });
  if (!result.found) return NextResponse.json({ ok: false, error: "INVALID_TOKEN" }, { status: 400 });
  return NextResponse.json({ ok: true });
}

/** A client that opens the header URL in a browser lands on the confirmation page. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t") ?? "";
  return NextResponse.redirect(`${getAppBaseUrl()}${UNSUBSCRIBE_PATH}?t=${encodeURIComponent(token)}`, 303);
}
