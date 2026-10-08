import { cn } from "@/lib/utils";

/**
 * Horizontal usage bar ("Disk 4,2 / 10 GB"). The fill is foreground; it turns
 * amber at `warnAt` and red at `dangerAt` percent.
 */
export function UsageMeter({
  label,
  used,
  limit,
  unit = "",
  percent: percentProp,
  warnAt = 70,
  dangerAt = 90,
  className,
}: {
  label: React.ReactNode;
  used?: number | null;
  limit?: number | null;
  unit?: string;
  /** Pass directly when you only have a percentage (CPU/RAM). */
  percent?: number | null;
  warnAt?: number;
  dangerAt?: number;
  className?: string;
}) {
  const percent =
    percentProp ?? (used != null && limit != null && limit > 0 ? (used / limit) * 100 : null);
  if (percent == null) return null;
  const clamped = Math.max(0, Math.min(100, percent));
  const fill = clamped >= dangerAt ? "bg-red-500" : clamped >= warnAt ? "bg-amber-500" : "bg-foreground";
  const fmt = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
  const valueText =
    used != null && limit != null ? `${fmt(used)} / ${fmt(limit)} ${unit}`.trim() : `%${fmt(clamped)}`;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{valueText}</span>
      </div>
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped)}
        aria-label={typeof label === "string" ? label : undefined}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div className={cn("h-full rounded-full transition-[width]", fill)} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
