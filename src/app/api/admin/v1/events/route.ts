import { adminApiRoute } from "@/lib/admin-api/route";
import { listEvents } from "@/lib/admin-api/operations/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminApiRoute(listEvents);
