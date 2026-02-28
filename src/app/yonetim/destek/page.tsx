import { getTickets } from "@/lib/dal/tickets";
import { parsePagination } from "@/lib/utils/pagination";
import { DestekContent } from "./content";
import type { TicketStatus, TicketPriority, TicketDepartment } from "@prisma/client";

const validStatuses: TicketStatus[] = ["OPEN", "CUSTOMER_REPLY", "ADMIN_REPLY", "WAITING", "CLOSED"];
const validPriorities: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const validDepartments: TicketDepartment[] = ["GENERAL", "TECHNICAL", "BILLING", "SALES"];

export default async function DestekPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = parsePagination(sp);

  const status = validStatuses.includes(sp.status as TicketStatus)
    ? (sp.status as TicketStatus)
    : undefined;
  const priority = validPriorities.includes(sp.priority as TicketPriority)
    ? (sp.priority as TicketPriority)
    : undefined;
  const department = validDepartments.includes(sp.department as TicketDepartment)
    ? (sp.department as TicketDepartment)
    : undefined;

  const result = await getTickets({ ...params, status, priority, department });

  return <DestekContent data={result.data} total={result.total} />;
}
