import { adminApiRoute } from "@/lib/admin-api/route";
import { listDomains } from "@/lib/admin-api/operations/domains";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminApiRoute(listDomains);
