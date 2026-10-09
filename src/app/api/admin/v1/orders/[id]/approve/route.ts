import { adminApiRoute } from "@/lib/admin-api/route";
import { approveOrder } from "@/lib/admin-api/operations/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = adminApiRoute(approveOrder);
