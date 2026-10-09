import { adminApiRoute } from "@/lib/admin-api/route";
import { listInvoices, createInvoice } from "@/lib/admin-api/operations/invoices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminApiRoute(listInvoices);
export const POST = adminApiRoute(createInvoice);
