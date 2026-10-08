import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getTicketWithMessages } from "@/lib/dal/tickets";
import { serializeThreadMessage } from "@/lib/support/serialize";
import { DestekDetayContent } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Destek talebi" };

interface DestekDetayPageProps {
  params: Promise<{ id: string }>;
}

export default async function DestekDetayPage(props: DestekDetayPageProps) {
  const session = await auth();
  const params = await props.params;
  const ticket = await getTicketWithMessages(params.id);

  if (!ticket || ticket.customerId !== session!.user.id) {
    notFound();
  }

  // Tarihleri ve mesajlari serialize et
  const serializedTicket = {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    department: ticket.department,
    priority: ticket.priority,
    status: ticket.status,
    relatedServiceId: ticket.relatedServiceId,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    closedAt: ticket.closedAt?.toISOString() ?? null,
    messages: ticket.messages.map(serializeThreadMessage),
  };

  return <DestekDetayContent ticket={serializedTicket} />;
}
