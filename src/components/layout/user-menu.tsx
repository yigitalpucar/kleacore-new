"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { ChevronDown, FileText, LayoutDashboard, Package, Settings, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogoutButton } from "@/components/auth/logout-button";
import { buttonClasses } from "@/components/site/button-classes";
import { cn } from "@/lib/utils";

const panelLinks = [
  { href: "/musteri/panel", label: "Müşteri Paneli", icon: User },
  { href: "/musteri/panel/hizmetlerim", label: "Hizmetlerim", icon: Package },
  { href: "/musteri/panel/faturalar", label: "Faturalarım", icon: FileText },
  { href: "/musteri/panel/ayarlar", label: "Ayarlar", icon: Settings },
];

/** Account menu for signed-in users; "Giriş Yap" link otherwise. */
export function UserMenu({ className }: { className?: string }) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <span aria-hidden className={cn("h-9 w-28 animate-pulse rounded-md bg-muted", className)} />;
  }

  if (!session?.user) {
    return (
      <Link href="/musteri/giris" className={buttonClasses({ variant: "ghost", size: "sm", className })}>
        <User aria-hidden className="size-4" />
        Giriş Yap
      </Link>
    );
  }

  const isAdmin = (session.user as { role?: string }).role === "ADMIN";
  const initial = session.user.name?.trim().charAt(0).toLocaleUpperCase("tr-TR") || "K";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Hesap menüsü"
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-md border bg-background pl-1 pr-2 text-sm font-medium transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className
          )}
        >
          <span
            aria-hidden
            className="flex size-8 items-center justify-center rounded-[5px] bg-foreground text-xs font-semibold text-background"
          >
            {initial}
          </span>
          <span className="hidden xl:inline">Hesabım</span>
          <ChevronDown aria-hidden className="size-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="z-[70] w-60">
        <div className="px-3 py-2">
          <p className="truncate text-sm font-medium">{session.user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{session.user.email}</p>
        </div>
        <DropdownMenuSeparator />
        {isAdmin ? (
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link href="/yonetim" className="flex items-center gap-2">
              <LayoutDashboard aria-hidden className="size-4" />
              <span>Yönetim Paneli</span>
            </Link>
          </DropdownMenuItem>
        ) : null}
        {panelLinks.map((link) => (
          <DropdownMenuItem key={link.href} asChild className="cursor-pointer">
            <Link href={link.href} className="flex items-center gap-2">
              <link.icon aria-hidden className="size-4" />
              <span>{link.label}</span>
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer p-0 text-red-600 dark:text-red-400">
          <LogoutButton className="flex w-full items-center gap-2 px-2 py-1.5" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
