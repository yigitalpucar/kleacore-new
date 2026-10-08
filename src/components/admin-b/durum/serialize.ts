import type { SystemIncident, SystemStatus } from "@prisma/client";
import { normaliseUpdates } from "@/lib/validations/system-status";
import type { ComponentRow, IncidentRow } from "./shared";

const sameName = (a: string, b: string) =>
  a.trim().toLocaleLowerCase("tr-TR") === b.trim().toLocaleLowerCase("tr-TR");

export function serializeIncident(i: SystemIncident): IncidentRow {
  return {
    id: i.id,
    title: i.title,
    description: i.description,
    severity: i.severity,
    status: i.status,
    serviceName: i.serviceName,
    startedAt: i.startedAt.toISOString(),
    resolvedAt: i.resolvedAt?.toISOString() ?? null,
    updatedAt: i.updatedAt.toISOString(),
    updates: normaliseUpdates(i.updates),
  };
}

export function serializeComponents(statuses: SystemStatus[], incidents: SystemIncident[]): ComponentRow[] {
  return statuses.map((s) => ({
    id: s.id,
    serviceName: s.serviceName,
    status: s.status,
    description: s.description,
    updatedAt: s.updatedAt.toISOString(),
    openIncidents: incidents.filter((i) => i.status !== "RESOLVED" && sameName(i.serviceName, s.serviceName)).length,
  }));
}
