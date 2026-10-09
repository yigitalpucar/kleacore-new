import { adminApiRoute } from "@/lib/admin-api/route";
import { mrrReport } from "@/lib/admin-api/operations/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminApiRoute(mrrReport);
