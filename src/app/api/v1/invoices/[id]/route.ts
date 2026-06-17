import { NextRequest } from "next/server";
import { authenticateApiRequest } from "@/lib/api/v1/auth";
import { serializeInvoiceDetail } from "@/lib/api/v1/serialize";
import { getInvoiceById } from "@/lib/dal/invoices";
import { forbidden, notFound, success, unauthorized } from "@/lib/utils/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await authenticateApiRequest(request);
  if (!auth) {
    return unauthorized("Geçersiz veya eksik API anahtarı");
  }

  const { id } = await context.params;
  const invoice = await getInvoiceById(id);

  if (!invoice) {
    return notFound("Fatura bulunamadı");
  }

  if (invoice.customerId !== auth.customerId) {
    return forbidden("Bu faturaya erişim yetkiniz yok");
  }

  return success({
    invoice: serializeInvoiceDetail(invoice),
  });
}