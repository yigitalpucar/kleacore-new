import { adminApiRoute } from "@/lib/admin-api/route";
import { getTicket } from "@/lib/admin-api/operations/tickets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminApiRoute(getTicket);
