import { useId } from "react";
import { cn } from "@/lib/utils";

const defaultSquares: [number, number][] = [
  [1, 1],
  [3, 3],
  [2, 5],
  [4, 2],
  [6, 4],
  [0, 6],
];

/**
 * Decorative square grid with a few filled cells (Aceternity
 * "contact-form-grid" look). Deterministic, so it is SSR-safe.
 * Place inside a `relative overflow-hidden` parent.
 */
export function GridPattern({
  size = 20,
  squares = defaultSquares,
  className,
}: {
  size?: number;
  squares?: [number, number][];
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 [mask-image:radial-gradient(farthest-side_at_top_right,white,transparent)]",
        className
      )}
    >
      {/* Mirrored so the grid (and the filled cells) anchor to the top-right corner. */}
      <svg className="absolute inset-0 size-full -scale-x-100 fill-foreground/[0.05] stroke-foreground/[0.09]">
        <defs>
          <pattern id={id} width={size} height={size} patternUnits="userSpaceOnUse" x="-1" y="-1">
            <path d={`M.5 ${size}V.5H${size}`} fill="none" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" strokeWidth={0} fill={`url(#${id})`} />
        <svg x="-1" y="-1" className="overflow-visible">
          {squares.map(([x, y]) => (
            <rect
              key={`${x}-${y}`}
              strokeWidth={0}
              width={size + 1}
              height={size + 1}
              x={x * size}
              y={y * size}
            />
          ))}
        </svg>
      </svg>
    </div>
  );
}
