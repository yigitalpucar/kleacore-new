"use server";

import type { NotificationChannel } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity-log";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { sendTransactionalEmail } from "@/lib/mail";
import { LOGO_CID } from "@/lib/notifications/layout";
import { LOGO_PNG_BASE64 } from "@/lib/notifications/logo";
import { loadRenderContext } from "@/lib/notifications/render";
import { smsLength } from "@/lib/notifications/sms-length";
import {
  renderDraft,
  restoreTemplateVersion,
  revertTemplateOverride,
  saveTemplateOverride,
  TemplateValidationError,
  type TemplateDraft,
} from "@/lib/notifications/template-admin";
import type { TemplateFieldError } from "@/lib/notifications/template-variables";
import { hasTemplate } from "@/lib/notifications/templates";
import { requireAdmin } from "@/lib/utils/auth-helpers";

const log = createLogger("admin.notification-templates");

type Failure = { success: false; error: string; errors?: TemplateFieldError[] };

function parseChannel(channel: string): NotificationChannel | null {
  return channel === "EMAIL" || channel === "SMS" ? channel : null;
}

function failure(error: unknown, fallback: string): Failure {
  if (error instanceof TemplateValidationError) {
    return { success: false, error: "Şablonda hata var.", errors: error.errors };
  }
  if (error instanceof Error && error.message === "UNKNOWN_TEMPLATE") return { success: false, error: "Şablon bulunamadı" };
  if (error instanceof Error && error.message === "VERSION_NOT_FOUND") return { success: false, error: "Sürüm bulunamadı" };
  log.error(fallback, { error });
  return { success: false, error: fallback };
}

function revalidate() {
  revalidatePath("/yonetim/bildirimler/sablonlar");
}

/** Live preview of an unsaved draft with the template's sample data. */
export async function previewTemplateDraftAction(key: string, channelInput: string, draft: TemplateDraft) {
  await requireAdmin();
  const channel = parseChannel(channelInput);
  if (!channel || !hasTemplate(key)) return { success: false as const, error: "Geçersiz şablon" };
  try {
    const rendered = renderDraft(key, channel, draft, await loadRenderContext(), "inline");
    return {
      success: true as const,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      sms: rendered.sms,
      smsInfo: rendered.sms ? smsLength(rendered.sms) : null,
    };
  } catch (error) {
    return failure(error, "Önizleme oluşturulamadı");
  }
}

export async function saveTemplateAction(key: string, channelInput: string, draft: TemplateDraft) {
  const session = await requireAdmin();
  const channel = parseChannel(channelInput);
  if (!channel) return { success: false as const, error: "Geçersiz kanal" };
  try {
    const row = await saveTemplateOverride(key, channel, draft, session.user.id);
    await logActivity({
      userId: session.user.id,
      action: "NOTIFICATION_TEMPLATE_SAVE",
      entity: "NotificationTemplate",
      entityId: row.id,
      details: { key, channel, version: row.version },
    });
    revalidate();
    return { success: true as const, version: row.version };
  } catch (error) {
    return failure(error, "Şablon kaydedilemedi");
  }
}

export async function revertTemplateAction(key: string, channelInput: string) {
  const session = await requireAdmin();
  const channel = parseChannel(channelInput);
  if (!channel) return { success: false as const, error: "Geçersiz kanal" };
  try {
    const row = await revertTemplateOverride(key, channel, session.user.id);
    if (row) {
      await logActivity({
        userId: session.user.id,
        action: "NOTIFICATION_TEMPLATE_REVERT",
        entity: "NotificationTemplate",
        entityId: row.id,
        details: { key, channel, version: row.version },
      });
    }
    revalidate();
    return { success: true as const };
  } catch (error) {
    return failure(error, "Varsayılana dönülemedi");
  }
}

export async function restoreTemplateVersionAction(key: string, channelInput: string, versionId: string) {
  const session = await requireAdmin();
  const channel = parseChannel(channelInput);
  if (!channel) return { success: false as const, error: "Geçersiz kanal" };
  try {
    const row = await restoreTemplateVersion(key, channel, versionId, session.user.id);
    await logActivity({
      userId: session.user.id,
      action: "NOTIFICATION_TEMPLATE_RESTORE",
      entity: "NotificationTemplate",
      entityId: row.id,
      details: { key, channel, version: row.version, restoredVersionId: versionId },
    });
    revalidate();
    return { success: true as const, version: row.version };
  } catch (error) {
    return failure(error, "Sürüm geri yüklenemedi");
  }
}

/**
 * "Test gönder": the draft rendered with sample data, straight to the admin's
 * own e-mail (or phone for SMS). Not logged as a customer notification.
 */
export async function sendTemplateTestAction(key: string, channelInput: string, draft: TemplateDraft) {
  const session = await requireAdmin();
  const channel = parseChannel(channelInput);
  if (!channel || !hasTemplate(key)) return { success: false as const, error: "Geçersiz şablon" };

  try {
    const admin = await db.user.findUnique({ where: { id: session.user.id }, select: { email: true, phone: true } });
    if (channel === "EMAIL") {
      if (!admin?.email) return { success: false as const, error: "Hesabınızda e-posta adresi yok" };
      const rendered = renderDraft(key, channel, draft, await loadRenderContext(), "cid");
      const result = await sendTransactionalEmail({
        to: admin.email,
        subject: `[Test] ${rendered.subject}`,
        text: rendered.text,
        html: rendered.html,
        attachments: [
          { filename: "kleacore.png", content: Buffer.from(LOGO_PNG_BASE64, "base64"), contentType: "image/png", cid: LOGO_CID },
        ],
      });
      if (!result.sent) return { success: false as const, error: `E-posta gönderilemedi (${result.reason ?? "SMTP"})` };
      return { success: true as const, to: admin.email };
    }

    const phone = admin?.phone?.trim();
    if (!phone) return { success: false as const, error: "Hesabınızda telefon numarası yok" };
    const rendered = renderDraft(key, channel, draft, await loadRenderContext(), "cid");
    const { getSmsProvider } = await import("@/lib/integrations/sms");
    const provider = await getSmsProvider();
    const result = await provider.sendSms({ to: phone, message: rendered.sms ?? "" });
    if (!result.sent) return { success: false as const, error: `SMS gönderilemedi (${result.error ?? "sağlayıcı kapalı"})` };
    return { success: true as const, to: phone };
  } catch (error) {
    return failure(error, "Test gönderilemedi");
  }
}
