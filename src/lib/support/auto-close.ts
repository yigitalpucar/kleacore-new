import { db } from "@/lib/db";
import { emitEvent } from "@/lib/events/emit";
import { createLogger } from "@/lib/logger";
import { sendNotification } from "@/lib/notifications/send";
import { getAutoCloseDays } from "./settings";
import { AWAITING_CUSTOMER_STATUSES, statusChange, supportReplyAddress } from "./tickets";

const log = createLogger("support.auto-close");

const DAY_MS = 24 * 60 * 60 * 1000;
/** The warning goes out at least this long before the close (even if the cron missed runs). */
const MIN_WARNING_LEAD_MS = DAY_MS;
const BATCH = 200;

export const AUTO_CLOSE_MESSAGE = (days: number) =>
  `Bu talep, ${days} gün boyunca yanıt alınamadığı için otomatik olarak kapatıldı. Sorununuz devam ediyorsa talebi yeniden açabilir veya yanıt yazabilirsiniz.`;

/**
 * Hourly cron (`support-autoclose`). Tickets waiting on the customer
 * (ADMIN_REPLY / WAITING, clock = waitingSince):
 *  1. at days-1: warning mail, once per waiting period (autoCloseWarnedAt claim + dedupe key);
 *  2. at days, and ≥ 24h after the warning: CLOSED with a system message.
 * Both steps claim rows with a conditional update, so overlapping or
 * repeated runs never warn or close twice.
 */
export async function runTicketAutoClose(now = new Date(), daysOverride?: number) {
  const days = daysOverride ?? (await getAutoCloseDays());
  if (days <= 0) return { processed: 0, warned: 0, closed: 0, disabled: true };

  const warnBefore = new Date(now.getTime() - (days - 1) * DAY_MS);
  const closeBefore = new Date(now.getTime() - days * DAY_MS);
  const warnedBefore = new Date(now.getTime() - MIN_WARNING_LEAD_MS);

  let warned = 0;
  const toWarn = await db.supportTicket.findMany({
    where: { status: { in: AWAITING_CUSTOMER_STATUSES }, waitingSince: { lte: warnBefore }, autoCloseWarnedAt: null },
    select: {
      id: true,
      ticketNumber: true,
      subject: true,
      department: true,
      customerId: true,
      guestEmail: true,
      guestName: true,
      waitingSince: true,
    },
    orderBy: { waitingSince: "asc" },
    take: BATCH,
  });

  for (const ticket of toWarn) {
    if (!ticket.waitingSince) continue;
    const closesAt = new Date(Math.max(ticket.waitingSince.getTime() + days * DAY_MS, now.getTime() + MIN_WARNING_LEAD_MS));
    const replyTo = await supportReplyAddress(ticket.department).catch(() => undefined);
    const claimed = await db.$transaction(async (tx) => {
      const claim = await tx.supportTicket.updateMany({
        where: { id: ticket.id, autoCloseWarnedAt: null, waitingSince: ticket.waitingSince, status: { in: AWAITING_CUSTOMER_STATUSES } },
        data: { autoCloseWarnedAt: now },
      });
      if (claim.count === 0) return false;
      if (ticket.customerId || ticket.guestEmail) {
        await sendNotification({
          tx,
          userId: ticket.customerId,
          to: ticket.customerId ? undefined : ticket.guestEmail ?? undefined,
          template: "support.ticket-auto-close-warning",
          channel: "EMAIL",
          dedupeKey: `ticket.auto-close-warning:${ticket.id}:${ticket.waitingSince!.toISOString()}`,
          data: {
            ticketId: ticket.id,
            ticketNumber: ticket.ticketNumber,
            ticketSubject: ticket.subject,
            closesAt,
            hasAccount: !!ticket.customerId,
            ...(ticket.customerId ? {} : { recipientName: ticket.guestName ?? undefined }),
            ...(replyTo ? { replyTo } : {}),
          },
        });
      }
      await emitEvent(tx, "ticket.auto_close_warning", { ticketId: ticket.id, closesAt: closesAt.toISOString() });
      return true;
    });
    if (claimed) warned++;
  }

  let closed = 0;
  const toClose = await db.supportTicket.findMany({
    where: {
      status: { in: AWAITING_CUSTOMER_STATUSES },
      waitingSince: { lte: closeBefore },
      autoCloseWarnedAt: { lte: warnedBefore },
    },
    select: { id: true, waitingSince: true },
    orderBy: { waitingSince: "asc" },
    take: BATCH,
  });

  for (const ticket of toClose) {
    const done = await db.$transaction(async (tx) => {
      const claim = await tx.supportTicket.updateMany({
        where: { id: ticket.id, waitingSince: ticket.waitingSince, status: { in: AWAITING_CUSTOMER_STATUSES } },
        data: statusChange("CLOSED", now),
      });
      if (claim.count === 0) return false;
      await tx.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          senderId: "system",
          senderName: "Sistem",
          senderRole: "ADMIN",
          message: AUTO_CLOSE_MESSAGE(days),
        },
      });
      await emitEvent(tx, "ticket.closed", { ticketId: ticket.id, reason: "auto" });
      return true;
    });
    if (done) closed++;
  }

  if (warned || closed) log.info("ticket auto-close", { warned, closed, days });
  return { processed: warned + closed, warned, closed, ids: toClose.map((t) => t.id) };
}
