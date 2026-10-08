import type { Metadata } from "next";
import { getTickets } from "@/lib/dal/tickets";
import { parsePagination } from "@/lib/utils/pagination";
import { DestekContent, type AdminTicketRow } from "./content";
import type { TicketStatus, TicketPriority, TicketDepartment } from "@prisma/client";
import { requirePermission } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Destek talepleri" };

const validStatuses: TicketStatus[] = ["OPEN", "CUSTOMER_REPLY", "ADMIN_REPLY", "WAITING", "CLOSED"];
const validPriorities: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const validDepartments: TicketDepartment[] = ["GENERAL", "TECHNICAL", "BILLING", "SALES"];

export default async function DestekPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("tickets.view");
  const sp = await searchParams;
  const params = parsePagination(sp);
  // Lists show 100 rows per server page unless ?perPage= is given.
  const perPage = sp.perPage ? params.perPage : 100;

  const status = validStatuses.includes(sp.status as TicketStatus)
    ? (sp.status as TicketStatus)
    : undefined;
  const priority = validPriorities.includes(sp.priority as TicketPriority)
    ? (sp.priority as TicketPriority)
    : undefined;
  const department = validDepartments.includes(sp.department as TicketDepartment)
    ? (sp.department as TicketDepartment)
    : undefined;

  const result = await getTickets({ ...params, perPage, status, priority, department });

  const rows: AdminTicketRow[] = result.data.map((t) => ({
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
    customer: {
      id: t.customer.id,
      name: `${t.customer.name} ${t.customer.surname}`.trim(),
      email: t.customer.email,
    },
  }));

  return (
    <DestekContent
      data={rows}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
      serverFilters={{ status, priority, department }}
    />
  );
}
