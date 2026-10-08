import { cn } from "@/lib/utils";
import { WORLD_DOTS_PATH } from "./world-dots";

const W = 120;
const H = 60;

/** İstanbul (41.01, 28.98) in the map's own projection, from svg-dotted-map `addMarkers`. */
const ISTANBUL = { x: 70.24, y: 20.93 };

/**
 * Dotted world map with a single pin: İstanbul, our only location.
 * Adapted from Aceternity "world map illustration". Static SVG, no JS.
 */
export function IstanbulMap({ className }: { className?: string }) {
  return (
    <figure className={cn("relative w-full", className)}>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full text-neutral-400/70 dark:text-neutral-600"
          role="img"
          aria-label="Dünya haritası üzerinde tek lokasyon: İstanbul, Türkiye"
        >
          <path
            d={WORLD_DOTS_PATH}
            stroke="currentColor"
            strokeWidth={0.46}
            strokeLinecap="round"
            fill="none"
          />
        </svg>
        <div
          aria-hidden
          className="absolute"
          style={{ left: `${(ISTANBUL.x / W) * 100}%`, top: `${(ISTANBUL.y / H) * 100}%` }}
        >
          <span className="absolute left-0 top-0 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/15 motion-safe:animate-ping" />
          <span className="absolute left-0 top-0 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground ring-4 ring-background" />
          <span className="absolute bottom-3 left-0 -translate-x-1/2 whitespace-nowrap rounded-md border bg-background px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider shadow-sm">
            İstanbul
          </span>
        </div>
      </div>
    </figure>
  );
}
