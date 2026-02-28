import { db } from "@/lib/db";

export async function getStatuses() {
  return db.systemStatus.findMany({
    orderBy: { serviceName: "asc" },
  });
}

export async function getActiveIncidents() {
  return db.systemIncident.findMany({
    where: { status: { not: "RESOLVED" } },
    orderBy: { startedAt: "desc" },
  });
}

export async function getRecentIncidents(limit = 10) {
  return db.systemIncident.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getIncidents() {
  return db.systemIncident.findMany({
    orderBy: { createdAt: "desc" },
  });
}
