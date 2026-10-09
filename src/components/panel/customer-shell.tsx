"use client";

import Link from "next/link";
import {
  BarChart3,
  CreditCard,
  FileText,
  Globe,
  HardDrive,
  Headphones,
  IdCard,
  Home,
  LayoutDashboard,
  Mail,
  Package,
  Server,
  Settings,
  Shield,
  Store,
  Users,
  Wallet,
} from "lucide-react";
import {
  AppCommandSearch,
  AppNotifications,
  AppShell,
  AppThemeToggle,
  AppUserMenu,
  type AppNavGroup,
  type AppNotification,
} from "@/components/app";

export type CustomerShellProps = {
  user: { name: string; email?: string | null };
  isReseller: boolean;
  counts: { unpaidInvoices: number; openTickets: number };
  notifications: AppNotification[];
  children: React.ReactNode;
};

const ROOT = "/musteri/panel";

function buildNav({ isReseller, counts }: Pick<CustomerShellProps, "isReseller" | "counts">): AppNavGroup[] {
  return [
    {
      items: [{ title: "Genel bakış", href: ROOT, icon: LayoutDashboard, exact: true }],
    },
    {
      label: "Hizmetler",
      items: [
        { title: "Hizmetlerim", href: `${ROOT}/hizmetlerim`, icon: Package },
        { title: "Alan adlarım", href: `${ROOT}/domainler`, icon: Globe },
        { title: "SSL sertifikaları", href: `${ROOT}/ssl`, icon: Shield },
        { title: "Sunucular", href: `${ROOT}/sunucular`, icon: Server },
        { title: "E-posta", href: `${ROOT}/e-posta`, icon: Mail },
        { title: "Yedekler", href: `${ROOT}/yedekleme`, icon: HardDrive },
      ],
    },
    {
      label: "Ödeme",
      items: [
        { title: "Faturalarım", href: `${ROOT}/faturalar`, icon: FileText, badge: counts.unpaidInvoices || null },
        { title: "Kayıtlı kartlarım", href: `${ROOT}/kayitli-kartlar`, icon: CreditCard },
        { title: "Bakiye yükle", href: `${ROOT}/kredi`, icon: Wallet },
        { title: "İstatistikler", href: `${ROOT}/istatistikler`, icon: BarChart3 },
      ],
    },
    {
      label: "Destek",
      items: [
        { title: "Destek talepleri", href: `${ROOT}/destek`, icon: Headphones, badge: counts.openTickets || null },
      ],
    },
    {
      label: "Hesap",
      items: [
        { title: "Satış ortaklığı", href: `${ROOT}/satis-ortakligi`, icon: Users },
        ...(isReseller ? [{ title: "Bayilik", href: `${ROOT}/bayilik`, icon: Store }] : []),
        { title: "Kimlik doğrulama", href: `${ROOT}/kimlik-dogrulama`, icon: IdCard },
        { title: "Ayarlar", href: `${ROOT}/ayarlar`, icon: Settings },
      ],
    },
  ];
}

const segmentLabels: Record<string, string> = {
  yeni: "Yeni talep",
  yenile: "Yenile",
  yukselt: "Paket değiştir",
  fatura: "Fatura",
  eposta: "E-posta hesapları",
  webmail: "Webmail",
};

/** Customer panel chrome (client): builds the nav and fills the AppShell slots. */
export function CustomerShell({ user, isReseller, counts, notifications, children }: CustomerShellProps) {
  const nav = buildNav({ isReseller, counts });

  return (
    <AppShell
      nav={nav}
      brand={{ href: ROOT, label: "Müşteri" }}
      breadcrumbRoot={{ label: "Panel", href: ROOT }}
      segmentLabels={segmentLabels}
      search={
        <AppCommandSearch
          nav={nav}
          extra={[
            { title: "Yeni destek talebi", href: `${ROOT}/destek/yeni`, icon: Headphones, group: "İşlem" },
            { title: "Webmail", href: `${ROOT}/webmail`, icon: Mail, group: "İşlem" },
            { title: "Alan adı sorgula", href: "/domain/kayit", icon: Globe, group: "Site", keywords: "domain" },
          ]}
        />
      }
      notifications={<AppNotifications items={notifications} />}
      themeToggle={<AppThemeToggle />}
      userMenu={
        <AppUserMenu
          name={user.name}
          email={user.email}
          links={[
            { label: "Genel bakış", href: ROOT, icon: LayoutDashboard },
            { label: "Faturalarım", href: `${ROOT}/faturalar`, icon: CreditCard },
            { label: "Hesap ayarları", href: `${ROOT}/ayarlar`, icon: Settings },
            { label: "kleacore.com", href: "/", icon: Home },
          ]}
        />
      }
      sidebarFooter={
        <div className="rounded-md border border-dashed p-3">
          <p className="text-[13px] font-medium">Yardım mı gerekiyor?</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Destek ekibimize panel üzerinden ulaşabilirsiniz.</p>
          <Link
            href={`${ROOT}/destek/yeni`}
            className="mt-2.5 inline-flex h-9 w-full items-center justify-center rounded-md border bg-background text-[13px] font-medium shadow-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Destek talebi aç
          </Link>
        </div>
      }
    >
      {children}
    </AppShell>
  );
}
