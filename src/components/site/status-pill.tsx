import { cn } from "@/lib/utils";

type StatusTone = "online" | "neutral";

/**
 * Small pill with a status dot. Emerald is the only accent colour on the
 * site and is reserved for status/uptime dots. Do not use it to claim live
 * status unless the data is live — label it factually ("İstanbul lokasyon",
 * "Sistem durumu").
 */
export function StatusPill({
  children,
  tone = "online",
  pulse = true,
  className,
}: {
  children: React.ReactNode;
  tone?: StatusTone;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs font-medium text-foreground backdrop-blur",
        className
      )}
    >
      <StatusDot tone={tone} pulse={pulse} />
      {children}
    </span>
  );
}

export function StatusDot({
  tone = "online",
  pulse = true,
  className,
}: {
  tone?: StatusTone;
  pulse?: boolean;
  className?: string;
}) {
  const color = tone === "online" ? "bg-emerald-500" : "bg-muted-foreground";
  return (
    <span aria-hidden className={cn("relative flex size-2 shrink-0", className)}>
      {pulse && tone === "online" ? (
        <span
          className={cn(
            "absolute inline-flex size-full animate-ping rounded-full opacity-60 motion-reduce:hidden",
            color
          )}
        />
      ) : null}
      <span className={cn("relative inline-flex size-2 rounded-full", color)} />
    </span>
  );
}
