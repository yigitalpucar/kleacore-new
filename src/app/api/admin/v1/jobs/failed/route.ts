import { adminApiRoute } from "@/lib/admin-api/route";
import { listFailedJobs } from "@/lib/admin-api/operations/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminApiRoute(listFailedJobs);
