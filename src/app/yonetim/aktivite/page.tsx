import type { Metadata } from "next";
import {
  getActivityLogFilterOptions,
  getActivityLogs,
  getActivityLogStats,
  getActivityLogUsers,
} from "@/lib/dal/activity-logs";
import { hasPermission } from "@/lib/auth/permissions";
import { requireAnyPermission } from "@/lib/utils/auth-helpers";
import { parsePagination } from "@/lib/utils/pagination";
import { AktiviteContent } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Aktivite kayıtları" };

function readSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = searchParams[key];
  return typeof value === "string" ? value : undefined;
}

export default async function AktivitePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAnyPermission("activity.view", "activity.view_own");
  // Without activity.view (e.g. SUPPORT) only the staff member's own entries.
  const ownOnly = !hasPermission(session.user.role, "activity.view");
  const sp = await searchParams;
  const userIdFilter = ownOnly ? session.user.id : readSearchParam(sp, "userId");
  const parsed = parsePagination(sp);
  // 50 rows per server page unless ?perPage= is given.
  const pagination = { ...parsed, perPage: sp.perPage ? parsed.perPage : 50 };

  const [result, stats, filterOptions, activityUsers] = await Promise.all([
    getActivityLogs({
      ...pagination,
      userId: userIdFilter,
      entity: readSearchParam(sp, "entity"),
      action: readSearchParam(sp, "action"),
      dateFrom: readSearchParam(sp, "dateFrom"),
      dateTo: readSearchParam(sp, "dateTo"),
    }),
    getActivityLogStats(ownOnly ? session.user.id : undefined),
    getActivityLogFilterOptions(),
    ownOnly ? Promise.resolve([]) : getActivityLogUsers(),
  ]);

  return (
    <AktiviteContent
      data={result.data.map((log) => ({
        id: log.id,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        details: log.details,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt.toISOString(),
        user: log.user,
      }))}
      total={result.total}
      page={result.page}
      perPage={result.perPage}
      totalPages={result.totalPages}
      stats={stats}
      filterOptions={filterOptions}
      activityUsers={activityUsers}
      filters={{
        userId: userIdFilter ?? "",
        entity: readSearchParam(sp, "entity") ?? "",
        action: readSearchParam(sp, "action") ?? "",
        dateFrom: readSearchParam(sp, "dateFrom") ?? "",
        dateTo: readSearchParam(sp, "dateTo") ?? "",
        search: readSearchParam(sp, "search") ?? "",
      }}
    />
  );
}