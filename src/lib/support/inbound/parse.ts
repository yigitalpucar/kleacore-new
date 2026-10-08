import { REPLY_MARKER_PATTERN } from "@/lib/support/thread";
import type { InboundMessage } from "./types";

// ── loop protection ────────────────────────────────────────────────────────

const BOUNCE_LOCAL_PARTS = /^(mailer-daemon|postmaster|no-?reply|do-?not-?reply|donotreply|bounces?|auto-?reply|autoresponder)([+.-].*)?$/i;

const AUTO_SUBJECT =
  /^\s*(auto(matic)?[\s-]*(reply|response|antwort)|out of (the )?office|ofis dışında|otomatik (yanıt|cevap)|abwesenheit|undeliverable|undelivered mail|delivery status notification|mail delivery (failed|subsystem)|returned mail|teslim edilemedi|iletilemedi)\b/i;

/**
 * Why a message must not become a ticket or reply (auto-responders, bounces,
 * mailing lists), or null. Answering those would start a mail loop.
 */
export function autoReplyReason(message: Pick<InboundMessage, "headers" | "from" | "subject" | "contentType">): string | null {
  const h = message.headers;
  const autoSubmitted = h["auto-submitted"]?.trim().toLowerCase();
  if (autoSubmitted && autoSubmitted !== "no") return "AUTO_SUBMITTED";
  if (h["x-autoreply"] || h["x-autorespond"] || h["x-autoreply-from"] || h["x-mail-autoreply"]) return "X_AUTOREPLY";
  if (/^(bulk|junk|list|auto_reply)$/i.test(h["precedence"]?.trim() ?? "")) return "PRECEDENCE";
  if (h["list-id"] || h["list-unsubscribe"]) return "MAILING_LIST";
  if (h["x-failed-recipients"]) return "BOUNCE";
  if ((h["return-path"] ?? "").replace(/\s/g, "") === "<>") return "BOUNCE";
  if (message.contentType?.toLowerCase().startsWith("multipart/report")) return "DELIVERY_REPORT";
  const local = message.from.address.split("@")[0] ?? "";
  if (BOUNCE_LOCAL_PARTS.test(local)) return "SYSTEM_SENDER";
  if (AUTO_SUBJECT.test(message.subject)) return "AUTO_SUBJECT";
  return null;
}

// ── subject ────────────────────────────────────────────────────────────────

/** "Re: Fwd: [#T-123456] Konu" → "Konu" (for new tickets). */
export function cleanSubject(subject: string): string {
  let s = subject.replace(/\[#?T-\d{6,10}\]/gi, " ");
  for (let i = 0; i < 5; i++) {
    const next = s.replace(/^\s*(re|fw|fwd|ynt|yanıt|yanit|cevap|ilt|ilet|İlt|İLT|İlet|İLET|YANIT|aw|wg|sv)\s*(\[\d+\])?\s*:\s*/i, "");
    if (next === s) break;
    s = next;
  }
  return s.replace(/\s+/g, " ").trim();
}

// ── quoted reply / signature stripping ─────────────────────────────────────

const QUOTE_HEADER_PATTERNS: RegExp[] = [
  // English (Gmail, Apple Mail, Thunderbird): "On Mon, 6 Oct 2026 at 10:00, Ayşe <a@b.c> wrote:"
  /^\s*On\s.{1,300}\swrote:\s*$/i,
  // Turkish Gmail: "6 Eki 2026 Pzt, 10:00 tarihinde Ayşe <a@b.c> şunu yazdı:"
  /^.{0,300}\btarihinde\b.{0,300}\byazdı:\s*$/i,
  /^.{0,300}\bşunu yazdı:\s*$/i,
  // Outlook / Exchange separators
  /^\s*-{2,}\s*(Original Message|Orijinal İleti|Özgün İleti|Forwarded message|İletilen ileti|Ursprüngliche Nachricht)\s*-{2,}/i,
  /^\s*_{10,}\s*$/,
  /^\s*Begin forwarded message:/i,
];

const OUTLOOK_FROM = /^\s*\*?(From|Kimden|Gönderen|Von)\s*:\*?\s+\S/i;
const OUTLOOK_FIELD = /^\s*\*?(Sent|Date|Gönderildi|Gönderilme|Tarih|To|Kime|Alıcı|Subject|Konu|Cc|Bilgi|Gesendet|An|Betreff)\s*:/i;

const SIGNATURE_PATTERNS: RegExp[] = [
  /^-- ?$/, // RFC 3676 signature separator
  /^\s*(Sent from my (iPhone|iPad|Android|mobile device)|Get Outlook for (iOS|Android))/i,
  /^\s*(iPhone'?umdan|iPad'?imden|Android'?imden|Mobil cihaz(ım)?dan) gönderildi/i,
];

function isOutlookHeaderBlock(lines: string[], index: number) {
  if (!OUTLOOK_FROM.test(lines[index])) return false;
  let fields = 0;
  for (let j = index + 1; j < Math.min(lines.length, index + 6); j++) {
    if (OUTLOOK_FIELD.test(lines[j])) fields++;
  }
  return fields >= 2;
}

/**
 * Keeps only the new part of a reply: cuts at our reply-above marker, the
 * first quote header ("On … wrote:", "… tarihinde … yazdı:", Outlook
 * "From:/Sent:/To:" block, "-----Original Message-----"), a "-- " signature
 * or mobile footer, and drops a trailing ">" quoted block. Falls back to
 * the full text if nothing would remain.
 */
export function stripQuotedReply(text: string): string {
  const normalized = text.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  let cut = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (REPLY_MARKER_PATTERN.test(line)) {
      cut = i;
      break;
    }
    // A quote header may wrap onto the next line ("On … <a@b>\nwrote:").
    const joined = i + 1 < lines.length ? `${line} ${lines[i + 1].trim()}` : line;
    if (QUOTE_HEADER_PATTERNS.some((p) => p.test(line)) || (/^\s*On\s/i.test(line) && /\swrote:\s*$/i.test(joined))) {
      cut = i;
      break;
    }
    if (/\btarihinde\b/i.test(line) && i + 1 < lines.length && /yazdı:\s*$/i.test(joined)) {
      cut = i;
      break;
    }
    if (isOutlookHeaderBlock(lines, i)) {
      cut = i;
      break;
    }
    if (SIGNATURE_PATTERNS.some((p) => p.test(line))) {
      cut = i;
      break;
    }
  }

  const kept = lines.slice(0, cut);
  // Trailing quoted block ("> …" lines, possibly with blank lines between).
  while (kept.length && (kept[kept.length - 1].trim() === "" || /^\s*>/.test(kept[kept.length - 1]))) kept.pop();

  const result = kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return result || normalized.trim();
}
