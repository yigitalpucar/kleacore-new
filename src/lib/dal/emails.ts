import { db } from "@/lib/db";

export async function getCustomerEmails(customerId: string) {
  return db.emailMessage.findMany({
    where: { customerId },
    orderBy: { sentAt: "desc" },
    take: 200,
  });
}

export async function getCustomerEmailStats(customerId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [total, unread, thisMonth] = await Promise.all([
    db.emailMessage.count({
      where: { customerId },
    }),
    db.emailMessage.count({
      where: { customerId, isRead: false },
    }),
    db.emailMessage.count({
      where: {
        customerId,
        sentAt: { gte: startOfMonth },
      },
    }),
  ]);

  return { total, unread, thisMonth };
}
