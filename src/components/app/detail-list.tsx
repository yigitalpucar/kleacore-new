import { cn } from "@/lib/utils";
import { CopyButton } from "./copy-button";

export type DetailItem = {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Monospace value (IDs, IPs, hashes). */
  mono?: boolean;
  /** Shows a copy button; pass the raw string to copy. */
  copy?: string;
  /** Hide the row when the value is empty (default true). */
  hideEmpty?: boolean;
};

/**
 * Key / value list. `layout="rows"` (default) puts label left, value right;
 * `layout="grid"` stacks label over value in 2–3 columns.
 */
export function DetailList({
  items,
  layout = "rows",
  columns = 2,
  className,
}: {
  items: DetailItem[];
  layout?: "rows" | "grid";
  columns?: 2 | 3;
  className?: string;
}) {
  const visible = items.filter(
    (i) => !(i.hideEmpty !== false && (i.value === null || i.value === undefined || i.value === ""))
  );

  if (layout === "grid") {
    return (
      <dl className={cn("grid gap-x-6 gap-y-4 sm:grid-cols-2", columns === 3 && "lg:grid-cols-3", className)}>
        {visible.map((item, i) => (
          <div key={i} className="min-w-0 space-y-1">
            <dt className="text-xs text-muted-foreground">{item.label}</dt>
            <dd className={cn("flex min-w-0 items-center gap-1 text-sm font-medium", item.mono && "font-mono text-[13px]")}>
              <span className="min-w-0 break-words">{item.value}</span>
              {item.copy ? <CopyButton value={item.copy} label={`${typeof item.label === "string" ? item.label : "Değer"} kopyala`} /> : null}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <dl className={cn("divide-y divide-dashed text-sm", className)}>
      {visible.map((item, i) => (
        <div key={i} className="flex min-h-10 items-center justify-between gap-4 py-2 first:pt-0 last:pb-0">
          <dt className="shrink-0 text-muted-foreground">{item.label}</dt>
          <dd
            className={cn(
              "flex min-w-0 items-center justify-end gap-1 text-right font-medium",
              item.mono && "font-mono text-[13px]"
            )}
          >
            <span className="min-w-0 break-words">{item.value}</span>
            {item.copy ? <CopyButton value={item.copy} label={`${typeof item.label === "string" ? item.label : "Değer"} kopyala`} /> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
