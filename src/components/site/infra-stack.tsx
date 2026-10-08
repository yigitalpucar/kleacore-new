import { cn } from "@/lib/utils";
import { CornerTicks } from "./grid-lines";
import { StatusDot } from "./status-pill";

export interface InfraLayer {
  /** Mono key on the left, e.g. "web". */
  key: string;
  label: string;
  value: string;
}

const defaultLayers: InfraLayer[] = [
  { key: "lokasyon", label: "Veri merkezi", value: "İstanbul" },
  { key: "disk", label: "Depolama", value: "NVMe SSD" },
  { key: "web", label: "Web sunucu", value: "LiteSpeed" },
  { key: "panel", label: "Kontrol paneli", value: "cPanel" },
  { key: "ssl", label: "Sertifika", value: "Let's Encrypt" },
  { key: "yedek", label: "Yedekleme", value: "Haftalık / günlük" },
];

/**
 * Illustrative "stack" panel describing the hosting infrastructure as
 * layers. Static and clearly labelled as a schematic — it shows no live
 * metrics. Customise `layers` per product (e.g. VDS: KVM, NVMe, port).
 */
export function InfraStack({
  layers = defaultLayers,
  title = "kleacore / altyapı",
  note = "Temsili şema — paket özellikleri ürün sayfalarında listelenir.",
  className,
}: {
  layers?: InfraLayer[];
  title?: string;
  note?: string;
  className?: string;
}) {
  return (
    <figure className={cn("relative", className)}>
      <div className="relative overflow-hidden rounded-2xl border bg-background shadow-[0_24px_48px_-24px_rgba(0,0,0,0.25)] dark:shadow-none">
        <CornerTicks />
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <span aria-hidden className="flex gap-1.5">
            <span className="size-2.5 rounded-full border bg-muted" />
            <span className="size-2.5 rounded-full border bg-muted" />
            <span className="size-2.5 rounded-full border bg-muted" />
          </span>
          <span className="ml-2 truncate font-mono text-xs text-muted-foreground">{title}</span>
        </div>
        <ol className="divide-y divide-dashed">
          {layers.map((layer, index) => (
            <li
              key={layer.key}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5"
            >
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{layer.value}</span>
                <span className="block truncate font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  {layer.label}
                </span>
              </span>
              <StatusDot pulse={false} />
            </li>
          ))}
        </ol>
      </div>
      {note ? (
        <figcaption className="mt-3 text-center font-mono text-[11px] text-muted-foreground">
          {note}
        </figcaption>
      ) : null}
    </figure>
  );
}
