import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getTicketWithMessages } from "@/lib/dal/tickets";
import { DestekDetayContent } from "./content";

export const dynamic = "force-dynamic";

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
    customer: ticket.customer,
    messages: ticket.messages.map((msg) => ({
      id: msg.id,
      senderId: msg.senderId,
      senderName: msg.senderName,
      senderRole: msg.senderRole,
      message: msg.message,
      attachments: msg.attachments as Array<{
        name: string;
        size: string;
        type: "image" | "document";
      }>,
      createdAt: msg.createdAt.toISOString(),
    })),
  };

  return <DestekDetayContent ticket={serializedTicket} />;
}
