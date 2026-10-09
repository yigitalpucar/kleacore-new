"use client";

import {
  FilePlus,
  Home,
  KeyRound,
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
import { canAccessRoute, type StaffRole } from "@/lib/auth/permissions";

export type AdminShellProps = {
  user: { name: string; email?: string | null };
  /** Nav, tabs, ⌘K items and quick links are filtered by this role's permissions. */
  role: StaffRole;
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
export function AdminShell({ user, role, counts, notifications, children }: AdminShellProps) {
  const nav = buildAdminNav(counts, role);
  const allowed = <T extends { href: string }>(links: T[]) => links.filter((l) => canAccessRoute(role, l.href));

  return (
    <AppShell
      nav={nav}
      brand={{ href: ADMIN_ROOT, label: "Yönetim" }}
      breadcrumbRoot={{ label: "Yönetim", href: ADMIN_ROOT }}
      segmentLabels={ADMIN_SEGMENT_LABELS}
      search={<AppCommandSearch nav={nav} extra={[...allowed(quickLinks), ...adminSearchItems(nav, role)]} />}
      notifications={<AppNotifications items={notifications} />}
      themeToggle={<AppThemeToggle />}
      userMenu={
        <AppUserMenu
          name={user.name}
          email={user.email}
          links={allowed([
            { label: "Genel bakış", href: ADMIN_ROOT, icon: LayoutDashboard },
            { label: "API token'larım", href: `${ADMIN_ROOT}/api-tokenlari`, icon: KeyRound },
            { label: "Ayarlar", href: `${ADMIN_ROOT}/ayarlar`, icon: Settings },
            { label: "kleacore.com", href: "/", icon: Home },
          ])}
        />
      }
    >
      <AdminSectionTabs counts={counts} role={role} />
      {children}
    </AppShell>
  );
}
