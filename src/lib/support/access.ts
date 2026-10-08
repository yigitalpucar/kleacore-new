/**
 * Who may see a ticket (and its attachments). Staff roles: ADMIN today;
 * SUPPORT is listed for the staff-roles work (3.6) — compared as strings so
 * this compiles before and after that enum change.
 */
const SUPPORT_STAFF_ROLES: ReadonlySet<string> = new Set(["ADMIN", "SUPPORT"]);

export function isSupportStaff(role: string | null | undefined): boolean {
  return !!role && SUPPORT_STAFF_ROLES.has(role);
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
