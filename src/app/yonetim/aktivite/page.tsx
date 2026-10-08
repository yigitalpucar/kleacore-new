import type { Metadata } from "next";
import {
  getActivityLogFilterOptions,
  getActivityLogs,
  getActivityLogStats,
  getActivityLogUsers,
} from "@/lib/dal/activity-logs";
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
  const sp = await searchParams;
  const parsed = parsePagination(sp);
  // 50 rows per server page unless ?perPage= is given.
  const pagination = { ...parsed, perPage: sp.perPage ? parsed.perPage : 50 };

  const [result, stats, filterOptions, activityUsers] = await Promise.all([
    getActivityLogs({
      ...pagination,
      userId: readSearchParam(sp, "userId"),
      entity: readSearchParam(sp, "entity"),
      action: readSearchParam(sp, "action"),
      dateFrom: readSearchParam(sp, "dateFrom"),
      dateTo: readSearchParam(sp, "dateTo"),
    }),
    getActivityLogStats(),
    getActivityLogFilterOptions(),
    getActivityLogUsers(),
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
        userId: readSearchParam(sp, "userId") ?? "",
        entity: readSearchParam(sp, "entity") ?? "",
        action: readSearchParam(sp, "action") ?? "",
        dateFrom: readSearchParam(sp, "dateFrom") ?? "",
        dateTo: readSearchParam(sp, "dateTo") ?? "",
        search: readSearchParam(sp, "search") ?? "",
      }}
    />
  );
}