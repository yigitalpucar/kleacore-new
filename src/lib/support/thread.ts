/**
 * Ticket ↔ e-mail threading: outgoing ticket mails carry "[#T-123456]" in the
 * subject, a Message-ID of the form `<ticket.T-123456.<random>@domain>` and a
 * reply-above marker; inbound mail is matched back with the helpers below.
 * Pure functions (shared by notification templates and the IMAP poller).
 */

export const REPLY_MARKER = "##- Yanıtınızı bu satırın üstüne yazın -##";

/** Matches the marker even when a mail client quoted it ("> ##- …"). */
export const REPLY_MARKER_PATTERN = /^[>\s]*##-\s*Yan[ıi]t[ıi]n[ıi]z[ıi] bu sat[ıi]r[ıi]n [üu]st[üu]ne yaz[ıi]n\s*-##/im;

const TICKET_NUMBER = String.raw`T-\d{6,10}`;

export function ticketSubjectTag(ticketNumber: string) {
  return `[#${ticketNumber}]`;
}

export function ticketMessageIdTag(ticketNumber: string) {
  return `ticket.${ticketNumber}`;
}

/** "[#T-123456]" (also "[T-123456]" and "#T-123456") anywhere in the subject. */
export function ticketNumberFromSubject(subject: string | null | undefined): string | null {
  if (!subject) return null;
  const match =
    subject.match(new RegExp(String.raw`\[#?(${TICKET_NUMBER})\]`, "i")) ??
    subject.match(new RegExp(String.raw`(?:^|[\s(])#(${TICKET_NUMBER})\b`, "i"));
  return match ? match[1].toUpperCase() : null;
}

/** Ticket number embedded in our own Message-IDs found in In-Reply-To / References. */
export function ticketNumberFromMessageIds(ids: string[]): string | null {
  const pattern = new RegExp(String.raw`<?ticket\.(${TICKET_NUMBER})\.[^@>\s]*@`, "i");
  for (const id of ids) {
    const match = id.match(pattern);
    if (match) return match[1].toUpperCase();
  }
  return null;
}
