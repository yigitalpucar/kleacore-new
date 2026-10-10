import { cn } from "@/lib/utils";

interface Beam {
  /** Horizontal position in % of the parent. */
  left: number;
  duration: number;
  delay: number;
  height: number;
}

const defaultBeams: Beam[] = [
  { left: 6, duration: 7, delay: 0, height: 96 },
  { left: 18, duration: 5.5, delay: 2.4, height: 64 },
  { left: 82, duration: 6.5, delay: 1.1, height: 112 },
  { left: 94, duration: 6, delay: 3.6, height: 80 },
];

/**
 * Vertical dashed rails with light beams travelling down them
 * (adapted from Aceternity "hero section with beams and grid").
 * Purely decorative; disabled for users who prefer reduced motion.
 */
export function Beams({
  className,
  beams = defaultBeams,
  rails = true,
}: {
  className?: string;
  beams?: Beam[];
  /** Draw the dashed rails the beams travel on (default true). */
  rails?: boolean;
}) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {beams.map((beam) => (
        <div
          key={beam.left}
          className="absolute inset-y-0"
          style={{ left: `${beam.left}%` }}
        >
          {rails ? <div className="absolute inset-y-0 left-0 line-dashed-y mask-fade-y" /> : null}
          {/* CSS keyframes (globals.css "beam-drop"), so the hero ships no animation JS;
              the travel takes ~70% of each cycle, the rest is the pause. */}
          <div
            className="absolute -left-px w-[3px] rounded-full bg-gradient-to-b from-transparent via-foreground/50 to-foreground opacity-0 motion-reduce:hidden"
            style={{
              height: beam.height,
              top: "-15%",
              animation: `beam-drop ${(beam.duration + 2.5).toFixed(2)}s linear ${beam.delay}s infinite`,
            }}
          />
        </div>
      ))}
    </div>
  );
}
