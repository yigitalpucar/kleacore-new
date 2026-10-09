import { adminApiRoute } from "@/lib/admin-api/route";
import { markInvoicePaid } from "@/lib/admin-api/operations/invoices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = adminApiRoute(markInvoicePaid);
