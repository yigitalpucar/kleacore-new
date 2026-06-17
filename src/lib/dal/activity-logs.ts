import { db } from "@/lib/db";
import {
  type PaginationParams,
  paginationMeta,
} from "@/lib/utils/pagination";

export interface GetActivityLogsParams extends PaginationParams {
  userId?: string;
  entity?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function getActivityLogs(params: GetActivityLogsParams) {
  const {
    page,
    perPage,
    search,
    sortBy,
    sortOrder,
    userId,
    entity,
    action,
    dateFrom,
    dateTo,
  } = params;

  const createdAtFilter: { gte?: Date; lte?: Date } = {};
  if (dateFrom) {
    createdAtFilter.gte = new Date(dateFrom);
  }
  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    createdAtFilter.lte = end;
  }

  const where = {
    ...(userId && { userId }),
    ...(entity && { entity }),
    ...(action && { action }),
    ...(Object.keys(createdAtFilter).length > 0 && { createdAt: createdAtFilter }),
    ...(search && {
      OR: [
        { action: { contains: search, mode: "insensitive" as const } },
        { entity: { contains: search, mode: "insensitive" as const } },
        { entityId: { contains: search, mode: "insensitive" as const } },
        { ipAddress: { contains: search, mode: "insensitive" as const } },
        {
          user: {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { surname: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          },
        },
      ],
    }),
  };

  const orderByField = sortBy === "action" || sortBy === "entity" ? sortBy : "createdAt";

  const [data, total] = await Promise.all([
    db.activityLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            surname: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { [orderByField]: sortOrder || "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.activityLog.count({ where }),
  ]);

  return { data, ...paginationMeta(total, params) };
}

export async function getActivityLogStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [total, todayCount, adminCount, customerCount] = await Promise.all([
    db.activityLog.count(),
    db.activityLog.count({
      where: { createdAt: { gte: today } },
    }),
    db.activityLog.count({
      where: { user: { role: "ADMIN" } },
    }),
    db.activityLog.count({
      where: { user: { role: "CUSTOMER" } },
    }),
  ]);

  return { total, todayCount, adminCount, customerCount };
}

export async function getActivityLogUsers() {
  const logs = await db.activityLog.findMany({
    distinct: ["userId"],
    select: {
      user: {
        select: {
          id: true,
          name: true,
          surname: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return logs.map((log) => log.user);
}

export async function getActivityLogFilterOptions() {
  const [entities, actions] = await Promise.all([
    db.activityLog.findMany({
      distinct: ["entity"],
      select: { entity: true },
      orderBy: { entity: "asc" },
    }),
    db.activityLog.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
  ]);

  return {
    entities: entities.map((item) => item.entity),
    actions: actions.map((item) => item.action),
  };
}