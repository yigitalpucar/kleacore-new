import type { EmailMessageCategory } from "@prisma/client";
import type { z } from "zod";

/** Company details shown in every email footer (Ayarlar → Genel). */
export interface NotificationBrand {
  siteName: string;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  supportEmail: string;
  siteUrl: string;
}

export interface RenderContext {
  brand: NotificationBrand;
  /** App base URL for panel links (APP_URL), no trailing slash. */
  baseUrl: string;
}

export interface EmailDetail {
  label: string;
  value: string;
  /** Monospace value (IDs, IPs, usernames). */
  mono?: boolean;
}

/**
 * Structured email body. The shared layout turns it into the branded HTML
 * and the plain-text alternative, so every template looks the same and
 * every value is escaped in one place.
 */
export interface EmailContent {
  subject: string;
  /** Hidden inbox preview line; defaults to the first intro paragraph. */
  preheader?: string;
  heading: string;
  /** Name for "Merhaba {name},"; omitted → "Merhaba,". null → no greeting. */
  greetingName?: string | null;
  intro: string[];
  details?: EmailDetail[];
  action?: { label: string; url: string };
  outro?: string[];
  /** Small muted note under the body (security hints etc.). */
  note?: string;
  /**
   * First line of the mail (e.g. "##- Yanıtınızı bu satırın üstüne yazın -##"):
   * inbound mail processing cuts a reply at this line (src/lib/support/inbound).
   */
  replyMarker?: string;
}

/** Extra SMTP headers for mails customers may answer by e-mail (ticket threads). */
export interface MailHeaders {
  /** Reply-To address (the polled support mailbox). */
  replyTo?: string;
  /** Embedded in the Message-ID (`<tag.random@domain>`) so a reply's In-Reply-To finds the thread. */
  messageIdTag?: string;
  /**
   * One-click unsubscribe URL (RFC 8058): sent as `List-Unsubscribe` +
   * `List-Unsubscribe-Post` on marketing mail.
   */
  listUnsubscribe?: string;
}

/** Pre-built body for templates whose HTML is authored by staff (broadcasts). */
export interface RawEmailContent {
  subject: string;
  preheader: string;
  /** Inner card HTML, already sanitised. */
  bodyHtml: string;
  /** Plain-text body without the footer. */
  text: string;
  /** Replaces the default "sent because of an action on your account" footer line. */
  footerNote?: string;
  /** Adds an unsubscribe link to the footer. */
  unsubscribeUrl?: string;
}

export type TemplateAudience = "customer" | "admin";

export interface NotificationTemplate<K extends string = string, S extends z.ZodTypeAny = z.ZodTypeAny> {
  key: K;
  /** Turkish label for the admin screens. */
  label: string;
  group: string;
  audience: TemplateAudience;
  schema: S;
  /**
   * Data keys holding secrets (initial password, one-time links). They are
   * encrypted in the queue payload and NotificationLog.data, replaced with a
   * placeholder in the customer inbox copy, and the log is flagged redacted.
   */
  sensitive?: readonly string[];
  /** Customer inbox (/musteri/panel/e-posta) category; omit to skip the inbox copy. */
  inbox?: EmailMessageCategory;
  /** Sample data for the admin preview page. */
  sample: z.input<S>;
  render(data: z.output<S>, ctx: RenderContext): EmailContent;
  /** Optional short SMS text (sent only when an SMS provider is configured). */
  sms?(data: z.output<S>, ctx: RenderContext): string;
  /** Optional mail headers (Reply-To, threading Message-ID, List-Unsubscribe). */
  mailHeaders?(data: z.output<S>): MailHeaders;
  /**
   * Staff-authored HTML instead of the structured layout (broadcasts). Used
   * in place of `render` for the e-mail; admin overrides do not apply.
   */
  renderRaw?(data: z.output<S>, ctx: RenderContext): RawEmailContent;
  /** false: hidden from the template editor (content is written per send). */
  editable?: boolean;
}

export function defineTemplate<const K extends string, S extends z.ZodTypeAny>(
  template: NotificationTemplate<K, S>
): NotificationTemplate<K, S> {
  return template;
}
