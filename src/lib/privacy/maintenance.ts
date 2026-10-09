import { db } from "@/lib/db";
import { formatDate } from "@/lib/format/date";
import { purgeExpiredExports } from "./export";
import { dataRequestTypeLabel } from "./labels";
import { cancelExpiredVerifications } from "./requests";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Panel sign-in history kept for one year (data minimisation; see report). */
export const LOGIN_EVENT_RETENTION_DAYS = 365;
/** Staff reminder when an open KVKK request is this close to its deadline. */
export const DEADLINE_WARNING_DAYS = 7;

/**
 * Daily KVKK / account-security housekeeping (cron "privacy-maintenance"):
 *  - unverified public requests past their link lifetime → CANCELLED;
 *  - stored exports whose link expired (or never sent within 30 days) → deleted;
 *  - expired / revoked trusted devices and old sign-in events → deleted;
 *  - staff reminder for open requests due within 7 days and when overdue
 *    (once per request and stage, deduplicated in NotificationLog).
 */
export async function runPrivacyMaintenance(now = new Date()) {
  const cancelled = await cancelExpiredVerifications(now);
  const exportsPurged = await purgeExpiredExports(now);
  const devices = await db.trustedDevice.deleteMany({
    where: { OR: [{ expiresAt: { lte: now } }, { revokedAt: { lte: new Date(now.getTime() - 30 * DAY_MS) } }] },
  });
  const logins = await db.loginEvent.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - LOGIN_EVENT_RETENTION_DAYS * DAY_MS) } },
  });
  const reminders = await sendDeadlineReminders(now);
  return {
    cancelledVerifications: cancelled,
    exportsPurged,
    trustedDevicesDeleted: devices.count,
    loginEventsDeleted: logins.count,
    deadlineReminders: reminders,
  };
}

async function sendDeadlineReminders(now: Date) {
  const due = await db.dataRequest.findMany({
    where: {
      status: { in: ["RECEIVED", "IN_PROGRESS"] },
      dueAt: { lte: new Date(now.getTime() + DEADLINE_WARNING_DAYS * DAY_MS) },
    },
    select: { id: true, requestNumber: true, type: true, name: true, dueAt: true },
    take: 100,
  });
  if (due.length === 0) return 0;

  const { getAdminNotificationRecipients } = await import("@/lib/provisioning/manual");
  const recipients = await getAdminNotificationRecipients();
  if (!recipients.email) return 0;

  const { sendNotification } = await import("@/lib/notifications/send");
  let sent = 0;
  for (const request of due) {
    if (!request.dueAt) continue;
    const overdue = request.dueAt.getTime() < now.getTime();
    const result = await sendNotification({
      template: "admin.event-alert",
      to: recipients.email,
      channel: "EMAIL",
      data: {
        title: overdue
          ? `KVKK başvurusunun süresi geçti: ${request.requestNumber}`
          : `KVKK başvurusu için son ${DEADLINE_WARNING_DAYS} gün: ${request.requestNumber}`,
        message: `${request.name} tarafından yapılan "${dataRequestTypeLabel(request.type)}" başvurusunun yasal yanıt süresi ${formatDate(request.dueAt)} tarihinde ${overdue ? "doldu" : "doluyor"}.`,
        details: [{ label: "Son tarih", value: formatDate(request.dueAt) }],
        path: `/yonetim/kvkk-talepleri/${request.id}`,
      },
      dedupeKey: `privacy.deadline:${request.id}:${overdue ? "overdue" : "soon"}`,
    });
    if (result.ok && !result.deduplicated) sent += 1;
  }
  return sent;
}
