import { createHash } from "node:crypto";
import { simpleParser, type ParsedMail } from "mailparser";
import { sanitizeFileName } from "@/lib/support/attachments";
import type { InboundMessage } from "./types";

function splitIds(value: string | string[] | undefined): string[] {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list.flatMap((v) => v.match(/<[^<>\s]+>/g) ?? (v.trim() ? [v.trim()] : []));
}

/** Raw header lines → lowercase name → unfolded value (first occurrence wins). */
function rawHeaders(parsed: ParsedMail): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const { key, line } of parsed.headerLines ?? []) {
    const name = key.toLowerCase();
    if (name in headers) continue;
    const colon = line.indexOf(":");
    headers[name] = (colon >= 0 ? line.slice(colon + 1) : line).replace(/\r?\n[ \t]+/g, " ").trim();
  }
  return headers;
}

/**
 * Normalises a parsed MIME message. HTML-only mail is already converted to
 * text by mailparser (scripts/styles dropped); only that text is ever stored
 * and it is rendered as plain text, never as HTML.
 */
export function toInboundMessage(parsed: ParsedMail, raw: Buffer, fallbackDate = new Date()): InboundMessage {
  const from = parsed.from?.value?.[0];
  const headers = rawHeaders(parsed);
  const messageId =
    parsed.messageId?.trim() || `<no-id.${createHash("sha256").update(raw).digest("hex").slice(0, 40)}@inbound.kleacore>`;
  return {
    messageId: messageId.slice(0, 990),
    from: { address: (from?.address ?? "").trim(), name: from?.name?.trim() || null },
    subject: (parsed.subject ?? "").trim(),
    text: parsed.text ?? "",
    inReplyTo: splitIds(parsed.inReplyTo),
    references: splitIds(parsed.references),
    headers,
    contentType: headers["content-type"]?.split(";")[0]?.trim().toLowerCase() ?? null,
    attachments: (parsed.attachments ?? []).map((a) => ({
      fileName: sanitizeFileName(a.filename ?? "ek"),
      content: a.content,
      related: !!a.related,
    })),
    receivedAt: parsed.date ?? fallbackDate,
  };
}

export async function parseRawEmail(raw: Buffer): Promise<InboundMessage> {
  const parsed = await simpleParser(raw, { skipTextToHtml: true, skipImageLinks: true });
  return toInboundMessage(parsed, raw);
}
