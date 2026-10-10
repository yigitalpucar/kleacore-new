import { LOGO_HEIGHT, LOGO_WIDTH } from "./logo";
import type { EmailContent, EmailDetail, NotificationBrand } from "./templates/types";

/** Content-ID of the inline logo attachment (see deliver.ts). */
export const LOGO_CID = "kleacore-logo";

export interface RenderedEmail {
  subject: string;
  preheader: string;
  html: string;
  text: string;
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Only http(s)/mailto links make it into an href. */
export function safeUrl(url: string) {
  return /^(https?:|mailto:)/i.test(url.trim()) ? url.trim() : "#";
}

/*
 * Site kit (docs/ui-kit.md) in e-mail form: monochrome tokens of
 * src/app/globals.css, the always-dark header like the site footer/topbar,
 * mono uppercase micro-labels and dashed rules. Everything is inline-styled
 * and table-based (Gmail, Outlook desktop/web, Apple Mail); the <style>
 * block only adds progressive enhancements (dark mode, phones).
 */
export const EMAIL_COLORS = {
  page: "#fafafa",
  card: "#ffffff",
  border: "#e0e0e0",
  rule: "#d4d4d8",
  text: "#18181b",
  muted: "#737373",
  ink: "#09090b",
  soft: "#f5f5f5",
  onInk: "#ffffff",
  onInkMuted: "#a1a1aa",
} as const;

const C = EMAIL_COLORS;

const FONT = "Geist,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "'Geist Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,'Courier New',monospace";

/**
 * Dark-mode palette as [selector, declarations] pairs. Emitted under
 * `prefers-color-scheme: dark` (Apple Mail, iOS, Outlook for Mac) and the
 * Outlook.com `[data-ogsc]` hooks; the admin preview forces it with
 * `forceDarkPreview`. Gmail ignores it and applies its own inversion,
 * which the dark header and neutral greys survive.
 */
const DARK_RULES: Array<[string, string]> = [
  [".kc-page", "background-color:#09090b !important"],
  [".kc-card", "background-color:#131316 !important;border-color:#27272a !important"],
  [".kc-head", "background-color:#000000 !important;border-color:#27272a !important"],
  [".kc-body, .kc-body p, .kc-body li, .kc-body .kc-text", "color:#f4f4f5 !important"],
  [".kc-body a", "color:#fafafa !important"],
  [".kc-body .kc-h1", "color:#fafafa !important"],
  [".kc-body .kc-muted, .kc-foot, .kc-foot p, .kc-foot a, .kc-muted", "color:#a1a1aa !important"],
  [".kc-body .kc-rule", "border-color:#3f3f46 !important"],
  [".kc-body .kc-table", "background-color:#1b1b1f !important;border-color:#27272a !important"],
  [".kc-body .kc-row td", "border-color:#27272a !important"],
  [".kc-body .kc-row .kc-label", "color:#a1a1aa !important"],
  [".kc-body .kc-row .kc-value", "color:#f4f4f5 !important"],
  [".kc-body .kc-btn-cell", "background-color:#fafafa !important"],
  [".kc-body a.kc-btn", "background-color:#fafafa !important;border-color:#fafafa !important;color:#09090b !important"],
];

function darkCss(prefix: string) {
  return DARK_RULES.map(
    ([selector, rule]) =>
      `${selector
        .split(",")
        .map((part) => `${prefix}${part.trim()}`)
        .join(",")}{${rule}}`
  ).join("\n");
}

const HEAD_STYLE = `
:root{color-scheme:light dark;supported-color-schemes:light dark}
body{margin:0;padding:0;width:100% !important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
table{border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0}
img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic}
a[x-apple-data-detectors]{color:inherit !important;text-decoration:none !important}
.kc-body p{margin:0 0 14px;font-size:15px;line-height:1.6}
.kc-body h2{margin:24px 0 10px;font-size:17px;line-height:1.35}
.kc-body ul,.kc-body ol{margin:0 0 14px;padding-left:22px}
.kc-body li{margin:0 0 6px}
.kc-body a{color:${C.ink};text-decoration:underline}
.kc-body img{max-width:100%;height:auto}
@media only screen and (max-width:620px){
  .kc-outer{padding:12px 0 24px !important}
  .kc-pad{padding:24px 20px !important}
  .kc-head{padding:18px 20px !important;border-radius:0 !important}
  .kc-card{border-radius:0 !important;border-left:0 !important;border-right:0 !important}
  .kc-foot{padding:20px !important}
  .kc-h1{font-size:20px !important}
  .kc-row td{display:block !important;width:auto !important}
  .kc-row .kc-label{padding-bottom:0 !important}
  .kc-row .kc-value{padding-top:2px !important;border-top:0 !important}
  .kc-btn-table{width:100% !important}
  .kc-btn{display:block !important;text-align:center !important}
}
@media (prefers-color-scheme:dark){
${darkCss("")}
}
${darkCss("[data-ogsc] ")}
`;

/** Admin preview: the same dark palette, applied unconditionally. */
export function forceDarkPreview(html: string) {
  return html.replace("</head>", `<style>${darkCss("")}</style>\n</head>`);
}

// Zero-width filler after the preheader so clients don't pull body text into the inbox preview.
const PREHEADER_FILLER = "&#847;&zwnj;&nbsp;".repeat(60);

function greetingLine(content: EmailContent) {
  if (content.greetingName === null) return null;
  const name = content.greetingName?.trim();
  return name ? `Merhaba ${name},` : "Merhaba,";
}

const BODY_P = `margin:0 0 14px;font-size:15px;line-height:1.6;color:${C.text}`;

function paragraphs(lines: string[] | undefined) {
  return (lines ?? [])
    .filter((line) => line.trim())
    .map((line) => `<p class="kc-text" style="${BODY_P}">${escapeHtml(line)}</p>`)
    .join("\n");
}

/**
 * Summary / info table (invoice amounts, service details, credentials).
 * Label left, value right of it; stacked on phones. `emphasis` rows
 * (amounts) get a larger, bolder value.
 */
export function renderDetailsTable(details: EmailDetail[] | undefined) {
  if (!details?.length) return "";
  const rows = details
    .map((detail, index) => {
      const rule = index === 0 ? "" : `border-top:1px dashed ${C.border};`;
      const valueFont = detail.mono
        ? `font-family:${MONO};font-size:13px;`
        : detail.emphasis
          ? "font-size:16px;"
          : "font-size:14px;";
      return `<tr class="kc-row">
<td class="kc-label" style="${rule}padding:11px 16px;font-family:${FONT};font-size:13px;line-height:1.45;color:${C.muted};width:40%;vertical-align:top">${escapeHtml(detail.label)}</td>
<td class="kc-value" style="${rule}padding:11px 16px;font-family:${FONT};${valueFont}line-height:1.45;color:${C.text};font-weight:${detail.emphasis ? 700 : 600};word-break:break-word;vertical-align:top">${escapeHtml(detail.value)}</td>
</tr>`;
    })
    .join("\n");
  return `<table role="presentation" class="kc-table" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border:1px solid ${C.border};border-radius:10px;border-collapse:separate;background-color:${C.soft};margin:22px 0">
${rows}
</table>`;
}

/**
 * Bulletproof CTA: the cell carries the colour (Outlook ignores <a>
 * padding, so the cell gets it via mso-padding-alt), the link carries the
 * padding everywhere else so the whole button is clickable. The URL is
 * repeated as text below for clients that strip links.
 */
export function renderButton(action: { label: string; url: string } | undefined) {
  if (!action) return "";
  const href = escapeHtml(safeUrl(action.url));
  return `<table role="presentation" class="kc-btn-table" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 10px">
<tr><td class="kc-btn-cell" align="center" bgcolor="${C.ink}" style="border-radius:8px;background-color:${C.ink};mso-padding-alt:13px 24px">
<a class="kc-btn" href="${href}" target="_blank" style="display:inline-block;padding:13px 24px;mso-padding-alt:0;border:1px solid ${C.ink};border-radius:8px;background-color:${C.ink};font-family:${FONT};font-size:15px;line-height:20px;font-weight:600;color:${C.onInk};text-decoration:none">${escapeHtml(action.label)} &rarr;</a>
</td></tr>
</table>
<p class="kc-muted" style="margin:0 0 14px;font-size:12px;line-height:1.5;color:${C.muted};word-break:break-all">Buton çalışmazsa bu bağlantıyı tarayıcınıza yapıştırın:<br />${escapeHtml(action.url)}</p>`;
}

function footerLines(brand: NotificationBrand) {
  return [
    brand.companyName,
    brand.companyAddress,
    [brand.supportEmail && `Destek: ${brand.supportEmail}`, brand.companyPhone].filter(Boolean).join(" · "),
    brand.siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, ""),
  ].filter((line) => line && line.trim());
}

/** Inner card HTML (heading, greeting, paragraphs, details, button, note) of a structured template. */
export function renderEmailBody(content: EmailContent, options: { greetingHtml?: string } = {}) {
  const greeting = greetingLine(content);
  const greetingHtml = options.greetingHtml ?? (greeting ? escapeHtml(greeting) : null);
  return `<h1 class="kc-h1" style="margin:0 0 18px;font-family:${FONT};font-size:24px;line-height:1.25;font-weight:600;letter-spacing:-0.02em;color:${C.ink}">${escapeHtml(content.heading)}</h1>
${greetingHtml ? `<p class="kc-text" style="${BODY_P}">${greetingHtml}</p>` : ""}
${paragraphs(content.intro)}
${renderDetailsTable(content.details)}
${renderButton(content.action)}
${paragraphs(content.outro)}
${content.note ? `<p class="kc-muted kc-rule" style="margin:22px 0 0;padding-top:16px;border-top:1px dashed ${C.rule};font-size:13px;line-height:1.55;color:${C.muted}">${escapeHtml(content.note)}</p>` : ""}`;
}

export interface EmailShellInput {
  subject: string;
  preheader: string;
  bodyHtml: string;
  replyMarker?: string;
  /** Mono uppercase micro-label above the body (template group, e.g. "Sipariş ve fatura"). */
  eyebrow?: string;
  /** Replaces the default footer line (why the mail was sent). */
  footerNote?: string;
  /** Marketing mail only: unsubscribe link in the footer. */
  unsubscribeUrl?: string;
}

export interface EmailShellOptions {
  logoSrc: string;
}

function renderFooter(input: EmailShellInput, brand: NotificationBrand) {
  const link = (href: string, label: string) =>
    `<a href="${escapeHtml(safeUrl(href))}" target="_blank" style="color:${C.muted};text-decoration:underline">${escapeHtml(label)}</a>`;
  const site = brand.siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const contact = [
    brand.supportEmail ? `Destek: ${link(`mailto:${brand.supportEmail}`, brand.supportEmail)}` : "",
    brand.companyPhone ? escapeHtml(brand.companyPhone) : "",
    site ? link(brand.siteUrl, site) : "",
  ].filter(Boolean);
  const p = (html: string, extra = "") => `<p style="margin:0 0 4px;${extra}">${html}</p>`;
  return [
    p(escapeHtml(brand.companyName), `font-family:${MONO};font-size:11px;letter-spacing:0.12em;text-transform:uppercase;font-weight:600`),
    brand.companyAddress ? p(escapeHtml(brand.companyAddress)) : "",
    contact.length ? p(contact.join(" &middot; ")) : "",
    `<p style="margin:12px 0 0">${escapeHtml(input.footerNote ?? "Bu e-posta hesabınızla ilgili bir işlem nedeniyle otomatik olarak gönderilmiştir.")}</p>`,
    input.unsubscribeUrl
      ? `<p style="margin:8px 0 0">${link(input.unsubscribeUrl, "Kampanya e-postalarından çık")}</p>`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * The branded shell around a card body: dark header with the logo, white
 * card, company footer. Shared by the typed TS templates, admin-edited (DB)
 * templates and broadcasts, so all of them look the same. 600px, fluid on
 * phones, a fixed-width ghost table for Outlook desktop.
 */
export function renderEmailShell(input: EmailShellInput, brand: NotificationBrand, options: EmailShellOptions) {
  const siteHref = escapeHtml(safeUrl(brand.siteUrl));
  const eyebrow = input.eyebrow?.trim();

  return `<!doctype html>
<html lang="tr" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no,url=no" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>${escapeHtml(input.subject)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>${HEAD_STYLE}</style>
</head>
<body class="kc-page" style="margin:0;padding:0;background-color:${C.page};font-family:${FONT};color:${C.text}">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${escapeHtml(input.preheader)}${PREHEADER_FILLER}</div>
${input.replyMarker ? `<p class="kc-muted" style="margin:0;padding:12px 16px 0;font-family:${FONT};font-size:12px;color:${C.muted};text-align:center">${escapeHtml(input.replyMarker)}</p>` : ""}
<table role="presentation" class="kc-page" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:${C.page}">
<tr><td class="kc-outer" align="center" style="padding:32px 16px 40px">
<!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;margin:0 auto;border-collapse:separate">
<tr><td class="kc-head" bgcolor="${C.ink}" style="background-color:${C.ink};border:1px solid ${C.ink};border-radius:12px 12px 0 0;padding:22px 32px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="vertical-align:middle"><a href="${siteHref}" target="_blank" style="text-decoration:none"><img src="${escapeHtml(options.logoSrc)}" width="${LOGO_WIDTH}" height="${LOGO_HEIGHT}" alt="${escapeHtml(brand.siteName)}" style="display:block;width:${LOGO_WIDTH}px;height:${LOGO_HEIGHT}px;border:0;color:${C.onInk};font-family:${FONT};font-size:18px;font-weight:700;letter-spacing:2px" /></a></td>
${eyebrow ? `<td align="right" style="vertical-align:middle;padding-left:12px;font-family:${MONO};font-size:10px;line-height:1.4;letter-spacing:0.14em;text-transform:uppercase;color:${C.onInkMuted}">${escapeHtml(eyebrow)}</td>` : ""}
</tr></table>
</td></tr>
<tr><td class="kc-card kc-pad kc-body" bgcolor="${C.card}" style="background-color:${C.card};border:1px solid ${C.border};border-top:0;border-radius:0 0 12px 12px;padding:36px 36px 32px;font-family:${FONT};font-size:15px;line-height:1.6;color:${C.text}">
${input.bodyHtml}
</td></tr>
<tr><td class="kc-foot kc-muted" style="padding:24px 32px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.muted};text-align:center">
${renderFooter(input, brand)}
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;
}

/**
 * Branded, monochrome, table-based HTML (renders in Gmail/Outlook) plus a
 * plain-text alternative. No remote images, pixels or link rewriting: the
 * logo is an inline CID attachment (or a data URI in the admin preview).
 */
export function renderEmailLayout(
  content: EmailContent,
  brand: NotificationBrand,
  options: EmailShellOptions & { eyebrow?: string }
): RenderedEmail {
  const greeting = greetingLine(content);
  const preheader = content.preheader ?? content.intro[0] ?? content.heading;
  const html = renderEmailShell(
    {
      subject: content.subject,
      preheader,
      bodyHtml: renderEmailBody(content),
      replyMarker: content.replyMarker,
      eyebrow: options.eyebrow,
    },
    brand,
    options
  );
  const text = renderText(content, brand, greeting);
  return { subject: content.subject, preheader, html, text };
}

/**
 * Staff-authored body (broadcasts) in the branded shell. `bodyHtml` must be
 * sanitised already; the text part gets the company footer and, for
 * marketing mail, the unsubscribe link.
 */
export function renderRawEmail(
  content: {
    subject: string;
    preheader: string;
    bodyHtml: string;
    text: string;
    footerNote?: string;
    unsubscribeUrl?: string;
  },
  brand: NotificationBrand,
  options: EmailShellOptions & { eyebrow?: string }
): RenderedEmail {
  const html = renderEmailShell({ ...content, eyebrow: options.eyebrow }, brand, options);
  const lines = [content.text.trim(), "", "—", ...footerLines(brand)];
  if (content.unsubscribeUrl) lines.push("", `Kampanya e-postalarından çıkmak için: ${content.unsubscribeUrl}`);
  return {
    subject: content.subject,
    preheader: content.preheader,
    html,
    text: lines.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
  };
}

/** Plain-text footer appended to admin-edited templates' text part. */
export function textFooter(brand: NotificationBrand) {
  return ["—", ...footerLines(brand)].join("\n");
}

/** Plain-text body lines of a structured template (no footer). */
export function renderTextBody(content: EmailContent, greeting: string | null = greetingLine(content)) {
  const lines: string[] = [content.heading, ""];
  if (greeting) lines.push(greeting, "");
  for (const line of content.intro) lines.push(line);
  if (content.details?.length) {
    lines.push("");
    for (const detail of content.details) lines.push(`${detail.label}: ${detail.value}`);
  }
  if (content.action) lines.push("", `${content.action.label}: ${content.action.url}`);
  if (content.outro?.length) lines.push("", ...content.outro);
  if (content.note) lines.push("", content.note);
  return lines;
}

function renderText(content: EmailContent, brand: NotificationBrand, greeting: string | null) {
  const lines = [
    ...(content.replyMarker ? [content.replyMarker, ""] : []),
    ...renderTextBody(content, greeting),
    "",
    "—",
    ...footerLines(brand),
  ];
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
