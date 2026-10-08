import type { NotificationChannel, NotificationLogStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export const NOTIFICATION_STATUSES: NotificationLogStatus[] = ["QUEUED", "SENT", "FAILED", "SKIPPED"];
export const NOTIFICATION_CHANNELS: NotificationChannel[] = ["EMAIL", "SMS"];

export interface NotificationLogFilters {
  page: number;
  perPage: number;
  status?: string;
  channel?: string;
  template?: string;
  search?: string;
}

function buildWhere(filters: NotificationLogFilters): Prisma.NotificationLogWhereInput {
  const where: Prisma.NotificationLogWhereInput = {};
  if (filters.status && NOTIFICATION_STATUSES.includes(filters.status as NotificationLogStatus)) {
    where.status = filters.status as NotificationLogStatus;
  }
  if (filters.channel && NOTIFICATION_CHANNELS.includes(filters.channel as NotificationChannel)) {
    where.channel = filters.channel as NotificationChannel;
  }
  if (filters.template) where.template = filters.template;
  const search = filters.search?.trim();
  if (search) {
    where.OR = [
      { to: { contains: search, mode: "insensitive" } },
      { subject: { contains: search, mode: "insensitive" } },
      { user: { email: { contains: search, mode: "insensitive" } } },
    ];
  }
  return where;
}

/** Admin log list (/yonetim/bildirimler). `data` is never selected: it may hold encrypted secrets. */
export async function getNotificationLogs(filters: NotificationLogFilters) {
  const where = buildWhere(filters);
  const [rows, total] = await Promise.all([
    db.notificationLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.perPage,
      take: filters.perPage,
      select: {
        id: true,
        template: true,
        channel: true,
        to: true,
        subject: true,
        status: true,
        error: true,
        attempts: true,
        redacted: true,
        resendOfId: true,
        providerMessageId: true,
        createdAt: true,
        sentAt: true,
        user: { select: { id: true, name: true, surname: true, email: true } },
      },
    }),
    db.notificationLog.count({ where }),
  ]);
  return { rows, total, page: filters.page, perPage: filters.perPage, totalPages: Math.max(1, Math.ceil(total / filters.perPage)) };
}

export async function getNotificationLogStats(now = new Date()) {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const grouped = await db.notificationLog.groupBy({
    by: ["status"],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
  });
  const count = (status: NotificationLogStatus) => grouped.find((row) => row.status === status)?._count._all ?? 0;
  const queuedTotal = await db.notificationLog.count({ where: { status: "QUEUED" } });
  return {
    sent24h: count("SENT"),
    failed24h: count("FAILED"),
    skipped24h: count("SKIPPED"),
    queued: queuedTotal,
  };
}

export async function getNotificationLogById(id: string) {
  return db.notificationLog.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, surname: true, email: true } } },
  });
}
