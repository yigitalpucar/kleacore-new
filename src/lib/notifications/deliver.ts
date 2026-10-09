import { db } from "@/lib/db";
import type { JobContext } from "@/lib/jobs/registry";
import { createLogger } from "@/lib/logger";
import { sendTransactionalEmail } from "@/lib/mail";
import { LOGO_CID } from "./layout";
import { LOGO_PNG_BASE64 } from "./logo";
import { loadRenderContext, renderNotification, revealSensitive } from "./render";
import { getTemplate } from "./templates";
import type { MailHeaders } from "./templates/types";

const log = createLogger("notifications.deliver");

let logoBuffer: Buffer | undefined;
function logoAttachment() {
  logoBuffer ??= Buffer.from(LOGO_PNG_BASE64, "base64");
  return { filename: "kleacore.png", content: logoBuffer, contentType: "image/png", cid: LOGO_CID };
}

type Outcome =
  | { status: "SENT"; providerMessageId?: string }
  | { status: "SKIPPED"; reason: string };

async function deliverEmail(
  to: string,
  rendered: ReturnType<typeof renderNotification>,
  headers: MailHeaders = {}
): Promise<Outcome> {
  const result = await sendTransactionalEmail({
    to,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    attachments: [logoAttachment()],
    ...(headers.replyTo ? { replyTo: headers.replyTo } : {}),
    ...(headers.messageIdTag ? { messageIdTag: headers.messageIdTag } : {}),
    ...(headers.listUnsubscribe ? { listUnsubscribe: headers.listUnsubscribe } : {}),
  });
  if (result.sent) return { status: "SENT", providerMessageId: result.messageId };
  return { status: "SKIPPED", reason: result.reason ?? "EMAIL_NOT_SENT" };
}

async function deliverSms(to: string, message: string | null): Promise<Outcome> {
  if (!message) return { status: "SKIPPED", reason: "TEMPLATE_HAS_NO_SMS" };
  const { getSmsProvider } = await import("@/lib/integrations/sms");
  const provider = await getSmsProvider();
  const result = await provider.sendSms({ to, message });
  if (result.sent) return { status: "SENT", providerMessageId: result.reference };
  if (result.skipped) return { status: "SKIPPED", reason: result.error ?? "SMS_PROVIDER_DISABLED" };
  throw new Error(result.error ?? "SMS_SEND_FAILED");
}

/**
 * Handler of the "notification.send" queue job: renders and sends one log row.
 * SENT/SKIPPED rows are final (a repeated job is a no-op). On an error the
 * row keeps QUEUED and the error is thrown so pg-boss retries with backoff;
 * the last attempt marks it FAILED (retry from /yonetim/isler or "yeniden gönder").
 */
export async function deliverNotificationLog(notificationLogId: string, context: JobContext) {
  const row = await db.notificationLog.findUnique({ where: { id: notificationLogId } });
  if (!row) return { skipped: "LOG_NOT_FOUND" };
  if (row.status === "SENT" || row.status === "SKIPPED") return { skipped: `ALREADY_${row.status}` };

  try {
    const template = getTemplate(row.template);
    const data = revealSensitive(template, (row.data ?? {}) as Record<string, unknown>);
    // Admin-edited template (if active) is read at send time, so an edit
    // applies to everything still in the queue.
    const { loadTemplateOverride } = await import("./overrides");
    const rendered = renderNotification(row.template, data, await loadRenderContext(), {
      override: await loadTemplateOverride(row.template),
    });

    const headers = template.mailHeaders?.(template.schema.parse(data));
    const outcome =
      row.channel === "SMS" ? await deliverSms(row.to, rendered.sms) : await deliverEmail(row.to, rendered, headers);

    await db.notificationLog.update({
      where: { id: row.id },
      data:
        outcome.status === "SENT"
          ? { status: "SENT", sentAt: new Date(), providerMessageId: outcome.providerMessageId ?? null, error: null, attempts: { increment: 1 } }
          : { status: "SKIPPED", error: outcome.reason, attempts: { increment: 1 } },
    });
    await updateBroadcastRecipient(row, outcome.status, outcome.status === "SKIPPED" ? outcome.reason : null);
    return { status: outcome.status, logId: row.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.notificationLog.update({
      where: { id: row.id },
      data: {
        status: context.isFinalAttempt ? "FAILED" : "QUEUED",
        error: message.slice(0, 1000),
        attempts: { increment: 1 },
      },
    });
    if (context.isFinalAttempt) await updateBroadcastRecipient(row, "FAILED", message);
    log.warn("notification delivery failed", {
      logId: row.id,
      template: row.template,
      channel: row.channel,
      final: context.isFinalAttempt,
      error: message,
    });
    throw error;
  }
}

/** Mirrors a final delivery outcome onto the broadcast recipient row (progress UI). Never throws. */
async function updateBroadcastRecipient(
  row: { id: string; template: string },
  status: "SENT" | "SKIPPED" | "FAILED",
  error: string | null
) {
  if (!row.template.startsWith("broadcast.")) return;
  try {
    const { recordBroadcastDelivery } = await import("@/lib/broadcasts/progress");
    await recordBroadcastDelivery(row.id, status, error);
  } catch (syncError) {
    log.warn("broadcast recipient status not updated", { logId: row.id, error: syncError });
  }
}
