import type { Metadata } from "next";
import { getTickets } from "@/lib/dal/tickets";
import { parsePagination } from "@/lib/utils/pagination";
import { DestekContent } from "./content";
import { toAdminTicketRow } from "./ticket-rows";
import type { TicketStatus, TicketPriority, TicketDepartment } from "@prisma/client";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/utils/auth-helpers";
import { listCapabilities } from "@/lib/admin/list-views";
import { getAdminUsers } from "@/lib/dal/settings";

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
  const session = await requirePermission("tickets.view");
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

  const capabilities = listCapabilities(session.user.role, "tickets");
  const [result, staff] = await Promise.all([
    getTickets({ ...params, perPage, status, priority, department }),
    capabilities.bulk.includes("assign") ? getAdminUsers() : Promise.resolve([]),
  ]);

  const rows = result.data.map(toAdminTicketRow);

  return (
    <DestekContent
      data={rows}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
      serverFilters={{ status, priority, department }}
      capabilities={capabilities}
      staff={staff.map((u) => ({ id: u.id, name: `${u.name} ${u.surname}`.trim() || u.email }))}
      links={{
        cannedReplies: hasPermission(session.user.role, "tickets.reply"),
        settings: hasPermission(session.user.role, "settings.manage"),
      }}
    />
  );
}
