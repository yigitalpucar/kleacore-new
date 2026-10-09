import { adminApiRoute } from "@/lib/admin-api/route";
import { replyToTicket } from "@/lib/admin-api/operations/tickets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = adminApiRoute(replyToTicket);
