"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChevronDown, Menu, Moon, ShoppingCart, Sun } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useCartStore } from "@/store/cart-store";
import { Container } from "@/components/site/container";
import { buttonClasses } from "@/components/site/button-classes";
import { UserMenu } from "./user-menu";
import { companyLinks, navGroups, type NavGroup } from "./nav-data";

const iconButton =
  "relative inline-flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="KLEACORE ana sayfa"
      className={cn(
        "flex shrink-0 items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4",
        className
      )}
    >
      <Image src="/logo.svg" alt="" width={132} height={28} className="hidden h-7 w-auto dark:block" priority />
      <Image
        src="/logo-light.svg"
        alt=""
        width={132}
        height={28}
        className="h-7 w-auto [filter:brightness(0)_saturate(100%)] dark:hidden"
        priority
      />
    </Link>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      type="button"
      className={iconButton}
      aria-label="Açık/koyu temayı değiştir"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun aria-hidden className="size-[18px] rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
      <Moon aria-hidden className="absolute size-[18px] rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
    </button>
  );
}

function CartButton({ className }: { className?: string }) {
  const totalItems = useCartStore((state) => state.getTotalItems());
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const count = hasHydrated ? totalItems : 0;
  return (
    <Link
      href="/sepet"
      className={cn(iconButton, className)}
      aria-label={count > 0 ? `Sepet, ${count} ürün` : "Sepet"}
    >
      <ShoppingCart aria-hidden className="size-[18px]" />
      {count > 0 ? (
        <span
          aria-hidden
          className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-semibold text-background"
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}

function MegaPanel({ group, onNavigate, id }: { group: NavGroup; onNavigate: () => void; id: string }) {
  return (
    <motion.div
      id={id}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
      className="absolute inset-x-0 top-full border-b bg-background shadow-[0_24px_40px_-24px_rgba(0,0,0,0.25)] backdrop-blur-xl"
    >
      <Container className="grid grid-cols-12 gap-8 py-8">
        <div className="col-span-8">
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {group.description}
          </p>
          <ul className="grid grid-cols-2 gap-1">
            {group.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className="group flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background transition-colors group-hover:border-foreground/20">
                    <item.icon aria-hidden className="size-4 text-foreground/80" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{item.title}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{item.description}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="col-span-4">
          <div className="dark relative flex h-full flex-col justify-between overflow-hidden rounded-xl bg-neutral-950 p-6 text-foreground ring-1 ring-white/10">
            <div aria-hidden className="absolute inset-0 bg-grid mask-radial-top opacity-80" />
            <div className="relative">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Öne çıkan</p>
              <p className="mt-3 text-lg font-semibold tracking-tight">{group.featured.title}</p>
              <p className="mt-1.5 text-sm text-muted-foreground">{group.featured.description}</p>
            </div>
            <Link
              href={group.featured.href}
              onClick={onNavigate}
              className={buttonClasses({ variant: "inverted", className: "relative mt-6 w-full" })}
            >
              {group.featured.cta}
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </div>
      </Container>
    </motion.div>
  );
}

export function Header() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [active, setActive] = React.useState<string | null>(null);
  const [scrolled, setScrolled] = React.useState(false);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close menus on navigation.
  React.useEffect(() => {
    setActive(null);
    setMobileOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActive(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  const open = (title: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setActive(title);
  };
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setActive(null), 120);
  };

  const isLoggedIn = status === "authenticated" && Boolean(session?.user);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b transition-colors duration-200",
        scrolled || active
          ? "border-border bg-background/85 backdrop-blur-xl"
          : "border-transparent bg-background/60 backdrop-blur-md"
      )}
      onMouseLeave={scheduleClose}
    >
      <Container className="flex h-16 items-center gap-2">
        <Logo />

        <nav aria-label="Ana menü" className="ml-6 hidden lg:block">
          <ul className="flex items-center">
            {navGroups.map((group) => {
              const isActive = active === group.title;
              const panelId = `mega-${group.title.toLowerCase().replace(/\s+/g, "-")}`;
              const current = group.items.some((item) => pathname?.startsWith(item.href));
              return (
                <li key={group.title} onMouseEnter={() => open(group.title)}>
                  <button
                    type="button"
                    aria-expanded={isActive}
                    aria-controls={panelId}
                    onClick={() => (isActive ? setActive(null) : open(group.title))}
                    className={cn(
                      "inline-flex h-10 items-center gap-1 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isActive || current
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                      isActive && "bg-muted/70"
                    )}
                  >
                    {group.title}
                    <ChevronDown
                      aria-hidden
                      className={cn("size-3.5 transition-transform duration-200", isActive && "rotate-180")}
                    />
                  </button>
                  <AnimatePresence>
                    {isActive ? (
                      <MegaPanel group={group} id={panelId} onNavigate={() => setActive(null)} />
                    ) : null}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-0.5">
          <ThemeToggle />
          <CartButton />
          <div className="ml-2 hidden items-center gap-2 lg:flex">
            {status === "loading" ? (
              <span aria-hidden className="h-9 w-36 animate-pulse rounded-md bg-muted" />
            ) : isLoggedIn ? (
              <UserMenu />
            ) : (
              <>
                <Link href="/musteri/giris" className={buttonClasses({ variant: "ghost", size: "sm" })}>
                  Giriş Yap
                </Link>
                <Link href="/musteri/giris" className={buttonClasses({ variant: "primary", size: "sm" })}>
                  Kayıt Ol
                </Link>
              </>
            )}
          </div>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button type="button" className={cn(iconButton, "lg:hidden")} aria-label="Menüyü aç">
                <Menu aria-hidden className="size-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="flex w-[min(100vw-1.5rem,400px)] flex-col gap-0 p-0">
              <SheetHeader className="border-b px-5 py-4 text-left">
                <SheetTitle className="text-left">
                  <span className="sr-only">KLEACORE menü</span>
                  <Image src="/logo.svg" alt="" width={112} height={24} className="hidden h-6 w-auto dark:block" />
                  <Image
                    src="/logo-light.svg"
                    alt=""
                    width={112}
                    height={24}
                    className="h-6 w-auto [filter:brightness(0)_saturate(100%)] dark:hidden"
                  />
                </SheetTitle>
                <SheetDescription className="sr-only">Site menüsü</SheetDescription>
              </SheetHeader>

              <nav aria-label="Mobil menü" className="flex-1 overflow-y-auto px-3 py-3">
                {navGroups.map((group, index) => (
                  <MobileGroup
                    key={group.title}
                    group={group}
                    defaultOpen={index === 1}
                    onNavigate={() => setMobileOpen(false)}
                  />
                ))}
                <div className="mt-3 border-t border-dashed pt-3">
                  <p className="px-2 pb-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    Kurumsal
                  </p>
                  <ul className="grid grid-cols-2">
                    {companyLinks.slice(0, 4).map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          onClick={() => setMobileOpen(false)}
                          className="flex min-h-11 items-center rounded-md px-2 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        >
                          {link.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </nav>

              <div className="border-t bg-muted/30 p-4">
                {isLoggedIn ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      href="/musteri/panel"
                      onClick={() => setMobileOpen(false)}
                      className={buttonClasses({ variant: "primary" })}
                    >
                      Müşteri Paneli
                    </Link>
                    <MobileCartLink onNavigate={() => setMobileOpen(false)} />
                  </div>
                ) : (
                  <div className="grid gap-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        href="/musteri/giris"
                        onClick={() => setMobileOpen(false)}
                        className={buttonClasses({ variant: "outline" })}
                      >
                        Giriş Yap
                      </Link>
                      <Link
                        href="/musteri/giris"
                        onClick={() => setMobileOpen(false)}
                        className={buttonClasses({ variant: "primary" })}
                      >
                        Kayıt Ol
                      </Link>
                    </div>
                    <MobileCartLink onNavigate={() => setMobileOpen(false)} />
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </Container>
    </header>
  );
}

function MobileCartLink({ onNavigate }: { onNavigate: () => void }) {
  const totalItems = useCartStore((state) => state.getTotalItems());
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const count = hasHydrated ? totalItems : 0;
  return (
    <Link href="/sepet" onClick={onNavigate} className={buttonClasses({ variant: "outline" })}>
      <ShoppingCart aria-hidden className="size-4" />
      Sepet{count > 0 ? ` (${count})` : ""}
    </Link>
  );
}

function MobileGroup({
  group,
  onNavigate,
  defaultOpen = false,
}: {
  group: NavGroup;
  onNavigate: () => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const id = `mobile-nav-${group.title.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className="border-b border-dashed py-1 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={id}
        className="flex min-h-12 w-full items-center justify-between rounded-md px-2 text-base font-medium transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {group.title}
        <ChevronDown aria-hidden className={cn("size-4 transition-transform duration-200", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.ul
            id={id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden pb-2"
          >
            {group.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className="flex min-h-11 items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted/60"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background">
                    <item.icon aria-hidden className="size-4 text-foreground/80" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium">{item.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
                  </span>
                </Link>
              </li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
