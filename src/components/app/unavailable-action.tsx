"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { appButton } from "./button-classes";

/**
 * An action that exists in the design but isn't wired up yet. Renders a
 * clearly disabled button with an honest tooltip instead of a fake-working
 * one. Needs a `TooltipProvider` above it (AppShell provides one).
 *
 *   <UnavailableAction icon={<ExternalLink />} label="cPanel'e git" />
 */
export function UnavailableAction({
  label,
  icon,
  description,
  reason = "Yakında",
  variant = "outline",
  size = "md",
  layout = "button",
  className,
}: {
  label: string;
  icon?: React.ReactNode;
  /** Second line for `layout="tile"`. */
  description?: string;
  /** Tooltip text. */
  reason?: string;
  variant?: "primary" | "outline" | "ghost" | "secondary";
  size?: "md" | "sm";
  /** `tile` = two-line quick-action tile. */
  layout?: "button" | "tile";
  className?: string;
}) {
  const content =
    layout === "tile" ? (
      <span
        aria-disabled="true"
        tabIndex={0}
        aria-label={`${label} — ${reason}`}
        className={cn(
          "flex min-h-[60px] w-full cursor-not-allowed items-center gap-3 rounded-md border border-dashed bg-background px-3 py-2.5 text-left text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4 [&_svg]:shrink-0",
          className
        )}
      >
        {icon}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{label}</span>
          {description ? <span className="block truncate text-xs">{description}</span> : null}
        </span>
        <span className="shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider">
          {reason}
        </span>
      </span>
    ) : (
      <span
        aria-disabled="true"
        tabIndex={0}
        aria-label={`${label} — ${reason}`}
        className={cn(
          appButton({ variant, size }),
          "pointer-events-auto cursor-not-allowed opacity-50 aria-disabled:pointer-events-auto",
          className
        )}
      >
        {icon}
        {label}
      </span>
    );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent className="bg-foreground text-background">{reason}</TooltipContent>
    </Tooltip>
  );
}
