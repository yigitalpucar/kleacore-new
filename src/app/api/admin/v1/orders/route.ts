import { adminApiRoute } from "@/lib/admin-api/route";
import { listOrders } from "@/lib/admin-api/operations/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminApiRoute(listOrders);
