"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { User, Settings, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogoutButton } from "@/components/auth/logout-button";

export function UserMenu() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <Button variant="ghost" size="icon" className="animate-pulse">
        <User className="h-5 w-5" />
      </Button>
    );
  }

  if (!session?.user) {
    return (
      <Button variant="ghost" size="icon" asChild>
        <Link href="/musteri/giris">
          <User className="h-5 w-5" />
        </Link>
      </Button>
    );
  }

  const isAdmin = (session.user as { role?: string }).role === "ADMIN";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
            {session.user.name?.charAt(0).toUpperCase() || "U"}
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
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
  );
}
