import { adminApiRoute } from "@/lib/admin-api/route";
import { listTickets } from "@/lib/admin-api/operations/tickets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminApiRoute(listTickets);
