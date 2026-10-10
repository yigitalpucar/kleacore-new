/**
 * Formatting + small math for time-series charts (server metrics).
 * tr-TR numbers, binary units (1 KB = 1024 B), Europe/Istanbul times.
 */

const nf = (max: number) => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: max });

const RATE_UNITS = ["B/sn", "KB/sn", "MB/sn", "GB/sn"];

/** 0 → "0 B/sn", 1536 → "1,5 KB/sn", 12_582_912 → "12 MB/sn". */
export function formatBytesPerSecond(bps: number): string {
  let value = Math.max(0, bps);
  let unit = 0;
  while (value >= 1024 && unit < RATE_UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${nf(value >= 100 || unit === 0 ? 0 : 1).format(value)} ${RATE_UNITS[unit]}`;
}

/** 512 → "512 MB", 1536 → "1,5 GB". */
export function formatMegabytes(mb: number): string {
  if (mb >= 1024) return `${nf(1).format(mb / 1024)} GB`;
  return `${nf(0).format(Math.max(0, mb))} MB`;
}

export function formatPercent(value: number): string {
  return `%${nf(1).format(value)}`;
}

/** Smallest 1 / 2 / 2.5 / 5 × 10^k ≥ n (axis maximum); 0 for n ≤ 0. */
export function niceCeil(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  const exp = Math.floor(Math.log10(n));
  const base = 10 ** exp;
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (step * base >= n - base * 1e-9) return step * base;
  }
  return 10 * base;
}

export type SeriesValue = number | null | undefined;

export function isValue(value: SeriesValue): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** min / max / average / last of the defined values; null when there are none. */
export function seriesStats(values: readonly SeriesValue[]) {
  const defined = values.filter(isValue);
  if (!defined.length) return null;
  const sum = defined.reduce((a, b) => a + b, 0);
  return {
    min: Math.min(...defined),
    max: Math.max(...defined),
    avg: sum / defined.length,
    last: defined[defined.length - 1],
  };
}

/**
 * SVG path ("M x y L x y …") for values on a width × height canvas with
 * y = 0 at the bottom; undefined values break the line (gaps are not
 * interpolated). A lone point becomes a short horizontal tick.
 */
export function linePath(values: readonly SeriesValue[], width: number, height: number, max: number): string {
  const n = values.length;
  if (!n || max <= 0) return "";
  const x = (i: number) => (n === 1 ? width / 2 : (i / (n - 1)) * width);
  const y = (v: number) => height - (Math.min(Math.max(v, 0), max) / max) * height;
  const round = (v: number) => Math.round(v * 100) / 100;
  const parts: string[] = [];
  let open = false;
  values.forEach((value, i) => {
    if (!isValue(value)) {
      open = false;
      return;
    }
    const next = values[i + 1];
    if (!open && !isValue(next)) {
      // Isolated point: draw a 2-unit tick so it stays visible.
      parts.push(`M${round(x(i) - 1)} ${round(y(value))}L${round(x(i) + 1)} ${round(y(value))}`);
      return;
    }
    parts.push(`${open ? "L" : "M"}${round(x(i))} ${round(y(value))}`);
    open = true;
  });
  return parts.join("");
}

/** Closed area under `linePath` (each run of defined values closed to the baseline). */
export function areaPath(values: readonly SeriesValue[], width: number, height: number, max: number): string {
  const n = values.length;
  if (n < 2 || max <= 0) return "";
  const x = (i: number) => (i / (n - 1)) * width;
  const y = (v: number) => height - (Math.min(Math.max(v, 0), max) / max) * height;
  const round = (v: number) => Math.round(v * 100) / 100;
  const runs: Array<Array<[number, number]>> = [];
  let run: Array<[number, number]> = [];
  values.forEach((value, i) => {
    if (isValue(value)) run.push([x(i), y(value)]);
    else if (run.length) {
      runs.push(run);
      run = [];
    }
  });
  if (run.length) runs.push(run);
  return runs
    .filter((r) => r.length > 1)
    .map((r) => `M${round(r[0][0])} ${height}${r.map(([px, py]) => `L${round(px)} ${round(py)}`).join("")}L${round(r[r.length - 1][0])} ${height}Z`)
    .join("");
}

const timeFmt = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });
const dayFmt = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "Europe/Istanbul" });
const fullFmt = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
});

/** Axis label: "14:30" for 1 h / 24 h, "8 Eki" for 7 d. */
export function formatAxisTime(ms: number, range: "hour" | "day" | "week"): string {
  return range === "week" ? dayFmt.format(ms) : timeFmt.format(ms);
}

/** Tooltip label: "8 Eki 14:30". */
export function formatPointTime(ms: number): string {
  return fullFmt.format(ms);
}

/** Axis maximum for byte values that lands on a round number in the displayed unit (1024-based). */
export function niceCeilBytes(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  let unit = 1;
  while (n / unit >= 1024 && unit < 1024 ** 3) unit *= 1024;
  return niceCeil(n / unit) * unit;
}
