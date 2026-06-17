import { auth } from "@/lib/auth";
import { getTicketsByCustomer } from "@/lib/dal/tickets";
import { DestekListContent } from "./content";

export const dynamic = "force-dynamic";

export default async function DestekPage() {
  const session = await auth();
  const tickets = await getTicketsByCustomer(session!.user.id);

  // Tarihleri serialize et
  const serializedTickets = tickets.map((ticket) => ({
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    department: ticket.department,
    priority: ticket.priority,
    status: ticket.status,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    messageCount: ticket._count.messages,
  }));

  return <DestekListContent tickets={serializedTickets} />;
}
