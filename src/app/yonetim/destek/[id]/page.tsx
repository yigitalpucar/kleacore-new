import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTicketWithMessages } from "@/lib/dal/tickets";
import { getAdminUsers } from "@/lib/dal/settings";
import { serializeThreadMessage } from "@/lib/support/serialize";
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
  const [ticket, adminUsers, cannedReplies, session] = await Promise.all([
    getTicketWithMessages(id),
    getAdminUsers(),
    db.cannedReply.findMany({
      orderBy: [{ usageCount: "desc" }, { title: "asc" }],
      select: { id: true, title: true, body: true, department: true },
    }),
    auth(),
  ]);

  if (!ticket) return notFound();

  const staff = session?.user?.id
    ? await db.user.findUnique({ where: { id: session.user.id }, select: { name: true, surname: true } })
    : null;

  const data: AdminTicketDetail = {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    department: ticket.department,
    priority: ticket.priority,
    status: ticket.status,
    source: ticket.source,
    assignedTo: ticket.assignedTo,
    relatedServiceId: ticket.relatedServiceId,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    closedAt: ticket.closedAt ? ticket.closedAt.toISOString() : null,
    waitingSince: ticket.waitingSince ? ticket.waitingSince.toISOString() : null,
    customer: ticket.customer,
    guest: ticket.customer ? null : { email: ticket.guestEmail ?? "", name: ticket.guestName },
    messages: ticket.messages.map(serializeThreadMessage),
  };

  return (
    <TicketDetailContent
      ticket={data}
      adminUsers={adminUsers.map((a) => ({ id: a.id, name: a.name, surname: a.surname, email: a.email }))}
      cannedReplies={cannedReplies.filter((r) => !r.department || r.department === ticket.department)}
      staffName={staff ? `${staff.name} ${staff.surname}`.trim() : ""}
    />
  );
}
