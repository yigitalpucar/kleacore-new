import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Globe, Home, LifeBuoy, Lock, Server } from "lucide-react";
import { Container } from "@/components/site/container";
import { GridBackground } from "@/components/site/grid-lines";
import { Eyebrow } from "@/components/site/eyebrow";
import { buttonClasses } from "@/components/site/button-classes";
import { SiteShell } from "@/components/site/kurumsal/site-shell";
import { BackButton } from "@/components/site/kurumsal/back-button";

export const metadata: Metadata = {
  title: "Sayfa Bulunamadı",
  robots: { index: false },
};

const popularPages = [
  { name: "Web hosting", href: "/hosting/linux", icon: Server },
  { name: "Alan adı kaydı", href: "/domain/kayit", icon: Globe },
  { name: "SSL sertifikası", href: "/ssl/standart", icon: Lock },
  { name: "Destek merkezi", href: "/musteri/destek", icon: LifeBuoy },
];

export default function NotFound() {
  return (
    <SiteShell>
      <section className="relative isolate overflow-hidden">
        <GridBackground className="-z-10" />
        <Container className="py-20 md:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <p
              aria-hidden
              className="select-none bg-gradient-to-b from-foreground/20 to-transparent bg-clip-text font-mono text-[7rem] font-semibold leading-none tracking-tighter text-transparent sm:text-[10rem]"
            >
              404
            </p>
            <Eyebrow className="mt-2">Hata 404</Eyebrow>
            <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Sayfa bulunamadı
            </h1>
            <p className="mx-auto mt-4 max-w-md text-pretty text-muted-foreground">
              Aradığınız sayfa taşınmış, silinmiş veya hiç var olmamış olabilir. Sizi doğru yere
              yönlendirelim.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/" className={buttonClasses()}>
                <Home aria-hidden className="size-4" />
                Ana sayfaya git
              </Link>
              <Link href="/iletisim" className={buttonClasses({ variant: "outline" })}>
                Yardım al
              </Link>
            </div>
          </div>

          <div className="mx-auto mt-16 max-w-3xl">
            <p className="mb-4 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Belki bunlardan birini arıyordunuz
            </p>
            <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4">
              {popularPages.map((page) => (
                <li key={page.href} className="bg-background">
                  <Link
                    href={page.href}
                    className="group flex h-full flex-col gap-4 p-5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <span className="flex items-center justify-between">
                      <page.icon aria-hidden className="size-5 text-foreground/80" />
                      <ArrowUpRight aria-hidden className="size-4 text-muted-foreground group-hover:text-foreground" />
                    </span>
                    <span className="text-sm font-medium">{page.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex justify-center">
              <BackButton />
            </div>
          </div>
        </Container>
      </section>
    </SiteShell>
  );
}
