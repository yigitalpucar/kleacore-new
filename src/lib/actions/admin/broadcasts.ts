"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity-log";
import { hasPermission } from "@/lib/auth/permissions";
import { parseAudience, previewAudience, type AudiencePreview } from "@/lib/broadcasts/audience";
import { oneClickUnsubscribeUrl, unsubscribeUrl } from "@/lib/broadcasts/consent";
import { buildRecipientView, renderBroadcastContent } from "@/lib/broadcasts/content";
import {
  BROADCAST_TEMPLATE,
  cancelBroadcast,
  resendFailedRecipients,
  startBroadcast,
} from "@/lib/broadcasts/dispatch";
import {
  broadcastInputSchema,
  firstError,
  startOptionsSchema,
  type BroadcastInput,
  type StartOptions,
} from "@/lib/broadcasts/input";
import { getRecipientCounts, syncRecipientsFromLogs, type RecipientCounts } from "@/lib/broadcasts/progress";
import { setBroadcastRate } from "@/lib/broadcasts/settings";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { loadRenderContext, renderNotification } from "@/lib/notifications/render";
import { sendNotification } from "@/lib/notifications/send";
import { smsLength, type SmsLength } from "@/lib/notifications/sms-length";
import { requirePermission } from "@/lib/utils/auth-helpers";
import { createIncident, scheduleComponentMaintenance } from "./system-status";

const log = createLogger("admin.broadcasts");

type Failure = { success: false; error: string };
type Result<T = undefined> = ({ success: true } & (T extends undefined ? object : { data: T })) | Failure;

function revalidate(id?: string) {
  revalidatePath("/yonetim/duyurular");
  if (id) revalidatePath(`/yonetim/duyurular/${id}`);
}

async function audit(userId: string, action: string, entityId: string, details?: Record<string, string>) {
  try {
    await logActivity({ userId, action, entity: "Broadcast", entityId, details });
  } catch {
    // best effort
  }
}

const ERRORS: Record<string, string> = {
  BROADCAST_NOT_DRAFT: "Bu duyuru taslak değil; yeniden başlatılamaz.",
  BROADCAST_NOT_CANCELLABLE: "Bu duyuru artık iptal edilemez.",
  BROADCAST_NOT_RESENDABLE: "Yeniden gönderim yalnızca gönderimi süren veya tamamlanan duyurularda yapılabilir.",
  NO_FAILED_RECIPIENTS: "Başarısız alıcı yok.",
  BROADCAST_NOT_FOUND: "Duyuru bulunamadı.",
};

function failure(error: unknown, fallback: string): Failure {
  if (error instanceof Error && ERRORS[error.message]) return { success: false, error: ERRORS[error.message] };
  log.error(fallback, { error });
  return { success: false, error: fallback };
}

/** Recipient count + sample for the audience builder. */
export async function previewBroadcastAudienceAction(
  kind: "SERVICE" | "MARKETING",
  audience: unknown
): Promise<Result<AudiencePreview>> {
  await requirePermission("broadcast.send");
  try {
    const filter = parseAudience(audience);
    return { success: true, data: await previewAudience(filter, kind === "MARKETING" ? "MARKETING" : "SERVICE") };
  } catch (error) {
    return failure(error, "Alıcı listesi hesaplanamadı");
  }
}

/** E-mail / SMS preview rendered for the signed-in staff member. */
export async function previewBroadcastContentAction(
  input: BroadcastInput
): Promise<Result<{ subject: string; html: string; text: string; sms: string | null; smsInfo: SmsLength | null }>> {
  const session = await requirePermission("broadcast.send");
  const parsed = broadcastInputSchema.safeParse(input);
  if (!parsed.success) {
    // Audience / channel problems don't matter for a preview; content errors do.
    const contentIssue = parsed.error.errors.find((issue) => ["subject", "bodyHtml", "bodyText", "smsText"].includes(String(issue.path[0])));
    if (contentIssue) return { success: false, error: contentIssue.message };
  }
  try {
    const me = await db.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { id: true, name: true, surname: true, email: true, companyName: true },
    });
    const ctx = await loadRenderContext();
    const content = {
      subject: input.subject || "(konu)",
      bodyHtml: input.bodyHtml || "<p></p>",
      bodyText: input.bodyText ?? "",
      smsText: input.smsText ?? "",
    };
    const rendered = renderBroadcastContent(content, buildRecipientView(me, ctx));
    const marketing = input.kind === "MARKETING";
    const email = renderNotification(
      marketing ? BROADCAST_TEMPLATE.MARKETING : BROADCAST_TEMPLATE.SERVICE,
      {
        broadcastId: "onizleme",
        subject: rendered.subject || "(konu)",
        bodyHtml: rendered.bodyHtml,
        bodyText: rendered.bodyText,
        ...(rendered.sms ? { sms: rendered.sms } : {}),
        ...(marketing ? { unsubscribeUrl: unsubscribeUrl(me.id, ctx.baseUrl) } : {}),
      },
      ctx,
      { logo: "inline" }
    );
    return {
      success: true,
      data: {
        subject: email.subject,
        html: email.html,
        text: email.text,
        sms: rendered.sms,
        smsInfo: rendered.sms ? smsLength(rendered.sms) : null,
      },
    };
  } catch (error) {
    return failure(error, "Önizleme oluşturulamadı");
  }
}

/** Sends the draft to the signed-in staff member only (e-mail, and SMS when chosen and a phone is on file). */
export async function sendBroadcastTestAction(input: BroadcastInput): Promise<Result<{ channels: string[] }>> {
  const session = await requirePermission("broadcast.send");
  const parsed = broadcastInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: firstError(parsed.error) };
  try {
    const me = await db.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { id: true, name: true, surname: true, email: true, phone: true, companyName: true },
    });
    const ctx = await loadRenderContext();
    const rendered = renderBroadcastContent(parsed.data, buildRecipientView(me, ctx));
    const marketing = parsed.data.kind === "MARKETING";
    const data = {
      broadcastId: "test",
      subject: `[TEST] ${rendered.subject}`,
      bodyHtml: rendered.bodyHtml,
      bodyText: rendered.bodyText,
      ...(rendered.sms ? { sms: rendered.sms } : {}),
      ...(marketing ? { unsubscribeUrl: unsubscribeUrl(me.id, ctx.baseUrl), oneClickUrl: oneClickUnsubscribeUrl(me.id, ctx.baseUrl) } : {}),
    };
    const template = marketing ? BROADCAST_TEMPLATE.MARKETING : BROADCAST_TEMPLATE.SERVICE;
    const sent: string[] = [];
    if (parsed.data.channels.includes("EMAIL")) {
      const result = await sendNotification({ userId: me.id, template, data, channel: "EMAIL", to: me.email });
      if (!result.ok) return { success: false, error: "Test e-postası kuyruğa alınamadı" };
      if (result.logIds.length) sent.push(`E-posta: ${me.email}`);
    }
    if (parsed.data.channels.includes("SMS")) {
      if (!me.phone?.trim()) return { success: false, error: "Hesabınızda telefon numarası yok; test SMS'i gönderilemedi." };
      const result = await sendNotification({ userId: me.id, template, data, channel: "SMS", phone: me.phone });
      if (!result.ok) return { success: false, error: "Test SMS'i kuyruğa alınamadı" };
      if (result.logIds.length) sent.push(`SMS: ${me.phone}`);
      else sent.push("SMS gönderilmedi (SMS bildirimleri kapalı veya sağlayıcı yok)");
    }
    return { success: true, data: { channels: sent } };
  } catch (error) {
    return failure(error, "Test gönderilemedi");
  }
}

/**
 * Status page link: puts the component into maintenance (public "Bakım
 * duyuruları") and opens an incident for the window, through the system
 * status admin actions.
 */
async function publishMaintenanceIncident(
  role: unknown,
  subject: string,
  options: { componentId: string; start: string; end: string }
): Promise<{ ok: true; incidentId: string } | { ok: false; error: string }> {
  if (!hasPermission(role, "status.manage")) {
    return { ok: false, error: "Durum sayfasına olay eklemek için “Sistem durumu” yetkiniz yok." };
  }
  const component = await db.systemStatus.findUnique({ where: { id: options.componentId }, select: { id: true, serviceName: true } });
  if (!component) return { ok: false, error: "Durum sayfası bileşeni bulunamadı" };

  const { maintenanceDescription } = await import("@/lib/validations/system-status");
  const windowText = maintenanceDescription(options.start, options.end);
  const incident = await createIncident({
    title: subject.slice(0, 160),
    description: windowText,
    severity: "MINOR",
    serviceName: component.serviceName,
    status: "IDENTIFIED",
    startedAt: options.start,
    message: windowText,
  });
  if (!incident.success) return { ok: false, error: incident.error };
  const maintenance = await scheduleComponentMaintenance(component.id, { start: options.start, end: options.end });
  if (!maintenance.success) return { ok: false, error: maintenance.error };
  return { ok: true, incidentId: incident.data!.id };
}

/** Compose form submit: save as draft, send now, or schedule. */
export async function createBroadcastAction(input: BroadcastInput, options: StartOptions): Promise<Result<{ id: string }>> {
  const session = await requirePermission("broadcast.send");
  const parsed = broadcastInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: firstError(parsed.error) };
  const start = startOptionsSchema.safeParse(options);
  if (!start.success) return { success: false, error: firstError(start.error) };

  const scheduledAt = start.data.mode === "schedule" ? new Date(start.data.scheduledAt) : null;
  if (scheduledAt && scheduledAt.getTime() < Date.now() - 60_000) {
    return { success: false, error: "Zamanlama ileri bir tarih olmalı" };
  }

  try {
    let incidentId: string | null = null;
    if (start.data.mode !== "draft" && start.data.incident) {
      const published = await publishMaintenanceIncident(session.user.role, parsed.data.subject, start.data.incident);
      if (!published.ok) return { success: false, error: published.error };
      incidentId = published.incidentId;
    }

    const { audience, ...content } = parsed.data;
    const broadcast = await db.broadcast.create({
      data: {
        ...content,
        smsText: content.smsText || null,
        audience: audience as Prisma.InputJsonValue,
        createdById: session.user.id,
        incidentId,
      },
      select: { id: true },
    });

    if (start.data.mode !== "draft") await startBroadcast(broadcast.id, scheduledAt);

    await audit(session.user.id, start.data.mode === "draft" ? "CREATE_BROADCAST_DRAFT" : "START_BROADCAST", broadcast.id, {
      kind: content.kind,
      subject: content.subject,
      mode: start.data.mode,
      ...(scheduledAt ? { scheduledAt: scheduledAt.toISOString() } : {}),
      ...(incidentId ? { incidentId } : {}),
    });
    revalidate(broadcast.id);
    if (incidentId) {
      revalidatePath("/yonetim/durum");
      revalidatePath("/musteri/durum");
    }
    return { success: true, data: { id: broadcast.id } };
  } catch (error) {
    return failure(error, "Duyuru kaydedilemedi");
  }
}

/** Draft → send now / schedule (detail page). */
export async function startBroadcastAction(id: string, scheduledAtIso: string | null): Promise<Result> {
  const session = await requirePermission("broadcast.send");
  const scheduledAt = scheduledAtIso ? new Date(scheduledAtIso) : null;
  if (scheduledAt && (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now() - 60_000)) {
    return { success: false, error: "Zamanlama ileri bir tarih olmalı" };
  }
  try {
    await startBroadcast(id, scheduledAt);
    await audit(session.user.id, "START_BROADCAST", id, scheduledAt ? { scheduledAt: scheduledAt.toISOString() } : undefined);
    revalidate(id);
    return { success: true };
  } catch (error) {
    return failure(error, "Duyuru başlatılamadı");
  }
}

export async function deleteBroadcastDraftAction(id: string): Promise<Result> {
  const session = await requirePermission("broadcast.send");
  const { count } = await db.broadcast.deleteMany({ where: { id, status: "DRAFT" } });
  if (count === 0) return { success: false, error: "Yalnızca taslak duyurular silinebilir" };
  await audit(session.user.id, "DELETE_BROADCAST_DRAFT", id);
  revalidate();
  return { success: true };
}

export async function cancelBroadcastAction(id: string): Promise<Result<{ cancelled: number }>> {
  const session = await requirePermission("broadcast.send");
  try {
    const result = await cancelBroadcast(id);
    await audit(session.user.id, "CANCEL_BROADCAST", id, { cancelled: String(result.cancelled) });
    revalidate(id);
    return { success: true, data: result };
  } catch (error) {
    return failure(error, "Duyuru iptal edilemedi");
  }
}

export async function resendFailedBroadcastAction(id: string): Promise<Result<{ requeued: number }>> {
  const session = await requirePermission("broadcast.send");
  try {
    const result = await resendFailedRecipients(id);
    await audit(session.user.id, "RESEND_BROADCAST_FAILED", id, { requeued: String(result.requeued) });
    revalidate(id);
    return { success: true, data: result };
  } catch (error) {
    return failure(error, "Yeniden gönderim başlatılamadı");
  }
}

/** Progress polling for the detail page. */
export async function getBroadcastProgressAction(
  id: string
): Promise<Result<{ status: string; counts: RecipientCounts; completedAt: string | null }>> {
  await requirePermission("broadcast.send");
  const broadcast = await db.broadcast.findUnique({ where: { id }, select: { status: true, completedAt: true } });
  if (!broadcast) return { success: false, error: "Duyuru bulunamadı" };
  if (broadcast.status === "SENDING") await syncRecipientsFromLogs(id);
  return {
    success: true,
    data: { status: broadcast.status, counts: await getRecipientCounts(id), completedAt: broadcast.completedAt?.toISOString() ?? null },
  };
}

export async function setBroadcastRateAction(rate: number): Promise<Result<{ rate: number }>> {
  const session = await requirePermission("broadcast.send");
  if (!Number.isFinite(rate) || rate < 1 || rate > 1000) return { success: false, error: "Hız 1 ile 1000 arasında olmalı" };
  const saved = await setBroadcastRate(rate);
  await audit(session.user.id, "UPDATE_BROADCAST_RATE", "broadcast_rate_per_minute", { rate: String(saved) });
  revalidate();
  return { success: true, data: { rate: saved } };
}
