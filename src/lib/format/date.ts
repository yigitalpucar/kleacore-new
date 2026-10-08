/**
 * Date helpers for the app surfaces (customer + admin panels).
 * Always tr-TR, always Europe/Istanbul so server and client render the same
 * string (avoids hydration mismatches on dates near midnight).
 */

type DateInput = Date | string | number | null | undefined;

const TZ = "Europe/Istanbul";

const dateFmt = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: TZ,
});

const dateLongFmt = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: TZ,
});

const dateTimeFmt = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TZ,
});

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "08.10.2026" — or `fallback` ("—") when empty/invalid. */
export function formatDate(value: DateInput, fallback = "—"): string {
  const d = toDate(value);
  return d ? dateFmt.format(d) : fallback;
}

/** "8 Ekim 2026" */
export function formatDateLong(value: DateInput, fallback = "—"): string {
  const d = toDate(value);
  return d ? dateLongFmt.format(d) : fallback;
}

/** "08.10.2026 14:05" */
export function formatDateTime(value: DateInput, fallback = "—"): string {
  const d = toDate(value);
  return d ? dateTimeFmt.format(d) : fallback;
}

/** Whole days from now until `value` (negative when in the past). */
export function daysUntil(value: DateInput, now: Date = new Date()): number | null {
  const d = toDate(value);
  if (!d) return null;
  return Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
}

const BILLING_PERIOD_LABELS: Record<string, { adjective: string; unit: string }> = {
  monthly: { adjective: "Aylık", unit: "ay" },
  quarterly: { adjective: "3 aylık", unit: "3 ay" },
  semiannual: { adjective: "6 aylık", unit: "6 ay" },
  yearly: { adjective: "Yıllık", unit: "yıl" },
  biennial: { adjective: "2 yıllık", unit: "2 yıl" },
  triennial: { adjective: "3 yıllık", unit: "3 yıl" },
};

/** BillingPeriod enum → "Aylık" / "Yıllık" … */
export function billingPeriodLabel(period: string | null | undefined): string {
  if (!period) return "—";
  return BILLING_PERIOD_LABELS[period]?.adjective ?? period;
}

/** BillingPeriod enum → "ay" / "yıl" … (for "49 ₺ / ay"). */
export function billingPeriodUnit(period: string | null | undefined): string {
  if (!period) return "";
  return BILLING_PERIOD_LABELS[period]?.unit ?? period;
}
