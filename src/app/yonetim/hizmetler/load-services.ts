import type { ServiceStatus } from "@prisma/client";
import { getServices, getServiceStats } from "@/lib/dal/services";
import { parsePagination } from "@/lib/utils/pagination";
import type { ServiceListRow } from "./content";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Shared loader for the admin service lists. The DataTable searches and
 * filters on the client, so a page loads up to 100 rows unless `perPage` is
 * given; `?page=` still moves between server pages (ServerPager).
 */
export async function loadServices(sp: SearchParams, status?: ServiceStatus) {
  const params = parsePagination(sp);
  if (sp.perPage === undefined) params.perPage = 100;

  const [result, stats] = await Promise.all([
    getServices({ ...params, ...(status && { status }) }),
    getServiceStats(),
  ]);

  const rows: ServiceListRow[] = result.data.map((s) => ({
    id: s.id,
    label: s.label,
    domain: s.domain,
    ipAddress: s.ipAddress,
    serverName: s.serverName,
    status: s.status,
    billingPeriod: s.billingPeriod,
    amount: Number(s.amount),
    nextDueDate: s.nextDueDate ? s.nextDueDate.toISOString() : null,
    suspendReason: s.suspendReason,
    createdAt: s.createdAt.toISOString(),
    customer: {
      id: s.customer.id,
      name: `${s.customer.name} ${s.customer.surname}`.trim(),
      email: s.customer.email,
    },
    product: {
      name: s.product.name,
      sku: s.product.sku,
      categorySlug: s.product.category?.slug ?? null,
      categoryName: s.product.category?.name ?? null,
    },
  }));

  return {
    rows,
    stats: {
      total: stats.total,
      active: stats.active,
      suspended: stats.suspended,
      cancelled: stats.cancelled,
      expired: stats.expired,
    },
    pagination: { page: result.page, totalPages: result.totalPages, total: result.total },
  };
}
