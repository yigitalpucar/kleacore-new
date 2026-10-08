import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Beams } from "@/components/site/beams";
import { buttonClasses } from "@/components/site/button-classes";
import { Container } from "@/components/site/container";
import { GridBackground, GridLineHorizontal, GridLineVertical } from "@/components/site/grid-lines";
import { Price } from "@/components/site/price";
import { StatusPill } from "@/components/site/status-pill";
import { cn } from "@/lib/utils";

export interface StartingPrice {
  label: string;
  href: string;
  /** Lowest VAT-exclusive price from the DB. */
  amount: number;
  period: "ay" | "yıl";
  note?: string;
}

/**
 * Homepage hero — static (no carousel): beams & grid background, value
 * proposition, two CTAs and a framed strip of real starting prices.
 */
export function HomeHero({ startingPrices }: { startingPrices: StartingPrice[] }) {
  const cols =
    startingPrices.length >= 4
      ? "lg:grid-cols-4"
      : startingPrices.length === 3
        ? "lg:grid-cols-3"
        : "lg:grid-cols-2";

  return (
    <section className="relative isolate overflow-hidden">
      <GridBackground className="-z-10" />
      <Beams className="-z-10 hidden md:block" />

      <Container className="pb-16 pt-14 sm:pt-20 md:pb-24 lg:pt-28">
        <div className="mx-auto max-w-4xl text-center">
          <StatusPill>İstanbul lokasyon · NVMe SSD · LiteSpeed</StatusPill>
          <h1 className="mt-7 text-balance text-[2.6rem] font-semibold leading-[1.05] tracking-tighter sm:text-6xl lg:text-7xl">
            Alan adı, hosting ve sunucu{" "}
            <span className="text-muted-foreground">tek bir panelde.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            cPanel ve LiteSpeed ile web hosting, NVMe SSD diskli VDS sunucular,
            alan adı ve SSL hizmetleri. Ücretsiz Let&apos;s Encrypt SSL, 7/24
            destek ve açık fiyatlar.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/hosting/linux" className={buttonClasses({ size: "lg" })}>
              Hosting paketlerini incele
              <ArrowRight aria-hidden className="size-4" />
            </Link>
            <Link href="#alan-adi" className={buttonClasses({ variant: "outline", size: "lg" })}>
              Alan adı sorgula
            </Link>
          </div>
        </div>

        {startingPrices.length > 0 ? (
          <div className="relative mx-auto mt-16 max-w-5xl md:mt-20">
            <GridLineHorizontal className="top-0 md:-inset-x-24" />
            <GridLineHorizontal className="bottom-0 md:-inset-x-24" />
            <GridLineVertical className="left-0 md:-inset-y-12" />
            <GridLineVertical className="right-0 md:-inset-y-12" />
            <ul className={cn("grid grid-cols-1 bg-background/70 backdrop-blur-sm sm:grid-cols-2", cols)}>
              {startingPrices.map((item, index) => (
                <li
                  key={item.href}
                  className={cn(
                    "relative",
                    index > 0 && "border-t border-dashed sm:border-t-0",
                    index % 2 === 1 && "sm:border-l sm:border-dashed",
                    index >= 2 && "sm:border-t sm:border-dashed lg:border-t-0",
                    index > 0 && "lg:border-l lg:border-dashed"
                  )}
                >
                  <Link
                    href={item.href}
                    className="group flex h-full flex-col gap-3 p-5 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none sm:p-6"
                  >
                    <span className="flex items-center justify-between gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      {item.label}
                      <ArrowUpRight
                        aria-hidden
                        className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
                      />
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {item.note ?? "Başlayan fiyatlarla"}
                    </span>
                    <Price amount={item.amount} period={item.period} size="md" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Container>
    </section>
  );
}
