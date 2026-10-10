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
  adminQuickActions,
  adminSearchItems,
  buildAdminNav,
  type AdminCounts,
} from "./admin-nav-config";
import { AdminMegaMenu } from "./admin-mega-menu";
import { AdminQuickActions } from "./admin-quick-actions";
import { AdminSectionTabs } from "./admin-section-tabs";
import { canAccessRoute, hasAnyPermission, type StaffRole } from "@/lib/auth/permissions";

export type AdminShellProps = {
  user: { name: string; email?: string | null };
  /** Nav, tabs, ⌘K items and quick links are filtered by this role's permissions. */
  role: StaffRole;
  counts: AdminCounts;
  notifications: AppNotification[];
  /** Total unread bell notifications (the list shows the latest only). */
  unreadNotifications?: number;
  children: React.ReactNode;
};

const quickLinks = [
  { title: "Müşteri ekle", href: `${ADMIN_ROOT}/musteri-ekle`, icon: UserPlus, group: "İşlem", keywords: "yeni müşteri" },
  { title: "Hizmet ekle", href: `${ADMIN_ROOT}/hizmet-ekle`, icon: PackagePlus, group: "İşlem", keywords: "yeni hizmet" },
  { title: "Fatura oluştur", href: `${ADMIN_ROOT}/faturalar/olustur`, icon: FilePlus, group: "İşlem", keywords: "yeni fatura" },
];

/** Admin panel chrome (client): mega menu under the top bar, quick actions, section tabs. */
/** Any of these lets the ⌘K palette search records (each group is checked again on the server). */
const SEARCHABLE = ["customers.view", "invoices.view", "orders.view", "services.view", "domains.view", "tickets.view"] as const;

export function AdminShell({ user, role, counts, notifications, unreadNotifications, children }: AdminShellProps) {
  const nav = buildAdminNav(counts, role);
  const allowed = <T extends { href: string }>(links: T[]) => links.filter((l) => canAccessRoute(role, l.href));

  return (
    <AppShell
      nav={nav}
      brand={{ href: ADMIN_ROOT, label: "Yönetim" }}
      breadcrumbRoot={{ label: "Yönetim", href: ADMIN_ROOT }}
      segmentLabels={ADMIN_SEGMENT_LABELS}
      topNav={<AdminMegaMenu nav={nav} role={role} />}
      quickActions={<AdminQuickActions {...adminQuickActions(counts, role)} />}
      search={
        <AppCommandSearch
          nav={nav}
          actions={allowed(quickLinks)}
          extra={adminSearchItems(nav, role)}
          endpoint={hasAnyPermission(role, SEARCHABLE) ? "/api/admin/arama" : undefined}
          placeholder={hasAnyPermission(role, SEARCHABLE) ? "Ara…" : "Sayfa ara…"}
          statusAudience="admin"
        />
      }
      notifications={<AppNotifications items={notifications} unread={unreadNotifications} />}
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
