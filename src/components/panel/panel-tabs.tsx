"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Home,
  Package,
  Globe,
  FileText,
  Headphones,
  Mail,
  CreditCard,
  Users,
  Shield,
  Store,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface PanelTab {
  title: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
}

const baseTabs: PanelTab[] = [
  {
    title: "Anasayfa",
    href: "/musteri/panel",
    icon: Home,
    exact: true,
  },
  {
    title: "Hizmetlerim",
    href: "/musteri/panel/hizmetlerim",
    icon: Package,
  },
  {
    title: "Alan Adlarım",
    href: "/musteri/panel/domainler",
    icon: Globe,
  },
  {
    title: "SSL Sertifikaları",
    href: "/musteri/panel/ssl",
    icon: Shield,
  },
  {
    title: "Faturalarım",
    href: "/musteri/panel/faturalar",
    icon: FileText,
  },
  {
    title: "Destek Talepleri",
    href: "/musteri/panel/destek",
    icon: Headphones,
  },
  {
    title: "E-Postalarım",
    href: "/musteri/panel/e-posta",
    icon: Mail,
  },
  {
    title: "Kredi Ekle",
    href: "/musteri/panel/kredi",
    icon: CreditCard,
  },
  {
    title: "Satış Ortaklığı",
    href: "/musteri/panel/satis-ortakligi",
    icon: Users,
  },
];

const resellerTab: PanelTab = {
  title: "Bayilik",
  href: "/musteri/panel/bayilik",
  icon: Store,
};

interface PanelTabsProps {
  isReseller?: boolean;
}

export function PanelTabs({ isReseller = false }: PanelTabsProps) {
  const pathname = usePathname();
  const tabs = isReseller
    ? [
        ...baseTabs.slice(0, baseTabs.length - 1),
        resellerTab,
        baseTabs[baseTabs.length - 1],
      ]
    : baseTabs;

  return (
    <div className="border-b bg-background">
      <div className="container">
        <nav className="flex overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = tab.exact
              ? pathname === tab.href
              : pathname.startsWith(tab.href);

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50"
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.title}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
