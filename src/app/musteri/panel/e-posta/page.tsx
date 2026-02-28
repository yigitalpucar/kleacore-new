import { auth } from "@/lib/auth";
import { getCustomerEmails, getCustomerEmailStats } from "@/lib/dal/emails";
import { getNotifications } from "@/lib/dal/notifications";
import { EPostaContent } from "./content";

function formatRelativeTime(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));

  if (minutes < 1) return "Az önce";
  if (minutes < 60) return `${minutes} dk önce`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} saat önce`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} gün önce`;

  return date.toLocaleDateString("tr-TR");
}

function formatDate(date: Date) {
  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const categoryMap = {
  BILLING: "billing",
  SUPPORT: "support",
  SYSTEM: "system",
  SERVICE: "service",
  SECURITY: "security",
  PROMOTION: "promotion",
} as const;

function resolveNotificationCategory(title: string, message: string) {
  const text = `${title} ${message}`.toLowerCase();
  if (text.includes("fatura") || text.includes("ödeme")) return "billing";
  if (text.includes("destek") || text.includes("talep")) return "support";
  if (
    text.includes("hizmet") ||
    text.includes("hosting") ||
    text.includes("sunucu") ||
    text.includes("domain")
  ) {
    return "service";
  }
  if (text.includes("güvenlik") || text.includes("şifre")) return "security";
  if (text.includes("kampanya") || text.includes("indirim")) return "promotion";
  return "system";
}

export default async function EPostaPage() {
  const session = await auth();
  const userId = session!.user.id;
  const [emails, stats] = await Promise.all([
    getCustomerEmails(userId),
    getCustomerEmailStats(userId),
  ]);

  let serializedEmails = emails.map((email) => ({
    id: email.id,
    subject: email.subject,
    category: categoryMap[email.category] ?? "system",
    preview: email.preview || email.content.slice(0, 140),
    sentAt: formatRelativeTime(email.sentAt),
    date: formatDate(email.sentAt),
    isRead: email.isRead,
  }));

  let serializedStats = stats;

  if (serializedEmails.length === 0) {
    const notifications = await getNotifications(userId);
    serializedEmails = notifications.map((notification) => ({
      id: notification.id,
      subject: notification.title,
      category: resolveNotificationCategory(
        notification.title,
        notification.message
      ),
      preview: notification.message,
      sentAt: formatRelativeTime(notification.createdAt),
      date: formatDate(notification.createdAt),
      isRead: notification.isRead,
    }));

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    serializedStats = {
      total: notifications.length,
      unread: notifications.filter((item) => !item.isRead).length,
      thisMonth: notifications.filter(
        (item) => item.createdAt.getTime() >= startOfMonth
      ).length,
    };
  }

  return (
    <EPostaContent
      emails={serializedEmails}
      stats={serializedStats}
    />
  );
}
