import type { NotificationChannel, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { renderNotification } from "./render";
import { TEMPLATE_LOCALE, type TemplateOverride } from "./overrides";
import { defaultTemplateSource } from "./template-defaults";
import { allTemplateVariables, validateTemplateFields, type TemplateFieldError } from "./template-variables";
import { getTemplate, hasTemplate } from "./templates";
import type { RenderContext } from "./templates/types";

/**
 * Admin template management (/yonetim/bildirimler/sablonlar): DB overrides
 * of the typed TS templates with version history. Every save validates the
 * syntax and the variable whitelist first.
 */

export interface TemplateDraft {
  subject?: string;
  bodyHtml?: string;
  bodyText?: string;
}

export class TemplateValidationError extends Error {
  constructor(readonly errors: TemplateFieldError[]) {
    super(errors.map((error) => error.message).join(" "));
    this.name = "TemplateValidationError";
  }
}

const MAX_SUBJECT = 300;
const MAX_SMS = 918; // 6 GSM parts; longer texts are almost certainly a mistake

function requireTemplate(key: string) {
  if (!hasTemplate(key)) throw new Error("UNKNOWN_TEMPLATE");
  const template = getTemplate(key);
  // Broadcast templates carry their content per send; nothing to override.
  if (template.editable === false) throw new Error("UNKNOWN_TEMPLATE");
  return template;
}

/** Fields that are validated / stored for a channel. */
export function draftFields(channel: NotificationChannel, draft: TemplateDraft): Record<string, string> {
  if (channel === "SMS") return { bodyText: draft.bodyText ?? "" };
  return { subject: draft.subject ?? "", bodyHtml: draft.bodyHtml ?? "", bodyText: draft.bodyText ?? "" };
}

export function validateDraft(key: string, channel: NotificationChannel, draft: TemplateDraft): TemplateFieldError[] {
  const template = requireTemplate(key);
  const errors: TemplateFieldError[] = [];
  if (channel === "SMS") {
    if (!template.sms) errors.push({ field: "bodyText", offset: 0, message: "Bu bildirimin SMS sürümü yok." });
    if (!draft.bodyText?.trim()) errors.push({ field: "bodyText", offset: 0, message: "SMS metni boş olamaz." });
    if ((draft.bodyText ?? "").length > MAX_SMS) {
      errors.push({ field: "bodyText", offset: 0, message: `SMS metni en fazla ${MAX_SMS} karakter olabilir.` });
    }
  } else {
    if (!draft.subject?.trim()) errors.push({ field: "subject", offset: 0, message: "Konu boş olamaz." });
    if ((draft.subject ?? "").length > MAX_SUBJECT) {
      errors.push({ field: "subject", offset: 0, message: `Konu en fazla ${MAX_SUBJECT} karakter olabilir.` });
    }
    if (!draft.bodyHtml?.trim()) errors.push({ field: "bodyHtml", offset: 0, message: "E-posta gövdesi boş olamaz." });
  }
  return [...errors, ...validateTemplateFields(template, draftFields(channel, draft))];
}

/** Draft → override shape used by renderNotification. */
export function draftOverride(channel: NotificationChannel, draft: TemplateDraft): TemplateOverride {
  return channel === "SMS"
    ? { sms: { text: draft.bodyText ?? "", version: 0 } }
    : { email: { subject: draft.subject ?? "", bodyHtml: draft.bodyHtml ?? "", bodyText: draft.bodyText ?? "", version: 0 } };
}

/** Renders a draft with the template's sample data (preview / test send). Throws on invalid drafts. */
export function renderDraft(key: string, channel: NotificationChannel, draft: TemplateDraft, ctx: RenderContext, logo: "cid" | "inline") {
  const errors = validateDraft(key, channel, draft);
  if (errors.length) throw new TemplateValidationError(errors);
  const template = getTemplate(key);
  return renderNotification(key, template.sample, ctx, { logo, override: draftOverride(channel, draft) });
}

export async function getTemplateEditorState(key: string, ctx: RenderContext) {
  const template = requireTemplate(key);
  const rows = await db.notificationTemplate.findMany({
    where: { key, locale: TEMPLATE_LOCALE },
    include: { versions: { orderBy: { version: "desc" }, take: 30 } },
  });
  const byChannel = (channel: NotificationChannel) => rows.find((row) => row.channel === channel) ?? null;
  return {
    template,
    variables: allTemplateVariables(template),
    defaults: defaultTemplateSource(template, ctx),
    email: byChannel("EMAIL"),
    sms: template.sms ? byChannel("SMS") : null,
  };
}

/** Overview for the template list: which templates have an active override. */
export async function getActiveOverrideKeys() {
  const rows = await db.notificationTemplate.findMany({
    where: { locale: TEMPLATE_LOCALE, isActive: true },
    select: { key: true, channel: true, version: true },
  });
  return rows;
}

function snapshot(row: { subject: string; bodyHtml: string; bodyText: string; isActive: boolean }) {
  return { subject: row.subject, bodyHtml: row.bodyHtml, bodyText: row.bodyText, isActive: row.isActive };
}

async function writeVersion(
  tx: Prisma.TransactionClient,
  key: string,
  channel: NotificationChannel,
  next: { subject: string; bodyHtml: string; bodyText: string; isActive: boolean },
  action: "save" | "revert" | "restore",
  userId: string
) {
  const template = getTemplate(key);
  const variables = Object.fromEntries(allTemplateVariables(template).map((variable) => [variable.name, variable.description]));
  const existing = await tx.notificationTemplate.findUnique({
    where: { key_channel_locale: { key, channel, locale: TEMPLATE_LOCALE } },
    select: { id: true, version: true },
  });

  const row = existing
    ? await tx.notificationTemplate.update({
        where: { id: existing.id },
        data: { ...next, variables, version: existing.version + 1, updatedBy: userId },
      })
    : await tx.notificationTemplate.create({
        data: { key, channel, locale: TEMPLATE_LOCALE, ...next, variables, version: 1, updatedBy: userId },
      });

  await tx.notificationTemplateVersion.create({
    data: { templateId: row.id, version: row.version, ...snapshot(row), action, updatedBy: userId },
  });
  return row;
}

/** Saves (and activates) an override; the previous text stays in the version history. */
export async function saveTemplateOverride(key: string, channel: NotificationChannel, draft: TemplateDraft, userId: string) {
  const errors = validateDraft(key, channel, draft);
  if (errors.length) throw new TemplateValidationError(errors);
  const fields = draftFields(channel, draft);
  return db.$transaction((tx) =>
    writeVersion(
      tx,
      key,
      channel,
      { subject: fields.subject ?? "", bodyHtml: fields.bodyHtml ?? "", bodyText: fields.bodyText ?? "", isActive: true },
      "save",
      userId
    )
  );
}

/** "Varsayılana dön": deactivates the override (text kept for history / restore). */
export async function revertTemplateOverride(key: string, channel: NotificationChannel, userId: string) {
  requireTemplate(key);
  return db.$transaction(async (tx) => {
    const row = await tx.notificationTemplate.findUnique({
      where: { key_channel_locale: { key, channel, locale: TEMPLATE_LOCALE } },
    });
    if (!row || !row.isActive) return row;
    return writeVersion(tx, key, channel, { ...snapshot(row), isActive: false }, "revert", userId);
  });
}

/** Restores an older version as the active override (validated again: variables may have changed). */
export async function restoreTemplateVersion(key: string, channel: NotificationChannel, versionId: string, userId: string) {
  requireTemplate(key);
  const version = await db.notificationTemplateVersion.findUnique({
    where: { id: versionId },
    include: { template: { select: { key: true, channel: true } } },
  });
  if (!version || version.template.key !== key || version.template.channel !== channel) throw new Error("VERSION_NOT_FOUND");
  const draft = { subject: version.subject, bodyHtml: version.bodyHtml, bodyText: version.bodyText };
  const errors = validateDraft(key, channel, draft);
  if (errors.length) throw new TemplateValidationError(errors);
  return db.$transaction((tx) => writeVersion(tx, key, channel, { ...draft, isActive: true }, "restore", userId));
}
