import { htmlToText } from "@/lib/notifications/overrides";
import { collectNames, parseTemplate, renderTemplate, sanitizeEmailHtml } from "@/lib/notifications/template-engine";
import type { RenderContext } from "@/lib/notifications/templates/types";

/**
 * Broadcast content: subject, HTML body, optional plain text and SMS, written
 * by staff with {{variables}}. Rendered per recipient with the safe template
 * engine (src/lib/notifications/template-engine.ts): values are HTML-escaped,
 * no code runs, and the resulting HTML is sanitised (no scripts, handlers,
 * javascript: links).
 */

export const BROADCAST_VARIABLES = [
  { name: "customer.name", description: "Müşterinin adı soyadı" },
  { name: "customer.firstName", description: "Müşterinin adı" },
  { name: "customer.surname", description: "Müşterinin soyadı" },
  { name: "customer.email", description: "E-posta adresi" },
  { name: "customer.companyName", description: "Firma adı (kurumsal müşteri)" },
  { name: "brand.siteName", description: "Site adı" },
  { name: "brand.companyName", description: "Firma unvanı" },
  { name: "brand.supportEmail", description: "Destek e-postası" },
  { name: "brand.siteUrl", description: "Site adresi" },
  { name: "baseUrl", description: "Panel adresi (bağlantılar için)" },
] as const;

const ALLOWED = new Set<string>(BROADCAST_VARIABLES.map((variable) => variable.name));
/** Blocks may test the object groups too: {{#customer.companyName}}…{{/customer.companyName}}. */
const ALLOWED_SECTIONS = new Set<string>([...ALLOWED, "customer", "brand"]);

export const MAX_SUBJECT = 200;
export const MAX_BODY = 50_000;
export const MAX_SMS = 612; // 4 GSM parts / 9 UCS-2 parts

export interface BroadcastContent {
  subject: string;
  bodyHtml: string;
  bodyText?: string | null;
  smsText?: string | null;
}

export interface ContentError {
  field: "subject" | "bodyHtml" | "bodyText" | "smsText";
  message: string;
}

/** Syntax + variable whitelist of every field. */
export function validateBroadcastContent(content: BroadcastContent): ContentError[] {
  const errors: ContentError[] = [];
  const fields: Array<[ContentError["field"], string]> = [
    ["subject", content.subject],
    ["bodyHtml", content.bodyHtml],
    ["bodyText", content.bodyText ?? ""],
    ["smsText", content.smsText ?? ""],
  ];
  for (const [field, source] of fields) {
    const parsed = parseTemplate(source);
    if (!parsed.ok) {
      errors.push(...parsed.errors.map((error) => ({ field, message: error.message })));
      continue;
    }
    for (const use of collectNames(parsed.nodes)) {
      const ok = use.section ? ALLOWED_SECTIONS.has(use.name) : ALLOWED.has(use.name);
      if (!ok) errors.push({ field, message: `Bilinmeyen değişken: {{${use.name}}}` });
    }
  }
  return errors;
}

export interface BroadcastRecipientView {
  name: string;
  surname: string;
  email: string;
  companyName: string | null;
}

export function buildRecipientView(user: BroadcastRecipientView, ctx: RenderContext): Record<string, unknown> {
  const fullName = `${user.name ?? ""} ${user.surname ?? ""}`.trim();
  return {
    customer: {
      name: fullName,
      firstName: user.name ?? "",
      surname: user.surname ?? "",
      email: user.email,
      companyName: user.companyName ?? "",
    },
    brand: { ...ctx.brand },
    baseUrl: ctx.baseUrl,
  };
}

export interface RenderedBroadcast {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  sms: string | null;
}

/** Renders the content for one recipient (throws on a template error; content is validated on save). */
export function renderBroadcastContent(content: BroadcastContent, view: Record<string, unknown>): RenderedBroadcast {
  const subject = renderTemplate(content.subject, view, { escape: false }).replace(/\s+/g, " ").trim();
  const bodyHtml = sanitizeEmailHtml(renderTemplate(content.bodyHtml, view, { escape: true }));
  const bodyText = content.bodyText?.trim()
    ? renderTemplate(content.bodyText, view, { escape: false }).trim()
    : htmlToText(bodyHtml);
  const sms = content.smsText?.trim()
    ? renderTemplate(content.smsText, view, { escape: false }).replace(/\s+/g, " ").trim()
    : null;
  return { subject, bodyHtml, bodyText, sms };
}
