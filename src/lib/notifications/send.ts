import type { NotificationChannel, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSettingValue, isEnabled } from "@/lib/integrations/settings";
import { createLogger } from "@/lib/logger";
import {
  hasSensitiveData,
  loadRenderContext,
  protectSensitive,
  redactSensitive,
  renderNotification,
} from "./render";
import { getTemplate, type TemplateData, type TemplateKey } from "./templates";
import type { NotificationTemplate } from "./templates/types";

const log = createLogger("notifications");

type DbClient = Prisma.TransactionClient | typeof db;

export interface SendNotificationInput<K extends TemplateKey> {
  /** Recipient user; email/phone/name are read from the account. Null for staff notifications. */
  userId?: string | null;
  template: K;
  data: TemplateData<K>;
  /** Restrict to one channel. Default: e-mail, plus SMS when the template has an SMS text and SMS is configured. */
  channel?: NotificationChannel;
  /** Explicit e-mail address (staff notifications, or overriding the account address). */
  to?: string;
  /** Explicit phone number for SMS (staff notifications). */
  phone?: string;
  /**
   * Idempotency key: at most one log row (and send) per key and channel, e.g.
   * `invoice.reminder:<invoiceId>`. Omit for messages that may repeat.
   */
  dedupeKey?: string;
  /**
   * Prisma interactive transaction: the log rows and queue jobs commit (or
   * roll back) together with the business change that caused them.
   */
  tx?: Prisma.TransactionClient;
  /** Internal: "yeniden gönder" from the admin log. */
  resendOfId?: string;
}

export interface SendNotificationResult {
  ok: boolean;
  /** NotificationLog ids created (empty when deduplicated or nothing to send). */
  logIds: string[];
  deduplicated: boolean;
  error?: string;
}

interface Recipient {
  name?: string;
  email?: string;
  phone?: string;
}

async function loadRecipient(client: DbClient, userId: string | null | undefined): Promise<Recipient> {
  if (!userId) return {};
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { name: true, surname: true, email: true, phone: true },
  });
  if (!user) return {};
  return {
    name: `${user.name ?? ""} ${user.surname ?? ""}`.trim() || undefined,
    email: user.email,
    phone: user.phone?.trim() || undefined,
  };
}

/**
 * SMS goes out only when the owner enabled SMS notifications and a provider
 * is configured; otherwise no SMS row is written at all (no noise in the log).
 */
async function isSmsActive() {
  if (!isEnabled(await getSettingValue("sms_notifications", undefined, "false"))) return false;
  const { getSmsConfig, isSmsConfigured } = await import("@/lib/integrations/sms");
  return isSmsConfigured(await getSmsConfig());
}

function toJson(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value ?? {})) as Record<string, unknown>;
}

interface PlannedRow {
  channel: NotificationChannel;
  to: string;
}

async function planChannels(
  template: NotificationTemplate,
  input: SendNotificationInput<TemplateKey>,
  recipient: Recipient
): Promise<PlannedRow[]> {
  const rows: PlannedRow[] = [];
  const wantEmail = !input.channel || input.channel === "EMAIL";
  const wantSms = !input.channel || input.channel === "SMS";

  const email = input.to?.trim() || recipient.email;
  if (wantEmail && email) rows.push({ channel: "EMAIL", to: email });

  const phone = input.phone?.trim() || recipient.phone;
  if (wantSms && template.sms && phone && (await isSmsActive())) {
    rows.push({ channel: "SMS", to: phone });
  }
  return rows;
}

/**
 * Queues a templated notification. Writes one NotificationLog row per channel
 * (status QUEUED) and enqueues a "notification.send" job for each; the job
 * renders and delivers it (src/lib/notifications/deliver.ts).
 *
 * Never throws: a broken notification must not fail the payment, signup or
 * admin action that triggered it. Errors are logged and returned. With `tx`,
 * only Prisma calls on the transaction run inside it, and duplicate keys are
 * skipped with ON CONFLICT DO NOTHING so the caller's transaction is never
 * aborted by a dedupe hit.
 */
export async function sendNotification<K extends TemplateKey>(
  input: SendNotificationInput<K>
): Promise<SendNotificationResult> {
  const client: DbClient = input.tx ?? db;

  try {
    const template = getTemplate(input.template);
    const recipient = await loadRecipient(client, input.userId);
    const data = toJson({ ...input.data, recipientName: input.data.recipientName ?? recipient.name });

    // Validate + render now: a bad payload fails here (logged) instead of in
    // the worker, and the subject is stored for the admin list.
    const ctx = await loadRenderContext();
    const rendered = renderNotification(template.key, data, ctx);
    const redacted = hasSensitiveData(template, data);

    const planned = await planChannels(template, input as SendNotificationInput<TemplateKey>, recipient);
    if (planned.length === 0) {
      log.info("notification has no recipient", { template: template.key, userId: input.userId });
      return { ok: true, logIds: [], deduplicated: false };
    }

    const storedData = protectSensitive(template, data) as Prisma.InputJsonValue;
    const created = await client.notificationLog.createManyAndReturn({
      data: planned.map((row) => ({
        userId: input.userId ?? null,
        template: template.key,
        channel: row.channel,
        to: row.to,
        subject: row.channel === "EMAIL" ? rendered.subject : (rendered.sms ?? "").slice(0, 160),
        data: storedData,
        redacted,
        dedupeKey: input.dedupeKey ?? null,
        resendOfId: input.resendOfId ?? null,
      })),
      skipDuplicates: true,
      select: { id: true, channel: true },
    });

    if (created.length === 0) {
      return { ok: true, logIds: [], deduplicated: true };
    }

    const emailRow = created.find((row) => row.channel === "EMAIL");
    if (emailRow && input.userId && template.inbox && !input.resendOfId) {
      await recordInboxCopy(client, emailRow.id, input.userId, template, data, ctx);
    }

    const { queueNotificationDelivery } = await import("./queue");
    for (const row of created) {
      await queueNotificationDelivery(row.id, input.tx);
    }

    return { ok: true, logIds: created.map((row) => row.id), deduplicated: false };
  } catch (error) {
    log.error("notification could not be queued", { template: input.template, userId: input.userId, error });
    return {
      ok: false,
      logIds: [],
      deduplicated: false,
      error: error instanceof Error ? error.message : "NOTIFICATION_QUEUE_FAILED",
    };
  }
}

/**
 * Customer panel "E-postalar" copy (/musteri/panel/e-posta). Secrets are
 * replaced with a placeholder: the inbox is not a credential store.
 */
async function recordInboxCopy(
  client: DbClient,
  logId: string,
  userId: string,
  template: NotificationTemplate,
  data: Record<string, unknown>,
  ctx: Awaited<ReturnType<typeof loadRenderContext>>
) {
  const safe = renderNotification(template.key, redactSensitive(template, data), ctx);
  const message = await client.emailMessage.create({
    data: {
      customerId: userId,
      subject: safe.subject,
      preview: safe.preheader.slice(0, 240),
      content: safe.text,
      category: template.inbox ?? "SYSTEM",
    },
    select: { id: true },
  });
  await client.notificationLog.update({ where: { id: logId }, data: { inboxMessageId: message.id } });
}
