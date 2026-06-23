"use client";

import type { LucideIcon } from "lucide-react";
import { BlurFade } from "@/components/magicui/blur-fade";
import { cn } from "@/lib/utils";

type PageHeroAccent = "default" | "emerald" | "sky" | "amber" | "violet";

const accentStyles: Record<
  PageHeroAccent,
  { glow: string; badge: string; gradient: string }
> = {
  default: {
    glow: "bg-primary/20",
    badge: "text-primary",
    gradient: "from-primary/10 via-transparent to-transparent",
  },
  emerald: {
    glow: "bg-emerald-500/20",
    badge: "text-emerald-600 dark:text-emerald-400",
    gradient: "from-emerald-500/10 via-transparent to-transparent",
  },
  sky: {
    glow: "bg-sky-500/20",
    badge: "text-sky-600 dark:text-sky-400",
    gradient: "from-sky-500/10 via-transparent to-transparent",
  },
  amber: {
    glow: "bg-amber-500/20",
    badge: "text-amber-600 dark:text-amber-400",
    gradient: "from-amber-500/10 via-transparent to-transparent",
  },
  violet: {
    glow: "bg-violet-500/20",
    badge: "text-violet-600 dark:text-violet-400",
    gradient: "from-violet-500/10 via-transparent to-transparent",
  },
};

interface PageHeroProps {
  badge?: string;
  badgeIcon?: LucideIcon;
  title: string;
  titleHighlight?: string;
  description: string;
  accent?: PageHeroAccent;
  children?: React.ReactNode;
  className?: string;
}

export function PageHero({
  badge,
  badgeIcon: BadgeIcon,
  title,
  titleHighlight,
  description,
  accent = "default",
  children,
  className,
}: PageHeroProps) {
  const styles = accentStyles[accent];

  return (
    <section
      className={cn(
        "relative overflow-hidden border-b bg-gradient-to-b from-muted/40 to-background py-16 md:py-24",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:28px_28px]" />
      <div
        className={cn(
          "pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full blur-3xl",
          styles.glow
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-b",
          styles.gradient
        )}
      />

      <div className="container relative">
        <BlurFade delay={0.05} inView>
          <div className="mx-auto max-w-3xl text-center">
            {badge ? (
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border bg-background/80 px-4 py-1.5 text-sm font-medium shadow-sm backdrop-blur-sm">
                {BadgeIcon ? (
                  <BadgeIcon className={cn("h-4 w-4", styles.badge)} />
                ) : null}
                <span>{badge}</span>
              </div>
            ) : null}

            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              {title}
              {titleHighlight ? (
                <>
                  <br />
                  <span className={cn("bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent")}>
                    {titleHighlight}
                  </span>
                </>
              ) : null}
            </h1>

            <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              {description}
            </p>

            {children ? <div className="mt-8">{children}</div> : null}
          </div>
        </BlurFade>
      </div>
    </section>
  );
}