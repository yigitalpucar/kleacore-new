import { NextRequest } from "next/server";
import { authenticateApiRequest } from "@/lib/api/v1/auth";
import { enforceApiRateLimit } from "@/lib/api/v1/rate-limit";
import { serializeServiceSummary } from "@/lib/api/v1/serialize";
import { getServices } from "@/lib/dal/services";
import { success, unauthorized } from "@/lib/utils/api-response";
import { parsePagination } from "@/lib/utils/pagination";
import type { ProductCategorySlug, ServiceStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedStatuses = new Set<ServiceStatus>([
  "ACTIVE",
  "SUSPENDED",
  "CANCELLED",
  "EXPIRED",
]);

const allowedCategorySlugs = new Set<ProductCategorySlug>([
  "hosting",
  "vds",
  "vps",
  "server",
  "cloud",
  "datacenter",
  "domain",
  "ssl",
  "email",
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
  const categoryParam = searchParams.get("category");

  const status =
    statusParam && allowedStatuses.has(statusParam as ServiceStatus)
      ? (statusParam as ServiceStatus)
      : undefined;
  const categorySlug =
    categoryParam &&
    allowedCategorySlugs.has(categoryParam as ProductCategorySlug)
      ? (categoryParam as ProductCategorySlug)
      : undefined;

  const result = await getServices({
    ...pagination,
    status,
    categorySlug,
    customerId: auth.customerId,
  });

  return success({
    services: result.data.map(serializeServiceSummary),
    pagination: {
      total: result.total,
      page: result.page,
      perPage: result.perPage,
      totalPages: result.totalPages,
    },
  });
}