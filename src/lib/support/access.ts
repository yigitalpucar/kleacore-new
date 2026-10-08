import { hasPermission } from "@/lib/auth/permissions";

/**
 * Who may see a ticket (and its attachments): staff holding tickets.view
 * (ADMIN, SUPPORT — src/lib/auth/permissions.ts), or the ticket's customer.
 */
export function isSupportStaff(role: string | null | undefined): boolean {
  return hasPermission(role, "tickets.view");
}

/** Staff who may answer tickets (reply with attachments, canned replies). */
export function canReplyToTickets(role: string | null | undefined): boolean {
  return hasPermission(role, "tickets.reply");
}

export interface TicketViewer {
  id: string;
  role?: string | null;
}

export function canAccessTicket(viewer: TicketViewer | null | undefined, ticket: { customerId: string | null }) {
  if (!viewer?.id) return false;
  if (isSupportStaff(viewer.role)) return true;
  return ticket.customerId !== null && ticket.customerId === viewer.id;
}
