import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTicketWithMessages } from "@/lib/dal/tickets";
import { getAdminUsers } from "@/lib/dal/settings";
import { TicketDetailContent, type AdminTicketDetail } from "./content";
import { requirePermission } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Destek talebi" };

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("tickets.view");
  const { id } = await params;
  const [ticket, adminUsers] = await Promise.all([
    getTicketWithMessages(id),
    getAdminUsers(),
  ]);

  if (!ticket) return notFound();

  const data: AdminTicketDetail = {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    department: ticket.department,
    priority: ticket.priority,
    status: ticket.status,
    assignedTo: ticket.assignedTo,
    relatedServiceId: ticket.relatedServiceId,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    closedAt: ticket.closedAt ? ticket.closedAt.toISOString() : null,
    customer: ticket.customer,
    messages: ticket.messages.map((m) => ({
      id: m.id,
      senderName: m.senderName,
      senderRole: m.senderRole,
      message: m.message,
      createdAt: m.createdAt.toISOString(),
    })),
  };

  return (
    <TicketDetailContent
      ticket={data}
      adminUsers={adminUsers.map((a) => ({ id: a.id, name: a.name, surname: a.surname, email: a.email }))}
    />
  );
}
