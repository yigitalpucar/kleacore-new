"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { appButton } from "@/components/app";

/** Up / position / down control for manually ordered catalogue rows. */
export function OrderControls({
  value,
  itemLabel,
  onUp,
  onDown,
  upDisabled,
  downDisabled,
}: {
  value: number;
  itemLabel: string;
  onUp: () => void;
  onDown: () => void;
  upDisabled?: boolean;
  downDisabled?: boolean;
}) {
  const btn = appButton({ variant: "ghost", size: "icon-sm", className: "text-muted-foreground hover:text-foreground" });
  return (
    <div className="inline-flex items-center gap-0.5">
      <button type="button" className={btn} onClick={onUp} disabled={upDisabled} aria-label={`${itemLabel}: yukarı taşı`}>
        <ArrowUp aria-hidden />
      </button>
      <span className="min-w-6 text-center font-mono text-xs tabular-nums text-muted-foreground">{value}</span>
      <button type="button" className={btn} onClick={onDown} disabled={downDisabled} aria-label={`${itemLabel}: aşağı taşı`}>
        <ArrowDown aria-hidden />
      </button>
    </div>
  );
}
