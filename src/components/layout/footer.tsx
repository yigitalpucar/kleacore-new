import Link from "next/link";
import Image from "next/image";
import { Mail, MapPin } from "lucide-react";
import { Container } from "@/components/site/container";
import { GridLineHorizontal } from "@/components/site/grid-lines";
import { companyLinks, legalLinks, navGroups } from "./nav-data";

const linkClass =
  "inline-flex min-h-8 items-center rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Site footer — always dark (the `dark` class scopes the theme tokens).
 * Social links are intentionally omitted until real profile URLs exist.
 */
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="dark relative overflow-hidden border-t border-white/10 bg-neutral-950 text-foreground">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid mask-radial-top opacity-60" />

      <Container className="relative pt-14 md:pt-20">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,3fr)] lg:gap-16">
          <div>
            <Link
              href="/"
              aria-label="KLEACORE ana sayfa"
              className="inline-flex rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Image src="/logo.svg" alt="" width={140} height={30} className="h-7 w-auto" />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Alan adı, hosting, sunucu ve SSL hizmetleri. Fiyatlara KDV dahil
              değildir; %20 KDV ödeme adımında eklenir.
            </p>

            <address className="mt-6 space-y-3 text-sm not-italic text-muted-foreground">
              <p className="font-medium text-foreground">KLEAWORK DIGITAL LLC</p>
              <p className="flex gap-2">
                <MapPin aria-hidden className="mt-0.5 size-4 shrink-0" />
                <span>
                  30 N Gould St Ste R
                  <br />
                  Sheridan, WY 82801, USA
                </span>
              </p>
              <p>
                <a href="mailto:support@kleacore.com" className={`${linkClass} gap-2`}>
                  <Mail aria-hidden className="size-4" />
                  support@kleacore.com
                </a>
              </p>
              <p className="font-mono text-xs">EIN: 36-5157418</p>
            </address>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-6">
            {navGroups.map((group) => (
              <nav key={group.title} aria-label={group.title}>
                <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {group.title}
                </h2>
                <ul className="mt-4 space-y-1.5">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <Link href={item.href} className={linkClass}>
                        {item.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
            <nav aria-label="Kurumsal">
              <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Kurumsal
              </h2>
              <ul className="mt-4 space-y-1.5">
                {companyLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={linkClass}>
                      {link.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>

        <div className="relative mt-14 py-6">
          <GridLineHorizontal className="top-0" />
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm text-muted-foreground">
              © {year} KLEACORE · KLEAWORK DIGITAL LLC. Tüm hakları saklıdır.
            </p>
            <nav aria-label="Yasal">
              <ul className="flex flex-wrap gap-x-5 gap-y-1">
                {legalLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={linkClass}>
                      {link.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </Container>

      <div aria-hidden className="relative select-none overflow-hidden">
        <p className="-mb-[0.22em] bg-gradient-to-b from-white/[0.14] to-transparent bg-clip-text text-center font-semibold leading-none tracking-tighter text-transparent [font-size:clamp(4rem,19vw,17rem)]">
          KLEACORE
        </p>
      </div>
    </footer>
  );
}
