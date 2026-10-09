import { adminApiRoute } from "@/lib/admin-api/route";
import { getCustomer, updateCustomer } from "@/lib/admin-api/operations/customers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminApiRoute(getCustomer);
export const PATCH = adminApiRoute(updateCustomer);
