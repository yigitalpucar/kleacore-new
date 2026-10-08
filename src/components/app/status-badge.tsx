import { cn } from "@/lib/utils";
import {
  getStatusMeta,
  type StatusAudience,
  type StatusKind,
  type StatusTone,
} from "./status-map";

const DOT: Record<StatusTone, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  info: "bg-sky-500",
  neutral: "bg-foreground/60",
  muted: "bg-transparent ring-1 ring-inset ring-muted-foreground/60",
};

/** Small status dot in a tone (used by StatusBadge, also exported for lists). */
export function ToneDot({ tone, className }: { tone: StatusTone; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-1.5 shrink-0 rounded-full", DOT[tone], className)} />;
}

type StatusBadgeProps = {
  className?: string;
  size?: "sm" | "md";
} & (
  | { kind: StatusKind; status: string | null | undefined; audience?: StatusAudience; tone?: never; label?: never }
  | { kind?: never; status?: never; audience?: never; tone: StatusTone; label: React.ReactNode }
);

/**
 * Status pill: monochrome text, coloured dot.
 *   <StatusBadge kind="invoice" status={invoice.status} />
 *   <StatusBadge tone="warning" label="İptal talebi bekliyor" />
 */
export function StatusBadge(props: StatusBadgeProps) {
  const { className, size = "sm" } = props;
  const meta =
    props.kind !== undefined
      ? getStatusMeta(props.kind, props.status, props.audience)
      : { label: props.label, tone: props.tone };

  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border bg-background font-medium text-foreground",
        size === "sm" ? "h-6 px-2 text-xs" : "h-7 px-2.5 text-[13px]",
        className
      )}
    >
      <ToneDot tone={meta.tone as StatusTone} />
      {meta.label}
    </span>
  );
}
