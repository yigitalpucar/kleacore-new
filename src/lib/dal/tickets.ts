import { db } from "@/lib/db";
import {
  type PaginationParams,
  paginationMeta,
} from "@/lib/utils/pagination";
import type {
  TicketDepartment,
  TicketPriority,
  TicketStatus,
} from "@prisma/client";

interface GetTicketsParams extends PaginationParams {
  status?: TicketStatus;
  priority?: TicketPriority;
  department?: TicketDepartment;
  customerId?: string;
}

export async function getTickets(params: GetTicketsParams) {
  const {
    page,
    perPage,
    search,
    sortBy,
    sortOrder,
    status,
    priority,
    department,
    customerId,
  } = params;

  const where = {
    ...(status && { status }),
    ...(priority && { priority }),
    ...(department && { department }),
    ...(customerId && { customerId }),
    ...(search && {
      OR: [
        { ticketNumber: { contains: search, mode: "insensitive" as const } },
        { subject: { contains: search, mode: "insensitive" as const } },
        {
          customer: {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          },
        },
      ],
    }),
  };

  const [data, total] = await Promise.all([
    db.supportTicket.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            surname: true,
            email: true,
          },
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { [sortBy || "updatedAt"]: sortOrder || "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.supportTicket.count({ where }),
  ]);

  return { data, ...paginationMeta(total, params) };
}

export async function getTicketById(id: string) {
  return db.supportTicket.findUnique({
    where: { id },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          surname: true,
          email: true,
          phone: true,
        },
      },
      _count: {
        select: { messages: true },
      },
    },
  });
}

export async function getTicketWithMessages(id: string) {
  return db.supportTicket.findUnique({
    where: { id },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          surname: true,
          email: true,
          phone: true,
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          files: {
            select: { id: true, fileName: true, mimeType: true, sizeBytes: true },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });
}

export async function getTicketsByCustomer(customerId: string) {
  return db.supportTicket.findMany({
    where: { customerId },
    include: {
      _count: {
        select: { messages: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}
