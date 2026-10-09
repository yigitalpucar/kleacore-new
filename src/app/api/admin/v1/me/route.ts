import { adminApiRoute } from "@/lib/admin-api/route";
import { getMe } from "@/lib/admin-api/operations/meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminApiRoute(getMe);
