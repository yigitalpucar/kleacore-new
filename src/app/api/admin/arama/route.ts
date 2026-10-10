import { NextResponse, type NextRequest } from "next/server";
import { normalizeSearchQuery, searchStaffRecords } from "@/lib/search/command-search";
import { allowSearch } from "@/lib/search/rate";
import { requireAnyPermission } from "@/lib/utils/auth-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin ⌘K data search. Any staff member holding one of the view permissions
 * gets in; each result group is then searched only when the role holds that
 * group's permission (see STAFF_SEARCH_PERMISSIONS).
 */
export async function GET(request: NextRequest) {
  const session = await requireAnyPermission(
    "customers.view",
    "invoices.view",
    "orders.view",
    "services.view",
    "domains.view",
    "tickets.view"
  );

  const query = normalizeSearchQuery(request.nextUrl.searchParams.get("q"));
  if (!query) return NextResponse.json({ groups: [] });

  const limit = await allowSearch(session.user.id);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds ?? 30) } }
    );
  }

  const groups = await searchStaffRecords(session.user.role, query);
  return NextResponse.json({ groups }, { headers: { "Cache-Control": "no-store" } });
}
