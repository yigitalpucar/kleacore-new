import { NextRequest } from "next/server";
import { authenticateApiRequest } from "@/lib/api/v1/auth";
import { enforceApiRateLimit } from "@/lib/api/v1/rate-limit";
import { serializeOrderDetail } from "@/lib/api/v1/serialize";
import { getOrderById } from "@/lib/dal/orders";
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

  const rateLimited = await enforceApiRateLimit(auth.apiKeyId);
  if (rateLimited) {
    return rateLimited;
  }

  const { id } = await context.params;
  const order = await getOrderById(id);

  if (!order) {
    return notFound("Sipariş bulunamadı");
  }

  if (order.customerId !== auth.customerId) {
    return forbidden("Bu siparişe erişim yetkiniz yok");
  }

  return success({
    order: serializeOrderDetail(order),
  });
}