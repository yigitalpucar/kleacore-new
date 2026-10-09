import { adminApiRoute } from "@/lib/admin-api/route";
import { listServices } from "@/lib/admin-api/operations/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminApiRoute(listServices);
