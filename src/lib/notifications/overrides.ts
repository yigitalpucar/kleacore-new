import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { renderEmailShell, textFooter, type RenderedEmail } from "./layout";
import { renderTemplate, sanitizeEmailHtml } from "./template-engine";
import { buildTemplateView } from "./template-variables";
import type { NotificationTemplate, RenderContext } from "./templates/types";

const log = createLogger("notifications.overrides");

export const TEMPLATE_LOCALE = "tr";

/** Active admin edits of one template (DB NotificationTemplate rows). */
export interface TemplateOverride {
  email?: { subject: string; bodyHtml: string; bodyText: string; version: number } | null;
  sms?: { text: string; version: number } | null;
}

/**
 * Loads the active overrides of a template. Any DB problem means "no
 * override": the typed TS template is always the fallback.
 */
export async function loadTemplateOverride(key: string): Promise<TemplateOverride | null> {
  try {
    const rows = await db.notificationTemplate.findMany({
      where: { key, locale: TEMPLATE_LOCALE, isActive: true },
      select: { channel: true, subject: true, bodyHtml: true, bodyText: true, version: true },
    });
    if (rows.length === 0) return null;
    const email = rows.find((row) => row.channel === "EMAIL");
    const sms = rows.find((row) => row.channel === "SMS");
    return {
      email: email ? { subject: email.subject, bodyHtml: email.bodyHtml, bodyText: email.bodyText, version: email.version } : null,
      sms: sms ? { text: sms.bodyText, version: sms.version } : null,
    };
  } catch (error) {
    log.warn("template overrides unavailable; using the built-in template", { key, error });
    return null;
  }
}

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#039;": "'", "&nbsp;": " " };

/** Plain-text alternative of admin HTML when no text body was written. */
export function htmlToText(html: string) {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|h[1-6]|li|tr|table)\s*>/gi, "\n")
    .replace(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, label: string) => `${label}: ${href}`)
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|#039|nbsp);/g, (entity) => ENTITIES[entity] ?? entity)
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Renders an admin-edited e-mail with the template's (schema-parsed) data in the branded shell. */
export function renderOverrideEmail(
  template: NotificationTemplate,
  data: Record<string, unknown>,
  ctx: RenderContext,
  override: NonNullable<TemplateOverride["email"]>,
  options: { logoSrc: string; eyebrow?: string }
): RenderedEmail {
  const view = buildTemplateView(template, data, ctx);
  const subject = renderTemplate(override.subject, view, { escape: false }).replace(/\s+/g, " ").trim();
  const bodyHtml = sanitizeEmailHtml(renderTemplate(override.bodyHtml, view, { escape: true }));
  const textBody = override.bodyText.trim()
    ? renderTemplate(override.bodyText, view, { escape: false }).trim()
    : htmlToText(bodyHtml);
  const preheader = textBody.split("\n").find((line) => line.trim() && line.trim() !== subject)?.trim() ?? subject;
  // Structural parts the admin text cannot carry (e.g. the ticket reply
  // marker the inbound mail parser cuts at) come from the typed template.
  const replyMarker = template.render(data, ctx).replyMarker;
  const html = renderEmailShell({ subject, preheader, bodyHtml, replyMarker, eyebrow: options.eyebrow }, ctx.brand, options);
  const text = `${replyMarker ? `${replyMarker}\n\n` : ""}${textBody}\n\n${textFooter(ctx.brand)}`
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { subject, preheader, html, text };
}

export function renderOverrideSms(
  template: NotificationTemplate,
  data: Record<string, unknown>,
  ctx: RenderContext,
  override: NonNullable<TemplateOverride["sms"]>
) {
  const view = buildTemplateView(template, data, ctx);
  return renderTemplate(override.text, view, { escape: false }).replace(/\s+/g, " ").trim();
}
