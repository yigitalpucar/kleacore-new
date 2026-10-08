import { z } from "zod";

/**
 * Validation + pure helpers for the status page admin (/yonetim/durum).
 * The public page (/musteri/durum) reads `SystemStatus` + `SystemIncident`
 * directly; incident updates are stored in `SystemIncident.updates` (JSON)
 * in the `{ message, status, createdAt }` shape its `parseUpdates` reads.
 */

export const SYSTEM_STATUS_VALUES = [
  "OPERATIONAL",
  "DEGRADED",
  "PARTIAL_OUTAGE",
  "MAJOR_OUTAGE",
  "MAINTENANCE",
] as const;
export const INCIDENT_SEVERITY_VALUES = ["MINOR", "MAJOR", "CRITICAL"] as const;
export const INCIDENT_STATUS_VALUES = ["INVESTIGATING", "IDENTIFIED", "MONITORING", "RESOLVED"] as const;

export type IncidentStatusValue = (typeof INCIDENT_STATUS_VALUES)[number];

const isoDate = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(Date.parse(v)), "Geçerli bir tarih giriniz");

export const statusComponentSchema = z.object({
  serviceName: z
    .string()
    .trim()
    .min(2, "Bileşen adı en az 2 karakter olmalı")
    .max(80, "Bileşen adı en fazla 80 karakter olabilir"),
  description: z.string().trim().max(500, "Açıklama en fazla 500 karakter olabilir").default(""),
  status: z.enum(SYSTEM_STATUS_VALUES, { errorMap: () => ({ message: "Geçersiz durum" }) }),
});

export type StatusComponentInput = z.input<typeof statusComponentSchema>;

export const incidentSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Başlık en az 3 karakter olmalı")
    .max(160, "Başlık en fazla 160 karakter olabilir"),
  description: z.string().trim().max(2000, "Açıklama en fazla 2000 karakter olabilir").default(""),
  severity: z.enum(INCIDENT_SEVERITY_VALUES, { errorMap: () => ({ message: "Geçersiz etki seviyesi" }) }),
  serviceName: z.string().trim().min(1, "Etkilenen bileşeni seçiniz").max(80),
  startedAt: isoDate.optional(),
});

export type IncidentInput = z.input<typeof incidentSchema>;

export const incidentCreateSchema = incidentSchema.extend({
  status: z.enum(INCIDENT_STATUS_VALUES, { errorMap: () => ({ message: "Geçersiz olay durumu" }) }),
  /** First timeline entry. Optional; defaults to the description. */
  message: z.string().trim().max(2000, "Güncelleme en fazla 2000 karakter olabilir").optional(),
});

export type IncidentCreateInput = z.input<typeof incidentCreateSchema>;

export const incidentUpdateSchema = z.object({
  status: z.enum(INCIDENT_STATUS_VALUES, { errorMap: () => ({ message: "Geçersiz olay durumu" }) }),
  message: z
    .string()
    .trim()
    .min(3, "Güncelleme metni en az 3 karakter olmalı")
    .max(2000, "Güncelleme en fazla 2000 karakter olabilir"),
});

export type IncidentUpdateInput = z.input<typeof incidentUpdateSchema>;

export type StoredIncidentUpdate = {
  message: string;
  status: IncidentStatusValue;
  createdAt: string;
};

/** First validation error message, Turkish. */
export function firstIssue(error: z.ZodError, fallback = "Geçersiz bilgiler"): string {
  return error.errors[0]?.message ?? fallback;
}

/** Normalises whatever is stored in `updates` into the canonical shape (drops junk). */
export function normaliseUpdates(raw: unknown): StoredIncidentUpdate[] {
  if (!Array.isArray(raw)) return [];
  const out: StoredIncidentUpdate[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const message = typeof rec.message === "string" ? rec.message.trim() : "";
    if (!message) continue;
    const status = (INCIDENT_STATUS_VALUES as readonly string[]).includes(rec.status as string)
      ? (rec.status as IncidentStatusValue)
      : "INVESTIGATING";
    const createdAt =
      typeof rec.createdAt === "string" && !Number.isNaN(Date.parse(rec.createdAt))
        ? rec.createdAt
        : new Date(0).toISOString();
    out.push({ message, status, createdAt });
  }
  return out;
}

/** Returns a new updates array with `update` appended (stored oldest → newest). */
export function appendIncidentUpdate(
  raw: unknown,
  update: { message: string; status: IncidentStatusValue },
  now: Date = new Date()
): StoredIncidentUpdate[] {
  return [...normaliseUpdates(raw), { message: update.message.trim(), status: update.status, createdAt: now.toISOString() }];
}

/**
 * `resolvedAt` follows the incident status: set when it becomes RESOLVED
 * (kept if it already was), cleared when it is reopened.
 */
export function nextResolvedAt(
  status: IncidentStatusValue,
  current: Date | null,
  now: Date = new Date()
): Date | null {
  if (status !== "RESOLVED") return null;
  return current ?? now;
}

/**
 * Formats a maintenance window into the component description (the schema has
 * no maintenance start/end columns; the public page shows the description of
 * components in MAINTENANCE under "Bakım duyuruları").
 */
export function maintenanceDescription(start: string, end: string, note = ""): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("tr-TR", {
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Istanbul",
    });
  const window = `Planlı bakım: ${fmt(start)} – ${fmt(end)} (TSİ).`;
  return note.trim() ? `${window} ${note.trim()}` : window;
}

export const maintenanceWindowSchema = z
  .object({
    start: isoDate,
    end: isoDate,
    note: z.string().trim().max(300, "Not en fazla 300 karakter olabilir").default(""),
  })
  .refine((v) => Date.parse(v.end) > Date.parse(v.start), {
    message: "Bitiş zamanı başlangıçtan sonra olmalı",
    path: ["end"],
  });
