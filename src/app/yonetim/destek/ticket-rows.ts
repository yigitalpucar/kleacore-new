import type { getTickets } from "@/lib/dal/tickets";

export interface AdminTicketRow {
  id: string;
  ticketNumber: string;
  subject: string;
  department: string;
  priority: string;
  status: string;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  source: string;
  /** id null = e-mail from an address that matches no verified customer. */
  customer: { id: string | null; name: string; email: string };
}

type TicketListItem = Awaited<ReturnType<typeof getTickets>>["data"][number];

export function toAdminTicketRow(t: TicketListItem): AdminTicketRow {
  return {
    id: t.id,
    ticketNumber: t.ticketNumber,
    subject: t.subject,
    department: t.department,
    priority: t.priority,
    status: t.status,
    assignedTo: t.assignedTo,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    messageCount: t._count.messages,
    source: t.source,
    customer: t.customer
      ? { id: t.customer.id, name: `${t.customer.name} ${t.customer.surname}`.trim(), email: t.customer.email }
      : { id: null, name: t.guestName || t.guestEmail || "Bilinmeyen gönderen", email: t.guestEmail ?? "" },
  };
}

const lower = (s: string) => s.toLocaleLowerCase("tr-TR");

/** `q` is already lower-cased. */
export function ticketSearch(t: AdminTicketRow, q: string) {
  return (
    lower(t.subject).includes(q) ||
    lower(t.ticketNumber).includes(q) ||
    lower(t.customer.name).includes(q) ||
    lower(t.customer.email).includes(q)
  );
}

export const TICKET_FILTER_VALUES: Record<string, (t: AdminTicketRow) => string> = {
  status: (t) => t.status,
  priority: (t) => t.priority,
  department: (t) => t.department,
};
