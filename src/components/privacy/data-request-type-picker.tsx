"use client";

import { cn } from "@/lib/utils";
import {
  DATA_REQUEST_TYPE_DESCRIPTIONS,
  DATA_REQUEST_TYPE_LABELS,
  DATA_REQUEST_TYPES,
  type DataRequestTypeValue,
} from "@/lib/privacy/labels";

/** KVKK m.11 request types as radio cards (native inputs, name="type"). */
export function DataRequestTypePicker({
  value,
  onChange,
  disabled,
}: {
  value: DataRequestTypeValue | "";
  onChange: (value: DataRequestTypeValue) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="mb-2 text-sm font-medium">Talep türü</legend>
      <div className="grid gap-2">
        {DATA_REQUEST_TYPES.map((type) => {
          const checked = value === type;
          return (
            <label
              key={type}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition-colors focus-within:ring-2 focus-within:ring-ring",
                checked ? "border-foreground bg-muted/60" : "hover:bg-muted/40"
              )}
            >
              <input
                type="radio"
                name="type"
                value={type}
                checked={checked}
                onChange={() => onChange(type)}
                className="mt-1 size-4 shrink-0 accent-foreground"
                required
              />
              <span className="min-w-0">
                <span className="block font-medium">{DATA_REQUEST_TYPE_LABELS[type]}</span>
                <span className="block text-[13px] text-muted-foreground">{DATA_REQUEST_TYPE_DESCRIPTIONS[type]}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
