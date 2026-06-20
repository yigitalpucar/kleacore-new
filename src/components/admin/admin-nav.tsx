"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ShoppingBag,
  Server,
  Headphones,
  FileText,
  BarChart3,
  Settings,
  Layers,
  Box,
  Tag,
  Percent,
  ShoppingCart,
  ChevronDown,
  ListOrdered,
  CheckCircle,
  Clock,
  Pause,
  XCircle,
  ArrowUpDown,
  Puzzle,
  MessageSquareX,
  UserPlus,
  Store,
  Building2,
  UserCheck,
  UserX,
  AlertTriangle,
  FilePlus,
  Receipt,
  HandCoins,
  Package,
  PlusCircle,
  Timer,
  ScrollText,
  Cog,
  BookOpen,
  Newspaper,
  Plug,
  FileCheck,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: {
    title: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
}

const navItems: NavItem[] = [
  { title: "Dashboard", href: "/yonetim", icon: LayoutDashboard },
  {
    title: "Müşteriler",
    href: "/yonetim/musteriler",
    icon: Users,
    children: [
      { title: "Genel Bakış", href: "/yonetim/musteriler", icon: LayoutDashboard },
      { title: "Tüm Müşteriler", href: "/yonetim/musteriler/tum-musteriler", icon: Users },
      { title: "Bireysel", href: "/yonetim/musteriler/bireysel", icon: UserCheck },
      { title: "Kurumsal", href: "/yonetim/musteriler/kurumsal", icon: Building2 },
      { title: "Askıda", href: "/yonetim/musteriler/askida", icon: Pause },
      { title: "Kapalı Hesaplar", href: "/yonetim/musteriler/kapali", icon: UserX },
      { title: "Müşteri Ekle", href: "/yonetim/musteri-ekle", icon: UserPlus },
      { title: "Bayiler", href: "/yonetim/bayiler", icon: Store },
      { title: "Affiliate Ödemeleri", href: "/yonetim/affiliate-odemeleri", icon: HandCoins },
    ],
  },
  {
    title: "Ürünler",
    href: "/yonetim/urunler",
    icon: ShoppingBag,
    children: [
      { title: "Genel Bakış", href: "/yonetim/urunler", icon: LayoutDashboard },
      { title: "Kategoriler", href: "/yonetim/urunler/kategoriler", icon: Layers },
      { title: "Paketler", href: "/yonetim/urunler/paketler", icon: Box },
      { title: "Özellikler", href: "/yonetim/urunler/ozellikler", icon: Tag },
      { title: "Promosyonlar", href: "/yonetim/urunler/promosyonlar", icon: Percent },
    ],
  },
  {
    title: "Siparişler",
    href: "/yonetim/siparisler",
    icon: ShoppingCart,
    children: [
      { title: "Genel Bakış", href: "/yonetim/siparisler", icon: LayoutDashboard },
      { title: "Tüm Siparişler", href: "/yonetim/siparisler/tum-siparisler", icon: ListOrdered },
      { title: "Aktif", href: "/yonetim/siparisler/aktif", icon: CheckCircle },
      { title: "Beklemede", href: "/yonetim/siparisler/beklemede", icon: Clock },
      { title: "Askıda", href: "/yonetim/siparisler/askida", icon: Pause },
      { title: "İptal Edilen", href: "/yonetim/siparisler/iptal", icon: XCircle },
      { title: "Yükseltme/Düşürme", href: "/yonetim/siparisler/yukseltme-dusurme", icon: ArrowUpDown },
      { title: "Eklentiler", href: "/yonetim/siparisler/eklentiler", icon: Puzzle },
      { title: "İptal Talepleri", href: "/yonetim/siparisler/iptal-talepleri", icon: MessageSquareX },
    ],
  },
  {
    title: "Hizmetler",
    href: "/yonetim/hizmetler",
    icon: Package,
    children: [
      { title: "Genel Bakış", href: "/yonetim/hizmetler", icon: LayoutDashboard },
      { title: "Tüm Hizmetler", href: "/yonetim/hizmetler/tum-hizmetler", icon: Package },
      { title: "Aktif", href: "/yonetim/hizmetler/aktif", icon: CheckCircle },
      { title: "Askıda", href: "/yonetim/hizmetler/askida", icon: Pause },
      { title: "İptal Edilen", href: "/yonetim/hizmetler/iptal", icon: XCircle },
      { title: "Hizmet Ekle", href: "/yonetim/hizmet-ekle", icon: PlusCircle },
    ],
  },
  { title: "Sunucular", href: "/yonetim/sunucular", icon: Server },
  {
    title: "İçerik",
    href: "/yonetim/icerik/blog",
    icon: Newspaper,
    children: [
      { title: "Blog Yazıları", href: "/yonetim/icerik/blog", icon: FileText },
      { title: "Yeni Blog Yazısı", href: "/yonetim/icerik/blog/yeni", icon: PlusCircle },
      { title: "Bilgi Bankası", href: "/yonetim/icerik/bilgi-bankasi", icon: BookOpen },
      { title: "Yeni Makale", href: "/yonetim/icerik/bilgi-bankasi/yeni", icon: PlusCircle },
    ],
  },
  {
    title: "Destek",
    href: "/yonetim/destek",
    icon: Headphones,
    children: [
      { title: "Genel Bakış", href: "/yonetim/destek", icon: LayoutDashboard },
      { title: "Açık Talepler", href: "/yonetim/destek?status=open", icon: Clock },
      { title: "Yanıt Bekleyen", href: "/yonetim/destek?status=waiting", icon: Timer },
      { title: "Kapalı Talepler", href: "/yonetim/destek?status=closed", icon: CheckCircle },
    ],
  },
  {
    title: "Faturalar",
    href: "/yonetim/faturalar",
    icon: FileText,
    children: [
      { title: "Genel Bakış", href: "/yonetim/faturalar", icon: LayoutDashboard },
      { title: "Tüm Faturalar", href: "/yonetim/faturalar/tum-faturalar", icon: Receipt },
      { title: "Ödendi", href: "/yonetim/faturalar/odendi", icon: CheckCircle },
      { title: "Bekleyen", href: "/yonetim/faturalar/bekleyen", icon: Clock },
      { title: "Gecikmiş", href: "/yonetim/faturalar/gecikmis", icon: AlertTriangle },
      { title: "İptal Edilen", href: "/yonetim/faturalar/iptal", icon: XCircle },
      { title: "Fatura Oluştur", href: "/yonetim/faturalar/olustur", icon: FilePlus },
      { title: "E-Fatura / E-Arşiv", href: "/yonetim/efatura", icon: FileCheck },
    ],
  },
  { title: "Raporlar", href: "/yonetim/raporlar", icon: BarChart3 },
  {
    title: "Sistem",
    href: "/yonetim/aktivite",
    icon: Cog,
    children: [
      { title: "Aktivite Logları", href: "/yonetim/aktivite", icon: ScrollText },
      { title: "Provisioning Kuyruğu", href: "/yonetim/provisioning", icon: RefreshCw },
      { title: "Entegrasyonlar", href: "/yonetim/entegrasyonlar", icon: Plug },
      { title: "Ayarlar", href: "/yonetim/ayarlar", icon: Settings },
    ],
  },
];

export function AdminNav() {
  const pathname = usePathname();

  const isActive = (href: string, children?: NavItem["children"]) => {
    if (children) {
      return (
        children.some(
          (child) =>
            pathname === child.href || pathname.startsWith(`${child.href}/`)
        ) ||
        pathname === href ||
        pathname.startsWith(`${href}/`)
      );
    }
    return pathname === href;
  };

  const isChildActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
      <div className="px-6">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {navItems.map((item) => {
            const active = isActive(item.href, item.children);
            const Icon = item.icon;

            if (item.children) {
              return (
                <DropdownMenu key={item.href}>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={cn(
                        "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2",
                        active
                          ? "text-primary border-primary"
                          : "text-zinc-600 dark:text-zinc-400 border-transparent hover:text-zinc-900 dark:hover:text-white hover:border-zinc-300 dark:hover:border-zinc-700"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.title}
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 min-w-[180px]"
                  >
                    {item.children.map((child) => {
                      const ChildIcon = child.icon;
                      const childActive = isChildActive(child.href);

                      return (
                        <DropdownMenuItem
                          key={child.href}
                          asChild
                          className={cn(
                            "cursor-pointer",
                            childActive && "bg-zinc-100 dark:bg-zinc-800"
                          )}
                        >
                          <Link
                            href={child.href}
                            className="flex items-center gap-2"
                          >
                            <ChildIcon className="h-4 w-4" />
                            {child.title}
                          </Link>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2",
                  active
                    ? "text-primary border-primary"
                    : "text-zinc-600 dark:text-zinc-400 border-transparent hover:text-zinc-900 dark:hover:text-white hover:border-zinc-300 dark:hover:border-zinc-700"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.title}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
