import { db } from "@/lib/db";

export async function getNotifications(userId: string) {
  return db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function getUnreadCount(userId: string) {
  return db.notification.count({
    where: { userId, isRead: false },
  });
}

/** Bell payload: latest items as plain JSON + the unread total. Always scoped to `userId`. */
export async function getBellNotifications(userId: string, take = 15) {
  const [rows, unread] = await Promise.all([
    db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, title: true, message: true, createdAt: true, isRead: true, link: true, type: true },
    }),
    getUnreadCount(userId),
  ]);
  return {
    items: rows.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
    unread,
  };
}

/**
 * Marks the user's own notifications read: `ids` (others' ids are ignored by
 * the userId filter) or everything when `all`. Returns the rows changed.
 */
export async function markNotificationsRead(userId: string, target: { ids: string[] } | { all: true }, now = new Date()) {
  const where =
    "all" in target
      ? { userId, isRead: false }
      : { userId, isRead: false, id: { in: target.ids.slice(0, 100) } };
  const result = await db.notification.updateMany({ where, data: { isRead: true, readAt: now } });
  return result.count;
}
