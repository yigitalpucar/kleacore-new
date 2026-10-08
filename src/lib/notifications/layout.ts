import { LOGO_HEIGHT, LOGO_WIDTH } from "./logo";
import type { EmailContent, NotificationBrand } from "./templates/types";

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
function safeUrl(url: string) {
  return /^(https?:|mailto:)/i.test(url.trim()) ? url.trim() : "#";
}

const COLORS = {
  page: "#f4f4f5",
  card: "#ffffff",
  border: "#e4e4e7",
  text: "#18181b",
  muted: "#71717a",
  ink: "#09090b",
  soft: "#fafafa",
};

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

function greetingLine(content: EmailContent) {
  if (content.greetingName === null) return null;
  const name = content.greetingName?.trim();
  return name ? `Merhaba ${name},` : "Merhaba,";
}

function paragraphs(lines: string[] | undefined, style: string) {
  return (lines ?? [])
    .filter((line) => line.trim())
    .map((line) => `<p style="${style}">${escapeHtml(line)}</p>`)
    .join("");
}

function detailsTable(content: EmailContent) {
  if (!content.details?.length) return "";
  const rows = content.details
    .map((detail, index) => {
      const border = index === 0 ? "" : `border-top:1px solid ${COLORS.border};`;
      const valueFont = detail.mono ? `font-family:${MONO};font-size:13px;` : "font-size:14px;";
      return `<tr>
<td style="${border}padding:10px 14px;color:${COLORS.muted};font-size:13px;width:42%;vertical-align:top">${escapeHtml(detail.label)}</td>
<td style="${border}padding:10px 14px;color:${COLORS.text};${valueFont}font-weight:600;word-break:break-all;vertical-align:top">${escapeHtml(detail.value)}</td>
</tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${COLORS.border};border-radius:8px;border-collapse:separate;background:${COLORS.soft};margin:20px 0">${rows}</table>`;
}

function actionButton(content: EmailContent) {
  if (!content.action) return "";
  const href = escapeHtml(safeUrl(content.action.url));
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px"><tr>
<td style="border-radius:8px;background:${COLORS.ink}">
<a href="${href}" style="display:inline-block;padding:12px 20px;font-family:${FONT};font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px">${escapeHtml(content.action.label)}</a>
</td></tr></table>
<p style="margin:0 0 8px;font-size:12px;color:${COLORS.muted};word-break:break-all">Buton çalışmazsa bu bağlantıyı tarayıcınıza yapıştırın:<br />${escapeHtml(content.action.url)}</p>`;
}

function footerLines(brand: NotificationBrand) {
  return [
    brand.companyName,
    brand.companyAddress,
    [brand.supportEmail && `Destek: ${brand.supportEmail}`, brand.companyPhone].filter(Boolean).join(" · "),
  ].filter((line) => line && line.trim());
}

/**
 * Branded, monochrome, table-based HTML (renders in Gmail/Outlook) plus a
 * plain-text alternative. No remote images, pixels or link rewriting: the
 * logo is an inline CID attachment (or a data URI in the admin preview).
 */
export function renderEmailLayout(
  content: EmailContent,
  brand: NotificationBrand,
  options: { logoSrc: string }
): RenderedEmail {
  const greeting = greetingLine(content);
  const preheader = content.preheader ?? content.intro[0] ?? content.heading;
  const bodyStyle = `margin:0 0 14px;font-size:15px;line-height:1.6;color:${COLORS.text}`;
  const siteHref = escapeHtml(safeUrl(brand.siteUrl));
  const footer = footerLines(brand)
    .map((line) => `<p style="margin:0 0 4px">${escapeHtml(line)}</p>`)
    .join("");

  const html = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light" />
<title>${escapeHtml(content.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.page};font-family:${FONT};color:${COLORS.text}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.page}">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td style="background:${COLORS.ink};border-radius:12px 12px 0 0;padding:22px 32px">
<a href="${siteHref}" style="text-decoration:none"><img src="${escapeHtml(options.logoSrc)}" width="${LOGO_WIDTH}" height="${LOGO_HEIGHT}" alt="${escapeHtml(brand.siteName)}" style="display:block;border:0;color:#ffffff;font-family:${FONT};font-size:18px;font-weight:700;letter-spacing:2px" /></a>
</td></tr>
<tr><td style="background:${COLORS.card};border:1px solid ${COLORS.border};border-top:0;border-radius:0 0 12px 12px;padding:32px">
<h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;font-weight:700;color:${COLORS.ink}">${escapeHtml(content.heading)}</h1>
${greeting ? `<p style="${bodyStyle}">${escapeHtml(greeting)}</p>` : ""}
${paragraphs(content.intro, bodyStyle)}
${detailsTable(content)}
${actionButton(content)}
${paragraphs(content.outro, bodyStyle)}
${content.note ? `<p style="margin:20px 0 0;padding-top:16px;border-top:1px dashed ${COLORS.border};font-size:13px;line-height:1.5;color:${COLORS.muted}">${escapeHtml(content.note)}</p>` : ""}
</td></tr>
<tr><td style="padding:20px 32px;font-size:12px;line-height:1.5;color:${COLORS.muted};text-align:center">
${footer}
<p style="margin:8px 0 0">Bu e-posta hesabınızla ilgili bir işlem nedeniyle otomatik olarak gönderilmiştir.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = renderText(content, brand, greeting);
  return { subject: content.subject, preheader, html, text };
}

function renderText(content: EmailContent, brand: NotificationBrand, greeting: string | null) {
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
  lines.push("", "—", ...footerLines(brand));
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
