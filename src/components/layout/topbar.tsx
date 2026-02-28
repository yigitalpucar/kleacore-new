"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Mail,
  ChevronRight,
  ChevronDown,
  User,
  Settings,
  FileText,
  Package,
  LayoutDashboard,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogoutButton } from "@/components/auth/logout-button";

export function Topbar() {
  const { data: session, status } = useSession();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  return (
    <div className="relative z-[60] bg-zinc-900 text-zinc-300 text-xs border-b border-zinc-800">
      <div className="container flex items-center justify-between h-9">
        {/* Left - Contact Info */}
        <div className="hidden sm:flex items-center gap-4">
          <a
            href="mailto:support@kleacore.com"
            className="flex items-center gap-1.5 hover:text-white transition-colors"
          >
            <Mail className="h-3 w-3" />
            <span>support@kleacore.com</span>
          </a>
        </div>

        {/* Center - Promo Banner */}
        <div className="flex items-center gap-2 mx-auto sm:mx-0">
          <Link
            href="/hosting/linux"
            className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors font-medium"
          >
            <span>%30 İndirim Fırsatı</span>
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Right - Auth */}
        <div className="flex items-center gap-3">
          {status === "loading" ? (
            <div className="h-4 w-24 rounded bg-zinc-700/60 animate-pulse" />
          ) : session?.user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-primary hover:text-primary/80 transition-colors font-medium"
                >
                  <User className="h-3 w-3" />
                  <span>Müşteri Paneli</span>
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} className="w-56 z-[70]">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium">{session.user.name}</p>
                  <p className="text-xs text-muted-foreground">{session.user.email}</p>
                </div>
                <DropdownMenuSeparator />
                {isAdmin && (
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href="/yonetim" className="flex items-center gap-2">
                      <LayoutDashboard className="h-4 w-4" />
                      <span>Yönetim Paneli</span>
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href="/musteri/panel" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>Müşteri Paneli</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href="/musteri/panel/hizmetlerim" className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    <span>Hizmetlerim</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href="/musteri/panel/faturalar" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span>Faturalarım</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href="/musteri/panel/ayarlar" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    <span>Ayarlar</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer text-red-500 p-0">
                  <LogoutButton className="flex items-center gap-2 w-full px-2 py-1.5" />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link
                href="/musteri/giris"
                className="hidden sm:flex items-center gap-1.5 hover:text-white transition-colors"
              >
                <User className="h-3 w-3" />
                <span>Giriş Yap</span>
              </Link>
              <span className="hidden sm:inline text-zinc-700">|</span>
              <Link
                href="/musteri/giris"
                className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors font-medium"
              >
                <span>Kayıt Ol</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
