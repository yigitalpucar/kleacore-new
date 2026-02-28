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
