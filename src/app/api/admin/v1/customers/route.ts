import { adminApiRoute } from "@/lib/admin-api/route";
import { listCustomers, createCustomer } from "@/lib/admin-api/operations/customers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminApiRoute(listCustomers);
export const POST = adminApiRoute(createCustomer);
