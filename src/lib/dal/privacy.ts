import type { DataRequestStatus, Prisma } from "@prisma/client";
import { listTrustedDevices } from "@/lib/auth/trusted-device";
import { db } from "@/lib/db";
import { listActiveSessions, listRecentLogins } from "@/lib/security/login-events";

export type DataRequestFilter = "open" | "pending" | "closed" | "all";

const FILTER_WHERE: Record<DataRequestFilter, Prisma.DataRequestWhereInput> = {
  open: { status: { in: ["RECEIVED", "IN_PROGRESS"] } },
  pending: { status: "PENDING_VERIFICATION" },
  closed: { status: { in: ["COMPLETED", "REJECTED", "CANCELLED"] } },
  all: {},
};

export async function getDataRequestQueue(filter: DataRequestFilter, now = new Date()) {
  const [requests, grouped, overdue] = await Promise.all([
    db.dataRequest.findMany({
      where: FILTER_WHERE[filter],
      // Open requests by deadline (oldest due first), others newest first.
      orderBy: filter === "open" ? [{ dueAt: "asc" }] : [{ createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        requestNumber: true,
        type: true,
        status: true,
        name: true,
        email: true,
        source: true,
        userId: true,
        createdAt: true,
        receivedAt: true,
        dueAt: true,
        completedAt: true,
      },
    }),
    db.dataRequest.groupBy({ by: ["status"], _count: { _all: true } }),
    db.dataRequest.count({ where: { status: { in: ["RECEIVED", "IN_PROGRESS"] }, dueAt: { lt: now } } }),
  ]);
  const counts = Object.fromEntries(grouped.map((g) => [g.status, g._count._all])) as Partial<Record<DataRequestStatus, number>>;
  return {
    requests,
    counts: {
      open: (counts.RECEIVED ?? 0) + (counts.IN_PROGRESS ?? 0),
      pending: counts.PENDING_VERIFICATION ?? 0,
      closed: (counts.COMPLETED ?? 0) + (counts.REJECTED ?? 0) + (counts.CANCELLED ?? 0),
      overdue,
    },
  };
}

export async function getDataRequestDetail(id: string) {
  return db.dataRequest.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, name: true, surname: true, status: true, companyName: true } },
      notes: { orderBy: { createdAt: "asc" } },
    },
  });
}

export async function getCustomerDataRequests(userId: string) {
  return db.dataRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      requestNumber: true,
      type: true,
      status: true,
      createdAt: true,
      dueAt: true,
      completedAt: true,
      responseText: true,
    },
  });
}

/** Data for the customer "Güvenlik" tab. */
export async function getSecurityOverview(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, sessionVersion: true } });
  if (!user) return null;
  const [recentLogins, sessions, devices] = await Promise.all([
    listRecentLogins(userId, 15),
    listActiveSessions(user),
    listTrustedDevices(user),
  ]);
  return { recentLogins, sessions, devices };
}
