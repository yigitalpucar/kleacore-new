/**
 * Report date ranges: the preset periods of /yonetim/raporlar ("7days" …
 * "1year") or a custom `from`/`to` pair of Istanbul calendar days
 * (YYYY-MM-DD, both inclusive). Turkey is UTC+3 all year (no DST since 2016),
 * so a day maps to a fixed UTC window.
 */

export const REPORT_PERIODS = ["7days", "30days", "3months", "6months", "1year"] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

export interface ReportRange {
  from: Date;
  to: Date;
  /** Preset in effect, or "custom" for a from/to pair. */
  period: ReportPeriod | "custom";
  /** Istanbul days of the range, "YYYY-MM-DD" (for inputs and file names). */
  fromDay: string;
  toDay: string;
}

const TZ = "Europe/Istanbul";
const ISTANBUL_OFFSET = "+03:00";
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 3 * 366;

const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

export function toIstanbulDay(date: Date): string {
  return dayFormatter.format(date);
}

/** Start (00:00) of an Istanbul day as an instant. */
export function istanbulDayStart(day: string): Date {
  return new Date(`${day}T00:00:00.000${ISTANBUL_OFFSET}`);
}

/** End (23:59:59.999) of an Istanbul day as an instant. */
export function istanbulDayEnd(day: string): Date {
  return new Date(`${day}T23:59:59.999${ISTANBUL_OFFSET}`);
}

function isValidDay(value: string | null | undefined): value is string {
  if (!value || !DAY_RE.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function first(value: string | string[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

export function parseReportPeriod(value: string | string[] | null | undefined): ReportPeriod {
  const raw = first(value);
  return raw && (REPORT_PERIODS as readonly string[]).includes(raw) ? (raw as ReportPeriod) : "6months";
}

/** Shifts an Istanbul day by whole months (clamped to day 1 → used for month starts). */
function monthStartDay(now: Date, monthsBack: number): string {
  const [year, month] = toIstanbulDay(now).split("-").map(Number);
  const total = year * 12 + (month - 1) - monthsBack;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

function addDays(day: string, delta: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

/** Preset → range ending now (same windows the reports page always used). */
export function rangeForPeriod(period: ReportPeriod, now: Date = new Date()): ReportRange {
  const today = toIstanbulDay(now);
  const fromDay =
    period === "7days"
      ? addDays(today, -6)
      : period === "30days"
        ? addDays(today, -29)
        : period === "3months"
          ? monthStartDay(now, 2)
          : period === "1year"
            ? monthStartDay(now, 11)
            : monthStartDay(now, 5);
  return { from: istanbulDayStart(fromDay), to: now, period, fromDay, toDay: today };
}

/**
 * Range from search params: a valid `from`/`to` pair wins (swapped if
 * reversed, capped at ~3 years and at today), otherwise the `period` preset.
 */
export function parseReportRange(
  params: { get(name: string): string | null } | Record<string, string | string[] | undefined>,
  now: Date = new Date()
): ReportRange {
  const read = (name: string) =>
    typeof (params as { get?: unknown }).get === "function"
      ? (params as { get(name: string): string | null }).get(name)
      : first((params as Record<string, string | string[] | undefined>)[name]);

  let fromDay = read("from");
  let toDay = read("to");
  if (isValidDay(fromDay) && isValidDay(toDay)) {
    if (fromDay > toDay) [fromDay, toDay] = [toDay, fromDay];
    const today = toIstanbulDay(now);
    if (toDay > today) toDay = today;
    if (fromDay > toDay) fromDay = toDay;
    const minFrom = addDays(toDay, -MAX_RANGE_DAYS);
    if (fromDay < minFrom) fromDay = minFrom;
    const to = toDay === today ? now : istanbulDayEnd(toDay);
    return { from: istanbulDayStart(fromDay), to, period: "custom", fromDay, toDay };
  }
  return rangeForPeriod(parseReportPeriod(read("period")), now);
}

/** Query string that reproduces a range (links, CSV downloads). */
export function rangeSearchParams(range: ReportRange): URLSearchParams {
  return range.period === "custom"
    ? new URLSearchParams({ from: range.fromDay, to: range.toDay })
    : new URLSearchParams({ period: range.period });
}

/** "YYYY-MM" keys of every Istanbul month touched by the range, oldest first. */
export function monthsInRange(range: Pick<ReportRange, "fromDay" | "toDay">): string[] {
  const months: string[] = [];
  let [year, month] = range.fromDay.split("-").map(Number);
  const [endYear, endMonth] = range.toDay.split("-").map(Number);
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

/** Every Istanbul day of the range, oldest first. */
export function daysInRange(range: Pick<ReportRange, "fromDay" | "toDay">): string[] {
  const days: string[] = [];
  for (let day = range.fromDay; day <= range.toDay; day = addDays(day, 1)) days.push(day);
  return days;
}

const MONTHS_TR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const MONTHS_TR_SHORT = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

/** "2026-10" → "Ekim 2026" (or "Eki 26" with `short`). */
export function monthLabel(month: string, short = false): string {
  const [year, m] = month.split("-");
  const index = Number(m) - 1;
  if (!year || index < 0 || index > 11) return month;
  return short ? `${MONTHS_TR_SHORT[index]} ${year.slice(-2)}` : `${MONTHS_TR[index]} ${year}`;
}

/** "2026-10-08" → "08.10.2026" (or "08 Eki" with `short`). */
export function dayLabel(day: string, short = false): string {
  const [year, m, d] = day.split("-");
  if (short) return `${d} ${MONTHS_TR_SHORT[Number(m) - 1] ?? m}`;
  return `${d}.${m}.${year}`;
}

/** Start instant of an Istanbul month ("2026-10") and of the next one. */
export function monthBounds(month: string): { start: Date; end: Date } {
  const [year, m] = month.split("-").map(Number);
  const next = m === 12 ? `${year + 1}-01` : `${year}-${String(m + 1).padStart(2, "0")}`;
  return { start: istanbulDayStart(`${month}-01`), end: istanbulDayStart(`${next}-01`) };
}
