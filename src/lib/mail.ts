import nodemailer from "nodemailer";
import { db } from "@/lib/db";

interface MailInput {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
}

interface MailResult {
  sent: boolean;
  skipped?: boolean;
  reason?: string;
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

  return new Map(settings.map((setting) => [setting.key, setting.value]));
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

  if (!host || !user || !pass) {
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
    auth: { user, pass },
  });

  await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });

  return { sent: true };
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
