import { adminApiRoute } from "@/lib/admin-api/route";
import { retryJob } from "@/lib/admin-api/operations/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = adminApiRoute(retryJob);
