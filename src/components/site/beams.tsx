"use client";

import { motion, useReducedMotion } from "framer-motion";
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
  const reduce = useReducedMotion();

  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {beams.map((beam) => (
        <div
          key={beam.left}
          className="absolute inset-y-0"
          style={{ left: `${beam.left}%` }}
        >
          {rails ? <div className="absolute inset-y-0 left-0 line-dashed-y mask-fade-y" /> : null}
          {reduce ? null : (
            <motion.div
              className="absolute -left-px w-[3px] rounded-full bg-gradient-to-b from-transparent via-foreground/50 to-foreground"
              style={{ height: beam.height }}
              initial={{ top: "-15%", opacity: 0 }}
              animate={{ top: ["-15%", "105%"], opacity: [0, 1, 1, 0] }}
              transition={{
                duration: beam.duration,
                delay: beam.delay,
                repeat: Infinity,
                repeatDelay: 2.5,
                ease: "linear",
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
