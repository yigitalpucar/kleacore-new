import type { Broadcast, BroadcastRecipient, NotificationChannel, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { emitEvent } from "@/lib/events/emit";
import { createLogger } from "@/lib/logger";
import { loadRenderContext } from "@/lib/notifications/render";
import { sendNotification } from "@/lib/notifications/send";
import type { RenderContext } from "@/lib/notifications/templates/types";
import { buildAudienceWhere, parseAudience } from "./audience";
import { oneClickUnsubscribeUrl, unsubscribeUrl } from "./consent";
import { buildRecipientView, renderBroadcastContent } from "./content";
import { getRecipientCounts, syncRecipientsFromLogs } from "./progress";
import { getBroadcastRate } from "./settings";

/**
 * Broadcast delivery (roadmap Faz 4 — toplu duyurular).
 *
 *   startBroadcast  DRAFT → SCHEDULED (+ "broadcast.dispatch" job at scheduledAt)
 *   tick            SCHEDULED → SENDING: materialise recipients from the audience,
 *                   then every minute hand at most `rate` recipients to the
 *                   notification queue (one NotificationLog each), until none
 *                   are PENDING and none in flight → COMPLETED.
 *
 * Idempotency: a recipient is claimed (PENDING → QUEUED) in the same
 * transaction that writes its NotificationLog and queue job, and the log's
 * dedupe key is "broadcast:<id>:<recipientId>:<attempt>", so a retried or
 * duplicated tick never sends a message twice. Throttling: one batch per
 * minute, guarded by an atomic claim on Broadcast.lastBatchAt, so two ticks
 * running at once cannot double the rate.
 */

const log = createLogger("broadcasts");

export const BATCH_INTERVAL_MS = 60_000;
/** A broadcast with nothing pending but messages still QUEUED this long is closed anyway (queue lost them). */
const IN_FLIGHT_GRACE_MS = 6 * 60 * 60 * 1000;
const BUILD_PAGE = 1_000;

export const BROADCAST_TEMPLATE = { SERVICE: "broadcast.service", MARKETING: "broadcast.marketing" } as const;

export function recipientDedupeKey(broadcastId: string, recipient: Pick<BroadcastRecipient, "id" | "attempt">) {
  return `broadcast:${broadcastId}:${recipient.id}:${recipient.attempt}`;
}

/** Enqueues the next tick. Deduplicated per broadcast and minute; a queue outage is left to the jobs-drain sweep. */
export async function scheduleBroadcastTick(broadcastId: string, at?: Date) {
  try {
    const { enqueue } = await import("@/lib/jobs/enqueue");
    const { BROADCAST_DISPATCH_JOB } = await import("@/lib/jobs/definitions");
    const when = at && at.getTime() > Date.now() ? at : undefined;
    const bucket = Math.floor((when ?? new Date()).getTime() / BATCH_INTERVAL_MS);
    const result = await enqueue(
      BROADCAST_DISPATCH_JOB,
      { broadcastId },
      { singletonKey: `${broadcastId}:${bucket}`, ...(when ? { startAfter: when } : {}) }
    );
    return { queued: true, deduplicated: result.deduplicated };
  } catch (error) {
    log.warn("broadcast tick not queued; the jobs-drain sweep will pick it up", { broadcastId, error });
    return { queued: false, deduplicated: false };
  }
}

/** Creates the recipient rows from the audience (once per broadcast). */
export async function buildRecipients(broadcast: Broadcast, now = new Date()) {
  const filter = parseAudience(broadcast.audience);
  const where = buildAudienceWhere(filter, broadcast.kind);
  const channels = new Set<NotificationChannel>(broadcast.channels);
  const wantSms = channels.has("SMS") && Boolean(broadcast.smsText?.trim());

  return db.$transaction(
    async (tx) => {
      // Claim: only one builder per broadcast.
      const claim = await tx.broadcast.updateMany({
        where: { id: broadcast.id, recipientsBuiltAt: null },
        data: { recipientsBuiltAt: now },
      });
      if (claim.count === 0) return { built: false, total: broadcast.totalRecipients };

      let cursor: string | undefined;
      for (;;) {
        const users = await tx.user.findMany({
          where,
          select: { id: true, email: true, phone: true },
          orderBy: { id: "asc" },
          take: BUILD_PAGE,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        if (users.length === 0) break;
        cursor = users[users.length - 1].id;

        const rows: Prisma.BroadcastRecipientCreateManyInput[] = [];
        for (const user of users) {
          if (channels.has("EMAIL") && user.email) {
            rows.push({ broadcastId: broadcast.id, userId: user.id, channel: "EMAIL", to: user.email });
          }
          const phone = user.phone?.trim();
          if (wantSms && phone) {
            rows.push({ broadcastId: broadcast.id, userId: user.id, channel: "SMS", to: phone });
          }
        }
        if (rows.length) await tx.broadcastRecipient.createMany({ data: rows, skipDuplicates: true });
        if (users.length < BUILD_PAGE) break;
      }

      const total = await tx.broadcastRecipient.count({ where: { broadcastId: broadcast.id } });
      await tx.broadcast.update({ where: { id: broadcast.id }, data: { totalRecipients: total } });
      await emitEvent(tx, "broadcast.started", {
        broadcastId: broadcast.id,
        kind: broadcast.kind,
        subject: broadcast.subject,
        recipients: total,
      });
      return { built: true, total };
    },
    { timeout: 120_000 }
  );
}

type RecipientWithUser = BroadcastRecipient & {
  user: { id: string; name: string; surname: string; email: string; companyName: string | null; marketingConsent: boolean };
};

type DispatchOutcome = "queued" | "skipped" | "failed" | "not_claimed";

async function markRecipient(id: string, status: "SKIPPED" | "FAILED", error: string) {
  await db.broadcastRecipient.updateMany({ where: { id, status: "PENDING" }, data: { status, error: error.slice(0, 500) } });
}

/** Hands one recipient to the notification queue. Never sends twice (claim + dedupe key). */
export async function dispatchRecipient(
  broadcast: Broadcast,
  recipient: RecipientWithUser,
  ctx: RenderContext,
  now = new Date()
): Promise<DispatchOutcome> {
  const marketing = broadcast.kind === "MARKETING";
  // Opt-out is honoured up to the last moment (unsubscribed after the audience was built).
  if (marketing && !recipient.user.marketingConsent) {
    await markRecipient(recipient.id, "SKIPPED", "OPTED_OUT");
    return "skipped";
  }

  let rendered: ReturnType<typeof renderBroadcastContent>;
  try {
    rendered = renderBroadcastContent(broadcast, buildRecipientView(recipient.user, ctx));
  } catch (error) {
    await markRecipient(recipient.id, "FAILED", error instanceof Error ? error.message : "RENDER_FAILED");
    return "failed";
  }
  if (recipient.channel === "SMS" && !rendered.sms) {
    await markRecipient(recipient.id, "SKIPPED", "NO_SMS_TEXT");
    return "skipped";
  }

  const dedupeKey = recipientDedupeKey(broadcast.id, recipient);
  const data = {
    broadcastId: broadcast.id,
    subject: rendered.subject,
    bodyHtml: rendered.bodyHtml,
    bodyText: rendered.bodyText,
    ...(rendered.sms ? { sms: rendered.sms } : {}),
    ...(marketing
      ? { unsubscribeUrl: unsubscribeUrl(recipient.userId, ctx.baseUrl), oneClickUrl: oneClickUnsubscribeUrl(recipient.userId, ctx.baseUrl) }
      : {}),
  };

  try {
    return await db.$transaction(async (tx): Promise<DispatchOutcome> => {
      // The claim also checks the broadcast is still SENDING: a cancel wins.
      const claim = await tx.broadcastRecipient.updateMany({
        where: { id: recipient.id, status: "PENDING", broadcast: { status: "SENDING" } },
        data: { status: "QUEUED", queuedAt: now },
      });
      if (claim.count === 0) return "not_claimed";

      const result = await sendNotification({
        userId: recipient.userId,
        template: marketing ? BROADCAST_TEMPLATE.MARKETING : BROADCAST_TEMPLATE.SERVICE,
        data,
        channel: recipient.channel,
        ...(recipient.channel === "EMAIL" ? { to: recipient.to } : { phone: recipient.to }),
        dedupeKey,
        tx,
      });
      if (!result.ok) throw new Error(result.error ?? "NOTIFICATION_QUEUE_FAILED");

      let logId: string | undefined = result.logIds[0];
      if (!logId && result.deduplicated) {
        const existing = await tx.notificationLog.findFirst({ where: { dedupeKey, channel: recipient.channel }, select: { id: true } });
        logId = existing?.id;
      }
      if (!logId) {
        // SMS switched off / no provider, or no address: nothing to send.
        await tx.broadcastRecipient.update({
          where: { id: recipient.id },
          data: { status: "SKIPPED", error: recipient.channel === "SMS" ? "SMS_DISABLED" : "NO_ADDRESS" },
        });
        return "skipped";
      }
      await tx.broadcastRecipient.update({ where: { id: recipient.id }, data: { notificationLogId: logId } });
      return "queued";
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.warn("broadcast recipient could not be queued", { broadcastId: broadcast.id, recipientId: recipient.id, error: message });
    await markRecipient(recipient.id, "FAILED", message);
    return "failed";
  }
}

export interface TickResult {
  status: string;
  dispatched?: Record<DispatchOutcome, number>;
  next?: string | null;
}

async function completeBroadcast(broadcastId: string, now: Date) {
  const counts = await getRecipientCounts(broadcastId);
  await db.$transaction(async (tx) => {
    const { count } = await tx.broadcast.updateMany({
      where: { id: broadcastId, status: "SENDING" },
      data: { status: "COMPLETED", completedAt: now },
    });
    if (count === 0) return;
    await emitEvent(tx, "broadcast.completed", {
      broadcastId,
      sent: counts.SENT,
      failed: counts.FAILED,
      skipped: counts.SKIPPED,
    });
  });
}

/**
 * One tick of the "broadcast.dispatch" job. Safe to run any number of times
 * concurrently; at most one batch per minute is dispatched.
 */
export async function runBroadcastTick(
  broadcastId: string,
  options: { now?: Date; schedule?: (broadcastId: string, at?: Date) => Promise<unknown> } = {}
): Promise<TickResult> {
  const now = options.now ?? new Date();
  const schedule = options.schedule ?? scheduleBroadcastTick;

  let broadcast = await db.broadcast.findUnique({ where: { id: broadcastId } });
  if (!broadcast) return { status: "NOT_FOUND" };

  if (broadcast.status === "SCHEDULED") {
    if (broadcast.scheduledAt && broadcast.scheduledAt.getTime() > now.getTime()) {
      await schedule(broadcastId, broadcast.scheduledAt);
      return { status: "WAITING", next: broadcast.scheduledAt.toISOString() };
    }
    await db.broadcast.updateMany({ where: { id: broadcastId, status: "SCHEDULED" }, data: { status: "SENDING", startedAt: now } });
    broadcast = await db.broadcast.findUniqueOrThrow({ where: { id: broadcastId } });
  }
  if (broadcast.status !== "SENDING") return { status: broadcast.status };

  if (!broadcast.recipientsBuiltAt) {
    await buildRecipients(broadcast, now);
  }

  // Throttle: claim this minute's batch slot.
  const slotFrom = new Date(now.getTime() - BATCH_INTERVAL_MS);
  const slot = await db.broadcast.updateMany({
    where: { id: broadcastId, status: "SENDING", OR: [{ lastBatchAt: null }, { lastBatchAt: { lte: slotFrom } }] },
    data: { lastBatchAt: now },
  });
  if (slot.count === 0) {
    const current = await db.broadcast.findUnique({ where: { id: broadcastId }, select: { status: true, lastBatchAt: true } });
    if (current?.status !== "SENDING") return { status: current?.status ?? "NOT_FOUND" };
    const next = new Date((current.lastBatchAt?.getTime() ?? now.getTime()) + BATCH_INTERVAL_MS);
    await schedule(broadcastId, next);
    return { status: "THROTTLED", next: next.toISOString() };
  }

  const rate = await getBroadcastRate();
  const recipients = await db.broadcastRecipient.findMany({
    where: { broadcastId, status: "PENDING" },
    orderBy: { id: "asc" },
    take: rate,
    include: {
      user: { select: { id: true, name: true, surname: true, email: true, companyName: true, marketingConsent: true } },
    },
  });

  const dispatched: Record<DispatchOutcome, number> = { queued: 0, skipped: 0, failed: 0, not_claimed: 0 };
  if (recipients.length) {
    const ctx = await loadRenderContext();
    for (const recipient of recipients) {
      const outcome = await dispatchRecipient(broadcast, recipient, ctx, now);
      dispatched[outcome] += 1;
      // A cancel mid-batch: the remaining claims would all fail; stop early.
      if (outcome === "not_claimed") {
        const state = await db.broadcast.findUnique({ where: { id: broadcastId }, select: { status: true } });
        if (state?.status !== "SENDING") return { status: state?.status ?? "NOT_FOUND", dispatched };
      }
    }
  }

  await syncRecipientsFromLogs(broadcastId);
  const [pending, inFlight] = await Promise.all([
    db.broadcastRecipient.count({ where: { broadcastId, status: "PENDING" } }),
    db.broadcastRecipient.findFirst({
      where: { broadcastId, status: "QUEUED" },
      orderBy: { queuedAt: "desc" },
      select: { queuedAt: true },
    }),
  ]);

  const stale = inFlight?.queuedAt ? now.getTime() - inFlight.queuedAt.getTime() > IN_FLIGHT_GRACE_MS : false;
  if (pending === 0 && (!inFlight || stale)) {
    await completeBroadcast(broadcastId, now);
    return { status: "COMPLETED", dispatched, next: null };
  }

  const next = new Date(now.getTime() + BATCH_INTERVAL_MS);
  await schedule(broadcastId, next);
  return { status: "SENDING", dispatched, next: next.toISOString() };
}

/** DRAFT → SCHEDULED; `scheduledAt` null = now. */
export async function startBroadcast(broadcastId: string, scheduledAt: Date | null) {
  const { count } = await db.broadcast.updateMany({
    where: { id: broadcastId, status: "DRAFT" },
    data: { status: "SCHEDULED", scheduledAt },
  });
  if (count === 0) throw new Error("BROADCAST_NOT_DRAFT");
  await scheduleBroadcastTick(broadcastId, scheduledAt ?? undefined);
}

/**
 * Stops a scheduled or running broadcast: pending recipients are cancelled,
 * and messages already queued but not yet sent are skipped (the worker
 * treats a SKIPPED log as final). Messages already handed to SMTP / the SMS
 * provider cannot be recalled.
 */
export async function cancelBroadcast(broadcastId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const { count } = await tx.broadcast.updateMany({
      where: { id: broadcastId, status: { in: ["DRAFT", "SCHEDULED", "SENDING"] } },
      data: { status: "CANCELLED", cancelledAt: now },
    });
    if (count === 0) throw new Error("BROADCAST_NOT_CANCELLABLE");

    const pending = await tx.broadcastRecipient.updateMany({
      where: { broadcastId, status: "PENDING" },
      data: { status: "CANCELLED", error: "CANCELLED" },
    });

    const queued = await tx.broadcastRecipient.findMany({
      where: { broadcastId, status: "QUEUED", notificationLogId: { not: null } },
      select: { notificationLogId: true },
    });
    let recalled = 0;
    const logIds = queued.map((row) => row.notificationLogId!).filter(Boolean);
    if (logIds.length) {
      const skipped = await tx.notificationLog.updateManyAndReturn({
        where: { id: { in: logIds }, status: "QUEUED" },
        data: { status: "SKIPPED", error: "BROADCAST_CANCELLED" },
        select: { id: true },
      });
      if (skipped.length) {
        const result = await tx.broadcastRecipient.updateMany({
          where: { broadcastId, notificationLogId: { in: skipped.map((row) => row.id) } },
          data: { status: "CANCELLED", error: "CANCELLED" },
        });
        recalled = result.count;
      }
    }

    await emitEvent(tx, "broadcast.cancelled", { broadcastId, cancelledRecipients: pending.count + recalled });
    return { cancelled: pending.count + recalled };
  });
}

/** FAILED recipients → PENDING with a new attempt number (new dedupe key), broadcast back to SENDING. */
export async function resendFailedRecipients(broadcastId: string) {
  const result = await db.$transaction(async (tx) => {
    const broadcast = await tx.broadcast.findUnique({ where: { id: broadcastId }, select: { status: true } });
    if (!broadcast) throw new Error("BROADCAST_NOT_FOUND");
    if (broadcast.status !== "COMPLETED" && broadcast.status !== "SENDING") throw new Error("BROADCAST_NOT_RESENDABLE");

    const { count } = await tx.broadcastRecipient.updateMany({
      where: { broadcastId, status: "FAILED" },
      data: { status: "PENDING", attempt: { increment: 1 }, notificationLogId: null, error: null, queuedAt: null, sentAt: null },
    });
    if (count === 0) throw new Error("NO_FAILED_RECIPIENTS");
    await tx.broadcast.update({ where: { id: broadcastId }, data: { status: "SENDING", completedAt: null } });
    return { requeued: count };
  });
  await scheduleBroadcastTick(broadcastId);
  return result;
}

/**
 * jobs-drain safety net: due scheduled broadcasts and running ones whose
 * tick was lost (queue down when it should have been enqueued).
 */
export async function sweepBroadcasts(now = new Date()) {
  const staleBefore = new Date(now.getTime() - 3 * BATCH_INTERVAL_MS);
  const rows = await db.broadcast.findMany({
    where: {
      OR: [
        { status: "SCHEDULED", OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }], updatedAt: { lte: staleBefore } },
        { status: "SENDING", OR: [{ lastBatchAt: null }, { lastBatchAt: { lte: staleBefore } }], updatedAt: { lte: staleBefore } },
      ],
    },
    select: { id: true },
    take: 20,
  });
  let queued = 0;
  for (const row of rows) {
    const result = await scheduleBroadcastTick(row.id);
    if (result.queued && !result.deduplicated) queued += 1;
  }
  return { checked: rows.length, queued };
}
