"use client";

import { Switch } from "@/components/ui/switch";

/** Bordered label + hint + switch row (settings-notifications3 style). */
export function SwitchField({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border px-3.5 py-3">
      <div className="min-w-0 space-y-0.5">
        <label htmlFor={id} className="text-sm font-medium leading-none">
          {label}
        </label>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
