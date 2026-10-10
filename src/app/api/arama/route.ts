import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { normalizeSearchQuery, searchCustomerRecords } from "@/lib/search/command-search";
import { allowSearch } from "@/lib/search/rate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Customer panel ⌘K data search: the signed-in user's own services, domains,
 * invoices and tickets (scoped by session user id; nothing else is accepted).
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const query = normalizeSearchQuery(request.nextUrl.searchParams.get("q"));
  if (!query) return NextResponse.json({ groups: [] });

  const limit = await allowSearch(session.user.id);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds ?? 30) } }
    );
  }

  const groups = await searchCustomerRecords(session.user.id, query);
  return NextResponse.json({ groups }, { headers: { "Cache-Control": "no-store" } });
}
