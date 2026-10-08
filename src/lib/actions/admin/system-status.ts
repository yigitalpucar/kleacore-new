"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity-log";
import { requireAdmin } from "@/lib/utils/auth-helpers";
import {
  appendIncidentUpdate,
  firstIssue,
  incidentCreateSchema,
  incidentSchema,
  incidentUpdateSchema,
  maintenanceDescription,
  maintenanceWindowSchema,
  nextResolvedAt,
  statusComponentSchema,
  type IncidentCreateInput,
  type IncidentInput,
  type IncidentUpdateInput,
  type StatusComponentInput,
} from "@/lib/validations/system-status";

type ActionResult<T = undefined> = { success: true; data?: T } | { success: false; error: string };

function revalidateStatusPages() {
  revalidatePath("/musteri/durum");
  revalidatePath("/yonetim/durum");
}

async function log(userId: string, action: string, entity: string, entityId: string, details?: Record<string, string>) {
  try {
    await logActivity({ userId, action, entity, entityId, details });
  } catch {
    // Activity log is best-effort; never fail the status change because of it.
  }
}

/* ------------------------------------------------------------------ */
/* Components (SystemStatus)                                            */
/* ------------------------------------------------------------------ */

export async function createStatusComponent(input: StatusComponentInput): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdmin();
  const parsed = statusComponentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: firstIssue(parsed.error, "Geçersiz bileşen bilgileri") };

  try {
    const duplicate = await db.systemStatus.findFirst({
      where: { serviceName: { equals: parsed.data.serviceName, mode: "insensitive" } },
      select: { id: true },
    });
    if (duplicate) return { success: false, error: "Bu adla bir bileşen zaten var" };

    const component = await db.systemStatus.create({ data: parsed.data });
    await log(session.user.id, "CREATE_STATUS_COMPONENT", "SystemStatus", component.id, {
      serviceName: component.serviceName,
      status: component.status,
    });
    revalidateStatusPages();
    return { success: true, data: { id: component.id } };
  } catch {
    return { success: false, error: "Bileşen oluşturulurken bir hata oluştu" };
  }
}

export async function updateStatusComponent(id: string, input: StatusComponentInput): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = statusComponentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: firstIssue(parsed.error, "Geçersiz bileşen bilgileri") };

  try {
    const existing = await db.systemStatus.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Bileşen bulunamadı" };

    const duplicate = await db.systemStatus.findFirst({
      where: { id: { not: id }, serviceName: { equals: parsed.data.serviceName, mode: "insensitive" } },
      select: { id: true },
    });
    if (duplicate) return { success: false, error: "Bu adla bir bileşen zaten var" };

    await db.$transaction(async (tx) => {
      await tx.systemStatus.update({ where: { id }, data: parsed.data });
      // Incidents reference components by name; keep them attached on rename.
      if (existing.serviceName !== parsed.data.serviceName) {
        await tx.systemIncident.updateMany({
          where: { serviceName: existing.serviceName },
          data: { serviceName: parsed.data.serviceName },
        });
      }
    });

    await log(session.user.id, "UPDATE_STATUS_COMPONENT", "SystemStatus", id, {
      serviceName: parsed.data.serviceName,
      from: existing.status,
      to: parsed.data.status,
    });
    revalidateStatusPages();
    return { success: true };
  } catch {
    return { success: false, error: "Bileşen güncellenirken bir hata oluştu" };
  }
}

/** Puts a component into MAINTENANCE with the window written into its description. */
export async function scheduleComponentMaintenance(
  id: string,
  input: { start: string; end: string; note?: string }
): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = maintenanceWindowSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: firstIssue(parsed.error, "Geçersiz bakım penceresi") };

  try {
    const existing = await db.systemStatus.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Bileşen bulunamadı" };

    const description = maintenanceDescription(parsed.data.start, parsed.data.end, parsed.data.note);
    await db.systemStatus.update({ where: { id }, data: { status: "MAINTENANCE", description } });
    await log(session.user.id, "SCHEDULE_STATUS_MAINTENANCE", "SystemStatus", id, {
      serviceName: existing.serviceName,
      start: parsed.data.start,
      end: parsed.data.end,
    });
    revalidateStatusPages();
    return { success: true };
  } catch {
    return { success: false, error: "Bakım kaydedilirken bir hata oluştu" };
  }
}

export async function deleteStatusComponent(id: string): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    const existing = await db.systemStatus.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Bileşen bulunamadı" };

    const openIncidents = await db.systemIncident.count({
      where: { serviceName: existing.serviceName, status: { not: "RESOLVED" } },
    });
    if (openIncidents > 0) {
      return { success: false, error: "Bu bileşende çözülmemiş olay var. Önce olayı çözün." };
    }

    await db.systemStatus.delete({ where: { id } });
    await log(session.user.id, "DELETE_STATUS_COMPONENT", "SystemStatus", id, { serviceName: existing.serviceName });
    revalidateStatusPages();
    return { success: true };
  } catch {
    return { success: false, error: "Bileşen silinirken bir hata oluştu" };
  }
}

/* ------------------------------------------------------------------ */
/* Incidents (SystemIncident)                                           */
/* ------------------------------------------------------------------ */

export async function createIncident(input: IncidentCreateInput): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdmin();
  const parsed = incidentCreateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: firstIssue(parsed.error, "Geçersiz olay bilgileri") };

  const { message, startedAt, status, ...rest } = parsed.data;
  const now = new Date();
  const firstMessage = (message || rest.description).trim();

  try {
    const incident = await db.systemIncident.create({
      data: {
        ...rest,
        status,
        startedAt: startedAt ? new Date(startedAt) : now,
        resolvedAt: nextResolvedAt(status, null, now),
        updates: firstMessage ? appendIncidentUpdate([], { message: firstMessage, status }, now) : [],
      },
    });
    await log(session.user.id, "CREATE_INCIDENT", "SystemIncident", incident.id, {
      title: incident.title,
      severity: incident.severity,
      serviceName: incident.serviceName,
    });
    revalidateStatusPages();
    return { success: true, data: { id: incident.id } };
  } catch {
    return { success: false, error: "Olay oluşturulurken bir hata oluştu" };
  }
}

export async function updateIncident(id: string, input: IncidentInput): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = incidentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: firstIssue(parsed.error, "Geçersiz olay bilgileri") };

  try {
    const existing = await db.systemIncident.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return { success: false, error: "Olay bulunamadı" };

    const { startedAt, ...rest } = parsed.data;
    await db.systemIncident.update({
      where: { id },
      data: { ...rest, ...(startedAt ? { startedAt: new Date(startedAt) } : {}) },
    });
    await log(session.user.id, "UPDATE_INCIDENT", "SystemIncident", id, { title: rest.title, severity: rest.severity });
    revalidateStatusPages();
    return { success: true };
  } catch {
    return { success: false, error: "Olay güncellenirken bir hata oluştu" };
  }
}

/** Appends a timeline entry and moves the incident to the entry's status. */
export async function addIncidentUpdate(id: string, input: IncidentUpdateInput): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = incidentUpdateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: firstIssue(parsed.error, "Geçersiz güncelleme") };

  try {
    const existing = await db.systemIncident.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Olay bulunamadı" };

    const now = new Date();
    await db.systemIncident.update({
      where: { id },
      data: {
        status: parsed.data.status,
        resolvedAt: nextResolvedAt(parsed.data.status, existing.resolvedAt, now),
        updates: appendIncidentUpdate(existing.updates, parsed.data, now),
      },
    });
    await log(session.user.id, "UPDATE_INCIDENT_STATUS", "SystemIncident", id, {
      from: existing.status,
      to: parsed.data.status,
    });
    revalidateStatusPages();
    return { success: true };
  } catch {
    return { success: false, error: "Güncelleme eklenirken bir hata oluştu" };
  }
}

export async function deleteIncident(id: string): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    const existing = await db.systemIncident.findUnique({ where: { id }, select: { id: true, title: true } });
    if (!existing) return { success: false, error: "Olay bulunamadı" };

    await db.systemIncident.delete({ where: { id } });
    await log(session.user.id, "DELETE_INCIDENT", "SystemIncident", id, { title: existing.title });
    revalidateStatusPages();
    return { success: true };
  } catch {
    return { success: false, error: "Olay silinirken bir hata oluştu" };
  }
}
