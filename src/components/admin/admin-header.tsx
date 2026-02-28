"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Bell, User, ChevronDown, Settings } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "./theme-toggle";

const notifications = [
  {
    id: 1,
    title: "Yeni destek talebi",
    description: "Ahmet Yılmaz - Hosting sorunu",
    time: "5 dk önce",
    unread: true,
  },
  {
    id: 2,
    title: "Ödeme alındı",
    description: "Fatura #2024-0156 - ₺1.250,00",
    time: "1 saat önce",
    unread: true,
  },
  {
    id: 3,
    title: "Sunucu uyarısı",
    description: "SRV-03 CPU kullanımı yüksek",
    time: "2 saat önce",
    unread: false,
  },
];

export function AdminHeader({ userName = "Admin" }: { userName?: string }) {
  const [searchQuery, setSearchQuery] = useState("");
  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <div className="flex items-center gap-4">
      {/* Search */}
      <div className="relative w-64 lg:w-80 hidden md:block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
        <Input
          type="search"
          placeholder="Ara..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-500 focus-visible:ring-primary h-9"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[10px] font-medium text-white flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">
                <span className="font-semibold text-zinc-900 dark:text-white">Bildirimler</span>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                  Tümünü Okundu İşaretle
                </Button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    className="flex flex-col items-start gap-1 p-3 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <div className="flex items-center gap-2">
                      {notification.unread && (
                        <span className="h-2 w-2 rounded-full bg-primary" />
                      )}
                      <span className="font-medium text-zinc-900 dark:text-white">{notification.title}</span>
                    </div>
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">{notification.description}</span>
                    <span className="text-xs text-zinc-500">{notification.time}</span>
                  </DropdownMenuItem>
                ))}
              </div>
              <div className="border-t border-zinc-200 dark:border-zinc-800 p-2">
                <Button variant="ghost" className="w-full text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                  Tüm Bildirimleri Gör
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white text-sm font-medium">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div className="hidden md:flex flex-col items-start">
                  <span className="text-sm font-medium text-zinc-900 dark:text-white">{userName}</span>
                  <span className="text-xs text-zinc-500">Yönetici</span>
                </div>
                <ChevronDown className="h-4 w-4 hidden md:block" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <DropdownMenuItem asChild className="cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <Link href="/yonetim/ayarlar" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <span>Ayarlar</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-200 dark:bg-zinc-800" />
              <DropdownMenuItem className="cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 text-red-500 p-0">
                <LogoutButton className="flex items-center gap-2 w-full px-2 py-1.5" />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
      </div>
    </div>
  );
}
