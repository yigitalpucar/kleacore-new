/**
 * Labels and colours for the public status page. Colour is used only on
 * status dots and the 90-day incident bars (the site's sole accent rule
 * extended to the states a status page must distinguish).
 */

export type ComponentStatus =
  | "OPERATIONAL"
  | "DEGRADED"
  | "PARTIAL_OUTAGE"
  | "MAJOR_OUTAGE"
  | "MAINTENANCE";
export type IncidentSeverity = "MINOR" | "MAJOR" | "CRITICAL";
export type IncidentStatus = "INVESTIGATING" | "IDENTIFIED" | "MONITORING" | "RESOLVED";

export type Tone = "ok" | "info" | "warn" | "minor" | "major" | "critical" | "neutral";

export const toneDot: Record<Tone, string> = {
  ok: "bg-emerald-500",
  info: "bg-sky-500",
  warn: "bg-amber-500",
  minor: "bg-amber-400",
  major: "bg-orange-500",
  critical: "bg-red-500",
  neutral: "bg-muted-foreground",
};

export const componentStatusMeta: Record<ComponentStatus, { label: string; tone: Tone }> = {
  OPERATIONAL: { label: "Çalışıyor", tone: "ok" },
  DEGRADED: { label: "Performans düşük", tone: "warn" },
  PARTIAL_OUTAGE: { label: "Kısmi kesinti", tone: "major" },
  MAJOR_OUTAGE: { label: "Büyük kesinti", tone: "critical" },
  MAINTENANCE: { label: "Bakımda", tone: "info" },
};

export const incidentStatusLabel: Record<IncidentStatus, string> = {
  INVESTIGATING: "İnceleniyor",
  IDENTIFIED: "Neden tespit edildi",
  MONITORING: "İzleniyor",
  RESOLVED: "Çözüldü",
};

export const severityMeta: Record<IncidentSeverity, { label: string; tone: Tone; rank: number }> = {
  MINOR: { label: "Düşük etki", tone: "minor", rank: 1 },
  MAJOR: { label: "Yüksek etki", tone: "major", rank: 2 },
  CRITICAL: { label: "Kritik", tone: "critical", rank: 3 },
};

export function componentMeta(status: string) {
  return componentStatusMeta[status as ComponentStatus] ?? { label: status, tone: "neutral" as Tone };
}

export function incidentLabel(status: string) {
  return incidentStatusLabel[status as IncidentStatus] ?? status;
}

export function severityOf(severity: string) {
  return severityMeta[severity as IncidentSeverity] ?? severityMeta.MINOR;
}

const TZ = "Europe/Istanbul";

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}

export function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TZ,
  });
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}

/** "2 saat 15 dakika" style duration. */
export function formatDuration(fromIso: string, toIso: string) {
  const minutes = Math.max(0, Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 60000));
  if (minutes < 1) return "1 dakikadan kısa";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days} gün`);
  if (hours) parts.push(`${hours} saat`);
  if (mins && !days) parts.push(`${mins} dakika`);
  return parts.join(" ");
}

/** Istanbul calendar day key (YYYY-MM-DD) for grouping. */
export function dayKey(iso: string | number) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
}

export interface IncidentUpdate {
  message: string;
  status: string | null;
  at: string | null;
}

/**
 * `system_incidents.updates` is free-form JSON (default `[]`). Accept the
 * shapes an admin is likely to store and drop anything without a message.
 */
export function parseUpdates(raw: unknown): IncidentUpdate[] {
  if (!Array.isArray(raw)) return [];
  const out: IncidentUpdate[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      if (item.trim()) out.push({ message: item.trim(), status: null, at: null });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const message = [rec.message, rec.text, rec.body, rec.description].find(
      (v): v is string => typeof v === "string" && v.trim().length > 0
    );
    if (!message) continue;
    const at = [rec.createdAt, rec.date, rec.at, rec.timestamp].find(
      (v): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v))
    );
    out.push({
      message: message.trim(),
      status: typeof rec.status === "string" ? rec.status : null,
      at: at ?? null,
    });
  }
  return out.sort((a, b) => (b.at ? Date.parse(b.at) : 0) - (a.at ? Date.parse(a.at) : 0));
}
