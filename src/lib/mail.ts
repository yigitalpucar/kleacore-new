import { randomBytes } from "node:crypto";
import nodemailer from "nodemailer";
import { db } from "@/lib/db";
import { resolveSettingValue } from "@/lib/secrets/crypto";

interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
  /** Content-ID for inline images (`<img src="cid:...">`). */
  cid?: string;
}

interface MailInput {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  attachments?: MailAttachment[];
  replyTo?: string;
  /** Message-ID becomes `<tag.random@sender-domain>` (ticket mail threading). */
  messageIdTag?: string;
  /** One-click unsubscribe URL (RFC 2369 + RFC 8058 headers). */
  listUnsubscribe?: string;
}

export interface MailResult {
  sent: boolean;
  skipped?: boolean;
  reason?: string;
  /** SMTP Message-ID of the accepted message. */
  messageId?: string;
}

function env(name: string) {
  return process.env[name]?.trim() || "";
}

async function getSettingMap() {
  const settings = await db.setting.findMany({
    where: {
      key: {
        in: [
          "smtp_server",
          "smtp_port",
          "smtp_username",
          "smtp_password",
          "company_email",
          "email_notifications",
        ],
      },
    },
    select: { key: true, value: true },
  });

  // smtp_password is stored encrypted (SECRET_SETTING_KEYS); decrypt it here.
  return new Map(settings.map((setting) => [setting.key, resolveSettingValue(setting.key, setting.value)]));
}

export async function sendTransactionalEmail(input: MailInput): Promise<MailResult> {
  const settings = await getSettingMap();
  const notificationsEnabled =
    settings.get("email_notifications") ?? env("EMAIL_NOTIFICATIONS") ?? "true";

  if (notificationsEnabled === "false") {
    return { sent: false, skipped: true, reason: "EMAIL_NOTIFICATIONS_DISABLED" };
  }

  const host = settings.get("smtp_server") || env("SMTP_HOST");
  const port = Number(settings.get("smtp_port") || env("SMTP_PORT") || 587);
  const user = settings.get("smtp_username") || env("SMTP_USER");
  const pass = settings.get("smtp_password") || env("SMTP_PASSWORD");
  const from =
    settings.get("company_email") ||
    env("SMTP_FROM") ||
    env("EMAIL_FROM") ||
    "noreply@kleacore.com";

  // Credentials are optional: a relay or a local catcher (Mailpit) accepts
  // unauthenticated mail. A username without a password is a misconfiguration.
  if (!host || (user && !pass)) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[Mail][DEV_FALLBACK] ${input.subject} -> ${input.to}`);
      console.info(input.text);
    }
    return { sent: false, skipped: true, reason: "SMTP_NOT_CONFIGURED" };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    ...(user ? { auth: { user, pass } } : {}),
  });

  const info = await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    attachments: input.attachments,
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    ...(input.messageIdTag ? { messageId: threadMessageId(input.messageIdTag, from) } : {}),
    ...(input.listUnsubscribe ? { headers: listUnsubscribeHeaders(input.listUnsubscribe) } : {}),
  });

  return { sent: true, messageId: info.messageId };
}

/** RFC 2369 List-Unsubscribe + RFC 8058 one-click POST (Gmail / Yahoo bulk sender rules). */
export function listUnsubscribeHeaders(url: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

function threadMessageId(tag: string, from: string) {
  const domain = from.match(/@([a-z0-9.-]+)/i)?.[1] ?? "kleacore.com";
  const safeTag = tag.replace(/[^A-Za-z0-9.-]/g, "");
  return `<${safeTag}.${randomBytes(8).toString("hex")}@${domain}>`;
}

export function plainTextToHtml(text: string) {
  return text
    .split("\n")
    .map((line) => (line.trim() ? `<p>${escapeHtml(line)}</p>` : "<br />"))
    .join("");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
