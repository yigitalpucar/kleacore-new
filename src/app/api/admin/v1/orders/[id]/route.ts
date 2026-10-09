import { adminApiRoute } from "@/lib/admin-api/route";
import { getOrder } from "@/lib/admin-api/operations/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminApiRoute(getOrder);
