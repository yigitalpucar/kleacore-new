import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Container } from "./container";
import { Eyebrow } from "./eyebrow";
import { GridLineHorizontal, GridLineVertical } from "./grid-lines";
import { buttonClasses } from "./button-classes";

export interface CtaAction {
  label: string;
  href: string;
}

export interface CtaBandProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  primary: CtaAction;
  secondary?: CtaAction;
  /** Right-hand column (e.g. contact facts). Defaults to support contact. */
  aside?: React.ReactNode;
  className?: string;
}

/** Closing call-to-action band framed by dashed grid lines. */
export function CtaBand({
  eyebrow,
  title,
  description,
  primary,
  secondary,
  aside,
  className,
}: CtaBandProps) {
  return (
    <section className={cn("relative overflow-hidden py-16 md:py-24", className)}>
      <Container>
        <div className="relative grid grid-cols-1 bg-gradient-to-br from-muted/60 to-background md:grid-cols-3 dark:from-muted/30">
          <GridLineHorizontal className="top-0 md:-inset-x-16" />
          <GridLineHorizontal className="bottom-0 md:-inset-x-16" />
          <GridLineVertical className="left-0 md:-inset-y-10" />
          <GridLineVertical className="right-0 md:-inset-y-10" />

          <div className="p-6 sm:p-10 md:col-span-2 md:p-14">
            {eyebrow ? <Eyebrow className="mb-4">{eyebrow}</Eyebrow> : null}
            <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">
              {title}
            </h2>
            {description ? (
              <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground">
                {description}
              </p>
            ) : null}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={primary.href} className={buttonClasses({ variant: "primary" })}>
                {primary.label}
                <ArrowRight aria-hidden className="size-4" />
              </Link>
              {secondary ? (
                <Link href={secondary.href} className={buttonClasses({ variant: "outline" })}>
                  {secondary.label}
                </Link>
              ) : null}
            </div>
          </div>

          <div className="relative p-6 sm:p-10 md:p-14">
            <GridLineHorizontal className="top-0 md:hidden" />
            <GridLineVertical className="left-0 hidden md:block" fade={false} />
            {aside ?? <DefaultAside />}
          </div>
        </div>
      </Container>
    </section>
  );
}

function DefaultAside() {
  return (
    <div className="flex h-full flex-col justify-center gap-4 text-sm">
      <Eyebrow>Destek</Eyebrow>
      <p className="leading-relaxed text-muted-foreground">
        Paket seçimi veya taşıma konusunda sorunuz mu var? Destek ekibimize her
        zaman yazabilirsiniz.
      </p>
      <a
        href="mailto:support@kleacore.com"
        className="inline-flex min-h-11 items-center font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        support@kleacore.com
      </a>
    </div>
  );
}
