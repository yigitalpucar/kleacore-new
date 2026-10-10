import type { ServiceStatus } from "@prisma/client";
import { getServices, getServiceStats } from "@/lib/dal/services";
import { parsePagination } from "@/lib/utils/pagination";
import { toServiceListRow, type ServiceListRow } from "./service-rows";

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

  const rows: ServiceListRow[] = result.data.map(toServiceListRow);

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
