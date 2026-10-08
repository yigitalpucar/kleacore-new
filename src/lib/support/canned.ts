/**
 * Canned reply variables. Rendered on the staff reply screen when a canned
 * reply is inserted (the staff member still edits / sends the text).
 * Unknown variables are left untouched so a typo stays visible.
 */
export const CANNED_REPLY_VARIABLES = [
  { key: "customer.name", label: "Müşteri adı soyadı" },
  { key: "customer.firstName", label: "Müşteri adı" },
  { key: "customer.email", label: "Müşteri e-postası" },
  { key: "ticket.number", label: "Talep numarası" },
  { key: "ticket.subject", label: "Talep konusu" },
  { key: "staff.name", label: "Yanıtlayan personel" },
] as const;

export type CannedReplyVariable = (typeof CANNED_REPLY_VARIABLES)[number]["key"];
export type CannedReplyContext = Partial<Record<CannedReplyVariable, string>>;

export function renderCannedReply(body: string, context: CannedReplyContext): string {
  return body.replace(/\{\{\s*([a-zA-Z]+\.[a-zA-Z]+)\s*\}\}/g, (match, key: string) => {
    const value = context[key as CannedReplyVariable];
    return value === undefined ? match : value;
  });
}
