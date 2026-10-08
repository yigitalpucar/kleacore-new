import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ENUM_LABELS, ToneDot, getStatusMeta, getStatusOptions } from "@/components/app";
import { formatDateTime } from "@/lib/format/date";
import { cn } from "@/lib/utils";

export type ComponentRow = {
  id: string;
  serviceName: string;
  status: string;
  description: string;
  updatedAt: string;
  openIncidents: number;
};

export type TimelineEntry = { message: string; status: string; createdAt: string };

export type IncidentRow = {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  serviceName: string;
  startedAt: string;
  resolvedAt: string | null;
  updatedAt: string;
  updates: TimelineEntry[];
};

export const fieldClass = "h-11 md:h-10";

export const SEVERITY_OPTIONS = (["MINOR", "MAJOR", "CRITICAL"] as const).map((value) => ({
  value,
  label: ENUM_LABELS.incidentSeverity[value],
}));

export const SEVERITY_HINT: Record<string, string> = {
  MINOR: "Hizmet çalışıyor, bazı kullanıcılar etkileniyor.",
  MAJOR: "Hizmetin bir bölümü kullanılamıyor.",
  CRITICAL: "Hizmet tamamen kullanılamıyor.",
};

export const severityTone = (severity: string) =>
  severity === "CRITICAL" ? "danger" : severity === "MAJOR" ? "warning" : "info";

/** Radix select wired to a plain value. */
export function EnumSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  className,
  withDots,
  kind,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  /** Show the status tone dot for each option (systemStatus / incident). */
  withDots?: boolean;
  kind?: "systemStatus" | "incident";
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} aria-label={ariaLabel} className={cn(fieldClass, className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            <span className="flex items-center gap-2">
              {withDots && kind ? <ToneDot tone={getStatusMeta(kind, o.value).tone} /> : null}
              {o.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export const componentStatusOptions = () => getStatusOptions("systemStatus");
export const incidentStatusOptions = () => getStatusOptions("incident");

/** Vertical incident timeline (newest first), adapted from shadcnblocks order-management5. */
export function IncidentTimeline({ entries, emptyText = "Henüz güncelleme yok." }: { entries: TimelineEntry[]; emptyText?: string }) {
  const list = [...entries].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  if (!list.length) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <ol className="flex flex-col gap-5">
      {list.map((entry, index) => {
        const meta = getStatusMeta("incident", entry.status);
        return (
          <li key={`${entry.createdAt}-${index}`} className="relative pl-6">
            <span aria-hidden className="absolute left-0 top-1.5 flex size-2.5 items-center justify-center">
              <ToneDot tone={index === 0 ? meta.tone : "muted"} />
            </span>
            {index < list.length - 1 ? (
              <span aria-hidden className="absolute bottom-[-1.25rem] left-[4px] top-5 w-px border-l border-dashed" />
            ) : null}
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <p className="text-sm font-medium">{meta.label}</p>
                <time dateTime={entry.createdAt} className="text-xs tabular-nums text-muted-foreground">
                  {formatDateTime(entry.createdAt)}
                </time>
              </div>
              <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">{entry.message}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** "2 sa 15 dk" style duration between two ISO dates. */
export function durationLabel(fromIso: string, toIso: string): string {
  const mins = Math.max(0, Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 60000));
  if (mins < 60) return `${mins} dk`;
  const h = Math.floor(mins / 60);
  if (h < 48) return `${h} sa ${mins % 60} dk`;
  return `${Math.floor(h / 24)} gün ${h % 24} sa`;
}

/** ISO → value for <input type="datetime-local"> in the browser's zone. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** <input type="datetime-local"> value → ISO (browser zone), or undefined. */
export function fromLocalInput(value: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}
