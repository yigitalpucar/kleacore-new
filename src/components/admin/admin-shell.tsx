"use client";

import {
  FilePlus,
  Home,
  LayoutDashboard,
  PackagePlus,
  Settings,
  UserPlus,
} from "lucide-react";
import {
  AppCommandSearch,
  AppNotifications,
  AppShell,
  AppThemeToggle,
  AppUserMenu,
  type AppNotification,
} from "@/components/app";
import {
  ADMIN_ROOT,
  ADMIN_SEGMENT_LABELS,
  adminSearchItems,
  buildAdminNav,
  type AdminCounts,
} from "./admin-nav-config";
import { AdminSectionTabs } from "./admin-section-tabs";

export type AdminShellProps = {
  user: { name: string; email?: string | null };
  counts: AdminCounts;
  notifications: AppNotification[];
  children: React.ReactNode;
};

const quickLinks = [
  { title: "Müşteri ekle", href: `${ADMIN_ROOT}/musteri-ekle`, icon: UserPlus, group: "İşlem", keywords: "yeni müşteri" },
  { title: "Hizmet ekle", href: `${ADMIN_ROOT}/hizmet-ekle`, icon: PackagePlus, group: "İşlem", keywords: "yeni hizmet" },
  { title: "Fatura oluştur", href: `${ADMIN_ROOT}/faturalar/olustur`, icon: FilePlus, group: "İşlem", keywords: "yeni fatura" },
];

/** Admin panel chrome (client): grouped sidebar, section tabs and top bar slots. */
export function AdminShell({ user, counts, notifications, children }: AdminShellProps) {
  const nav = buildAdminNav(counts);

  return (
    <AppShell
      nav={nav}
      brand={{ href: ADMIN_ROOT, label: "Yönetim" }}
      breadcrumbRoot={{ label: "Yönetim", href: ADMIN_ROOT }}
      segmentLabels={ADMIN_SEGMENT_LABELS}
      search={<AppCommandSearch nav={nav} extra={[...quickLinks, ...adminSearchItems(nav)]} />}
      notifications={<AppNotifications items={notifications} />}
      themeToggle={<AppThemeToggle />}
      userMenu={
        <AppUserMenu
          name={user.name}
          email={user.email}
          links={[
            { label: "Genel bakış", href: ADMIN_ROOT, icon: LayoutDashboard },
            { label: "Ayarlar", href: `${ADMIN_ROOT}/ayarlar`, icon: Settings },
            { label: "kleacore.com", href: "/", icon: Home },
          ]}
        />
      }
    >
      <AdminSectionTabs counts={counts} />
      {children}
    </AppShell>
  );
}
