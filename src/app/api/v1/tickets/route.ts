import { NextRequest } from "next/server";
import { authenticateApiRequest } from "@/lib/api/v1/auth";
import { serializeTicketSummary } from "@/lib/api/v1/serialize";
import { db } from "@/lib/db";
import { getTickets } from "@/lib/dal/tickets";
import { generateTicketNumber } from "@/lib/utils/number-generators";
import {
  error,
  success,
  unauthorized,
  validationError,
} from "@/lib/utils/api-response";
import { parsePagination } from "@/lib/utils/pagination";
import { ticketCreateSchema } from "@/lib/validations/ticket";
import type { TicketDepartment, TicketPriority, TicketStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedStatuses = new Set<TicketStatus>([
  "OPEN",
  "CUSTOMER_REPLY",
  "ADMIN_REPLY",
  "WAITING",
  "CLOSED",
]);

const allowedPriorities = new Set<TicketPriority>([
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
]);

const allowedDepartments = new Set<TicketDepartment>([
  "GENERAL",
  "TECHNICAL",
  "BILLING",
  "SALES",
]);

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (!auth) {
    return unauthorized("Geçersiz veya eksik API anahtarı");
  }

  const { searchParams } = new URL(request.url);
  const pagination = parsePagination(
    Object.fromEntries(searchParams.entries())
  );

  const statusParam = searchParams.get("status");
  const priorityParam = searchParams.get("priority");
  const departmentParam = searchParams.get("department");

  const status =
    statusParam && allowedStatuses.has(statusParam as TicketStatus)
      ? (statusParam as TicketStatus)
      : undefined;
  const priority =
    priorityParam && allowedPriorities.has(priorityParam as TicketPriority)
      ? (priorityParam as TicketPriority)
      : undefined;
  const department =
    departmentParam && allowedDepartments.has(departmentParam as TicketDepartment)
      ? (departmentParam as TicketDepartment)
      : undefined;

  const result = await getTickets({
    ...pagination,
    status,
    priority,
    department,
    customerId: auth.customerId,
  });

  return success({
    tickets: result.data.map(serializeTicketSummary),
    pagination: {
      total: result.total,
      page: result.page,
      perPage: result.perPage,
      totalPages: result.totalPages,
    },
  });
}

export async function POST(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (!auth) {
    return unauthorized("Geçersiz veya eksik API anahtarı");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Geçersiz JSON gövdesi", 400);
  }

  const parsed = ticketCreateSchema.safeParse(body);
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    const formatted = Object.fromEntries(
      Object.entries(errors).map(([key, value]) => [key, value ?? []])
    );
    return validationError(formatted);
  }

  const user = await db.user.findUnique({
    where: { id: auth.customerId },
    select: { name: true, surname: true },
  });

  const senderName = user ? `${user.name} ${user.surname}`.trim() : "Müşteri";

  const ticket = await db.supportTicket.create({
    data: {
      ticketNumber: generateTicketNumber(),
      customerId: auth.customerId,
      subject: parsed.data.subject,
      department: parsed.data.department ?? "GENERAL",
      priority: parsed.data.priority ?? "MEDIUM",
      status: "OPEN",
      relatedServiceId: parsed.data.relatedServiceId ?? null,
      messages: {
        create: {
          senderId: auth.customerId,
          senderName,
          senderRole: "CUSTOMER",
          message: parsed.data.message,
        },
      },
    },
    include: {
      _count: {
        select: { messages: true },
      },
    },
  });

  return success(
    {
      ticket: serializeTicketSummary(ticket),
    },
    201
  );
}