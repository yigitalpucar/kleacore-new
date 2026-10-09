import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BroadcastDetail } from "@/components/admin/broadcasts/broadcast-detail";
import { describeAudience, parseAudience } from "@/lib/broadcasts/audience";
import { unsubscribeUrl } from "@/lib/broadcasts/consent";
import { buildRecipientView, renderBroadcastContent } from "@/lib/broadcasts/content";
import { BROADCAST_TEMPLATE } from "@/lib/broadcasts/dispatch";
import { getRecipientCounts, syncRecipientsFromLogs } from "@/lib/broadcasts/progress";
import { db } from "@/lib/db";
import { loadRenderContext, renderNotification } from "@/lib/notifications/render";
import { requirePermission } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Duyuru" };

const RECIPIENT_LIMIT = 300;

export default async function DuyuruPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission("broadcast.send");
  const { id } = await params;
  const broadcast = await db.broadcast.findUnique({ where: { id } });
  if (!broadcast) notFound();

  if (broadcast.status === "SENDING") await syncRecipientsFromLogs(id);

  const filter = (() => {
    try {
      return parseAudience(broadcast.audience);
    } catch {
      return null;
    }
  })();

  const [counts, recipients, createdBy, incident, me, products, categories, instances] = await Promise.all([
    getRecipientCounts(id),
    db.broadcastRecipient.findMany({
      where: { broadcastId: id },
      orderBy: { updatedAt: "desc" },
      take: RECIPIENT_LIMIT,
      select: {
        id: true,
        channel: true,
        to: true,
        status: true,
        error: true,
        attempt: true,
        sentAt: true,
        updatedAt: true,
        notificationLogId: true,
        user: { select: { id: true, name: true, surname: true, email: true } },
      },
    }),
    broadcast.createdById
      ? db.user.findUnique({ where: { id: broadcast.createdById }, select: { name: true, surname: true, email: true } })
      : null,
    broadcast.incidentId ? db.systemIncident.findUnique({ where: { id: broadcast.incidentId }, select: { id: true, title: true } }) : null,
    db.user.findUniqueOrThrow({ where: { id: session.user.id }, select: { id: true, name: true, surname: true, email: true, companyName: true } }),
    db.product.findMany({ select: { id: true, name: true } }),
    db.productCategory.findMany({ select: { id: true, name: true } }),
    db.moduleInstance.findMany({ where: { kind: "server" }, select: { id: true, label: true } }),
  ]);

  const ctx = await loadRenderContext();
  let preview: { subject: string; html: string; sms: string | null } | null = null;
  try {
    const rendered = renderBroadcastContent(broadcast, buildRecipientView(me, ctx));
    const marketing = broadcast.kind === "MARKETING";
    const email = renderNotification(
      marketing ? BROADCAST_TEMPLATE.MARKETING : BROADCAST_TEMPLATE.SERVICE,
      {
        broadcastId: broadcast.id,
        subject: rendered.subject,
        bodyHtml: rendered.bodyHtml,
        bodyText: rendered.bodyText,
        ...(rendered.sms ? { sms: rendered.sms } : {}),
        ...(marketing ? { unsubscribeUrl: unsubscribeUrl(me.id, ctx.baseUrl) } : {}),
      },
      ctx,
      { logo: "inline" }
    );
    preview = { subject: email.subject, html: email.html, sms: rendered.sms };
  } catch {
    preview = null;
  }

  return (
    <BroadcastDetail
      broadcast={{
        id: broadcast.id,
        kind: broadcast.kind,
        subject: broadcast.subject,
        channels: broadcast.channels,
        status: broadcast.status,
        audience: filter
          ? describeAudience(filter, {
              products: new Map(products.map((row) => [row.id, row.name])),
              categories: new Map(categories.map((row) => [row.id, row.name])),
              instances: new Map(instances.map((row) => [row.id, row.label])),
            })
          : "—",
        scheduledAt: broadcast.scheduledAt?.toISOString() ?? null,
        startedAt: broadcast.startedAt?.toISOString() ?? null,
        completedAt: broadcast.completedAt?.toISOString() ?? null,
        cancelledAt: broadcast.cancelledAt?.toISOString() ?? null,
        createdAt: broadcast.createdAt.toISOString(),
        createdBy: createdBy ? `${createdBy.name} ${createdBy.surname}`.trim() || createdBy.email : "—",
        incident: incident ? { id: incident.id, title: incident.title } : null,
      }}
      counts={counts}
      preview={preview}
      recipients={recipients.map((row) => ({
        id: row.id,
        channel: row.channel,
        to: row.to,
        status: row.status,
        error: row.error,
        attempt: row.attempt,
        sentAt: row.sentAt?.toISOString() ?? null,
        updatedAt: row.updatedAt.toISOString(),
        notificationLogId: row.notificationLogId,
        customer: { id: row.user.id, name: `${row.user.name} ${row.user.surname}`.trim() || row.user.email },
      }))}
      recipientLimit={RECIPIENT_LIMIT}
    />
  );
}
