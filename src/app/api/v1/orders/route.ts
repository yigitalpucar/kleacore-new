import { NextRequest } from "next/server";
import { authenticateApiRequest } from "@/lib/api/v1/auth";
import { enforceApiRateLimit } from "@/lib/api/v1/rate-limit";
import { serializeOrderSummary } from "@/lib/api/v1/serialize";
import { getOrders } from "@/lib/dal/orders";
import { success, unauthorized } from "@/lib/utils/api-response";
import { parsePagination } from "@/lib/utils/pagination";
import type { OrderStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedStatuses = new Set<OrderStatus>([
  "PENDING",
  "APPROVED",
  "PROCESSING",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
]);

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (!auth) {
    return unauthorized("Geçersiz veya eksik API anahtarı");
  }

  const rateLimited = await enforceApiRateLimit(auth.apiKeyId);
  if (rateLimited) {
    return rateLimited;
  }

  const { searchParams } = new URL(request.url);
  const pagination = parsePagination(
    Object.fromEntries(searchParams.entries())
  );

  const statusParam = searchParams.get("status");
  const status =
    statusParam && allowedStatuses.has(statusParam as OrderStatus)
      ? (statusParam as OrderStatus)
      : undefined;

  const result = await getOrders({
    ...pagination,
    status,
    customerId: auth.customerId,
  });

  return success({
    orders: result.data.map(serializeOrderSummary),
    pagination: {
      total: result.total,
      page: result.page,
      perPage: result.perPage,
      totalPages: result.totalPages,
    },
  });
}