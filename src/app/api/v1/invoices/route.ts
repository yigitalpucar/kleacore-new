import { NextRequest } from "next/server";
import { authenticateApiRequest } from "@/lib/api/v1/auth";
import { serializeInvoiceSummary } from "@/lib/api/v1/serialize";
import { getInvoices } from "@/lib/dal/invoices";
import { success, unauthorized } from "@/lib/utils/api-response";
import { parsePagination } from "@/lib/utils/pagination";
import type { InvoiceStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedStatuses = new Set<InvoiceStatus>([
  "DRAFT",
  "PENDING",
  "PAID",
  "OVERDUE",
  "CANCELLED",
]);

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (!auth) {
    return unauthorized("Geçersiz veya eksik API anahtarı");
  }

  const { searchParams } = new URL(request.url);
  const pagination = parsePagination(
    Object.fromEntries(searchParams.entries())
  );

  const statusParam = searchParams.get("status");
  const status =
    statusParam && allowedStatuses.has(statusParam as InvoiceStatus)
      ? (statusParam as InvoiceStatus)
      : undefined;

  const result = await getInvoices({
    ...pagination,
    status,
    customerId: auth.customerId,
  });

  return success({
    invoices: result.data.map((invoice) =>
      serializeInvoiceSummary({
        ...invoice,
        payments: [],
      })
    ),
    pagination: {
      total: result.total,
      page: result.page,
      perPage: result.perPage,
      totalPages: result.totalPages,
    },
  });
}