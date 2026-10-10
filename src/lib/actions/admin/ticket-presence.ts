"use server";

/**
 * Ticket collision warning (UI3 item 13): a staff member's ticket page
 * pings every ~15 s; the answer lists the other staff on the same ticket
 * (and whether they are typing). Stale rows are removed on each ping, and
 * the page removes its own row when it closes.
 */
import { db } from "@/lib/db";
import { PRESENCE_STALE_MS, activeViewers, shortName, type PresenceViewer } from "@/lib/support/presence";
import { requirePermission } from "@/lib/utils/auth-helpers";

export async function pingTicketPresence(ticketId: string, typing: boolean): Promise<{ viewers: PresenceViewer[] }> {
  const session = await requirePermission("tickets.view");
  if (typeof ticketId !== "string" || !ticketId || ticketId.length > 64) return { viewers: [] };
  const now = new Date();
  const userId = session.user.id;

  const ticket = await db.supportTicket.findUnique({ where: { id: ticketId }, select: { id: true } });
  if (!ticket) return { viewers: [] };

  await db.$transaction([
    db.ticketPresence.deleteMany({ where: { lastSeenAt: { lt: new Date(now.getTime() - PRESENCE_STALE_MS) } } }),
    db.ticketPresence.upsert({
      where: { ticketId_userId: { ticketId, userId } },
      create: { ticketId, userId, lastSeenAt: now, typingAt: typing ? now : null },
      // Keep the last typing time when this beat is not a typing one.
      update: { lastSeenAt: now, ...(typing ? { typingAt: now } : {}) },
    }),
  ]);

  const rows = await db.ticketPresence.findMany({
    where: { ticketId, userId: { not: userId } },
    select: { userId: true, lastSeenAt: true, typingAt: true, user: { select: { name: true, surname: true } } },
  });
  return {
    viewers: activeViewers(
      rows.map((r) => ({ userId: r.userId, name: shortName(r.user.name, r.user.surname), lastSeenAt: r.lastSeenAt, typingAt: r.typingAt })),
      userId,
      now
    ),
  };
}

export async function leaveTicketPresence(ticketId: string): Promise<void> {
  const session = await requirePermission("tickets.view");
  if (typeof ticketId !== "string" || !ticketId) return;
  await db.ticketPresence.deleteMany({ where: { ticketId, userId: session.user.id } });
}
