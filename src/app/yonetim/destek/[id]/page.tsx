import { getTicketWithMessages } from "@/lib/dal/tickets";
import { getAdminUsers } from "@/lib/dal/settings";
import { notFound } from "next/navigation";
import { TicketDetailContent } from "./content";

export const dynamic = "force-dynamic";

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [ticket, adminUsers] = await Promise.all([
    getTicketWithMessages(id),
    getAdminUsers(),
  ]);

  if (!ticket) return notFound();

  return <TicketDetailContent ticket={ticket} adminUsers={adminUsers} />;
}
