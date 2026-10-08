import {
  Activity,
  BarChart3,
  Blocks,
  BookOpen,
  Box,
  Download,
  FileCheck,
  FileText,
  Globe,
  HandCoins,
  Headphones,
  ListChecks,
  LayoutDashboard,
  Mail,
  Network,
  Newspaper,
  Package,
  Plug,
  RefreshCw,
  ScrollText,
  Server,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Store,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { AppNavGroup, AppSearchItem } from "@/components/app";

/**
 * Admin navigation, in one place:
 * - `buildAdminNav` → the grouped sidebar (one entry per section).
 * - `ADMIN_SECTIONS` → the tab row shown above a section's list pages
 *   (sub-routes such as /yonetim/siparisler/beklemede), rendered by
 *   `AdminSectionTabs` inside the shell.
 * - `adminSearchItems` → every sub-route for the ⌘K palette.
 * Client-only (contains lucide components).
 */

export const ADMIN_ROOT = "/yonetim";

export type AdminCounts = {
  pendingOrders: number;
  openTickets: number;
  overdueInvoices: number;
  pendingCancellations: number;
  pendingManualProvisioning: number;
  pendingBankTransfers: number;
};

export function buildAdminNav(counts: AdminCounts): AppNavGroup[] {
  return [
    {
      items: [{ title: "Genel bakış", href: ADMIN_ROOT, icon: LayoutDashboard, exact: true }],
    },
    {
      label: "Müşteri",
      items: [
        { title: "Müşteriler", href: `${ADMIN_ROOT}/musteriler`, icon: Users },
        { title: "Bayiler", href: `${ADMIN_ROOT}/bayiler`, icon: Store },
        { title: "Affiliate ödemeleri", href: `${ADMIN_ROOT}/affiliate-odemeleri`, icon: HandCoins },
      ],
    },
    {
      label: "Satış",
      items: [
        {
          title: "Siparişler",
          href: `${ADMIN_ROOT}/siparisler`,
          icon: ShoppingCart,
          badge: counts.pendingOrders + counts.pendingCancellations || null,
        },
        { title: "Hizmetler", href: `${ADMIN_ROOT}/hizmetler`, icon: Package },
        {
          title: "Kurulum görevleri",
          href: `${ADMIN_ROOT}/kurulumlar`,
          icon: Wrench,
          badge: counts.pendingManualProvisioning || null,
        },
        { title: "Alan adları", href: `${ADMIN_ROOT}/domainler`, icon: Globe },
        { title: "Faturalar", href: `${ADMIN_ROOT}/faturalar`, icon: FileText, badge: counts.overdueInvoices || null },
        { title: "E-Fatura / e-Arşiv", href: `${ADMIN_ROOT}/efatura`, icon: FileCheck },
      ],
    },
    {
      label: "Katalog",
      items: [
        { title: "Ürünler", href: `${ADMIN_ROOT}/urunler`, icon: ShoppingBag },
        { title: "Sunucular", href: `${ADMIN_ROOT}/sunucular`, icon: Server },
        { title: "IP havuzları", href: `${ADMIN_ROOT}/ip-havuzlari`, icon: Network },
        { title: "İçe aktarma", href: `${ADMIN_ROOT}/ice-aktar`, icon: Download },
      ],
    },
    {
      label: "Destek ve içerik",
      items: [
        { title: "Destek talepleri", href: `${ADMIN_ROOT}/destek`, icon: Headphones, badge: counts.openTickets || null },
        { title: "Blog", href: `${ADMIN_ROOT}/icerik/blog`, icon: Newspaper },
        { title: "Bilgi bankası", href: `${ADMIN_ROOT}/icerik/bilgi-bankasi`, icon: BookOpen },
      ],
    },
    {
      label: "Sistem",
      items: [
        { title: "Raporlar", href: `${ADMIN_ROOT}/raporlar`, icon: BarChart3 },
        { title: "Sistem durumu", href: `${ADMIN_ROOT}/durum`, icon: Activity },
        { title: "Provisioning kuyruğu", href: `${ADMIN_ROOT}/provisioning`, icon: RefreshCw },
        { title: "Arka plan işleri", href: `${ADMIN_ROOT}/isler`, icon: ListChecks },
        { title: "Bildirimler", href: `${ADMIN_ROOT}/bildirimler`, icon: Mail },
        { title: "Aktivite kayıtları", href: `${ADMIN_ROOT}/aktivite`, icon: ScrollText },
        { title: "Modüller", href: `${ADMIN_ROOT}/moduller`, icon: Blocks },
        { title: "Entegrasyonlar", href: `${ADMIN_ROOT}/entegrasyonlar`, icon: Plug },
        { title: "Ayarlar", href: `${ADMIN_ROOT}/ayarlar`, icon: Settings },
      ],
    },
  ];
}

export type AdminSectionTab = {
  title: string;
  href: string;
  /** Count key shown next to the tab label. */
  countKey?: keyof AdminCounts;
};

export type AdminSection = {
  /** Label used for the tab row's aria-label and the ⌘K group. */
  label: string;
  icon: LucideIcon;
  tabs: AdminSectionTab[];
};

/**
 * Sections with sub-routes. A section's tab row shows on every page whose
 * path is exactly one of its tabs (not on detail / edit pages).
 */
export const ADMIN_SECTIONS: AdminSection[] = [
  {
    label: "Müşteriler",
    icon: Users,
    tabs: [
      { title: "Genel bakış", href: `${ADMIN_ROOT}/musteriler` },
      { title: "Tüm müşteriler", href: `${ADMIN_ROOT}/musteriler/tum-musteriler` },
      { title: "Bireysel", href: `${ADMIN_ROOT}/musteriler/bireysel` },
      { title: "Kurumsal", href: `${ADMIN_ROOT}/musteriler/kurumsal` },
      { title: "Askıda", href: `${ADMIN_ROOT}/musteriler/askida` },
      { title: "Kapalı hesaplar", href: `${ADMIN_ROOT}/musteriler/kapali` },
      { title: "Müşteri ekle", href: `${ADMIN_ROOT}/musteri-ekle` },
    ],
  },
  {
    label: "Siparişler",
    icon: ShoppingCart,
    tabs: [
      { title: "Genel bakış", href: `${ADMIN_ROOT}/siparisler` },
      { title: "Tüm siparişler", href: `${ADMIN_ROOT}/siparisler/tum-siparisler` },
      { title: "Beklemede", href: `${ADMIN_ROOT}/siparisler/beklemede`, countKey: "pendingOrders" },
      { title: "Aktif", href: `${ADMIN_ROOT}/siparisler/aktif` },
      { title: "Askıda", href: `${ADMIN_ROOT}/siparisler/askida` },
      { title: "İptal edilen", href: `${ADMIN_ROOT}/siparisler/iptal` },
      { title: "İptal talepleri", href: `${ADMIN_ROOT}/siparisler/iptal-talepleri`, countKey: "pendingCancellations" },
      { title: "Yükseltme / düşürme", href: `${ADMIN_ROOT}/siparisler/yukseltme-dusurme` },
      { title: "Eklentiler", href: `${ADMIN_ROOT}/siparisler/eklentiler` },
    ],
  },
  {
    label: "Hizmetler",
    icon: Package,
    tabs: [
      { title: "Genel bakış", href: `${ADMIN_ROOT}/hizmetler` },
      { title: "Tüm hizmetler", href: `${ADMIN_ROOT}/hizmetler/tum-hizmetler` },
      { title: "Aktif", href: `${ADMIN_ROOT}/hizmetler/aktif` },
      { title: "Askıda", href: `${ADMIN_ROOT}/hizmetler/askida` },
      { title: "İptal edilen", href: `${ADMIN_ROOT}/hizmetler/iptal` },
      { title: "Hizmet ekle", href: `${ADMIN_ROOT}/hizmet-ekle` },
    ],
  },
  {
    label: "Faturalar",
    icon: FileText,
    tabs: [
      { title: "Genel bakış", href: `${ADMIN_ROOT}/faturalar` },
      { title: "Tüm faturalar", href: `${ADMIN_ROOT}/faturalar/tum-faturalar` },
      { title: "Bekleyen", href: `${ADMIN_ROOT}/faturalar/bekleyen` },
      {
        title: "Havale bildirimleri",
        href: `${ADMIN_ROOT}/faturalar/havale-bildirimleri`,
        countKey: "pendingBankTransfers",
      },
      { title: "Gecikmiş", href: `${ADMIN_ROOT}/faturalar/gecikmis`, countKey: "overdueInvoices" },
      { title: "Ödendi", href: `${ADMIN_ROOT}/faturalar/odendi` },
      { title: "İptal edilen", href: `${ADMIN_ROOT}/faturalar/iptal` },
      { title: "Fatura oluştur", href: `${ADMIN_ROOT}/faturalar/olustur` },
    ],
  },
  {
    label: "Ürünler",
    icon: ShoppingBag,
    tabs: [
      { title: "Genel bakış", href: `${ADMIN_ROOT}/urunler` },
      { title: "Kategoriler", href: `${ADMIN_ROOT}/urunler/kategoriler` },
      { title: "Paketler", href: `${ADMIN_ROOT}/urunler/paketler` },
      { title: "Özellikler", href: `${ADMIN_ROOT}/urunler/ozellikler` },
      { title: "Promosyonlar", href: `${ADMIN_ROOT}/urunler/promosyonlar` },
    ],
  },
  {
    label: "İçerik",
    icon: Newspaper,
    tabs: [
      { title: "Blog yazıları", href: `${ADMIN_ROOT}/icerik/blog` },
      { title: "Yeni blog yazısı", href: `${ADMIN_ROOT}/icerik/blog/yeni` },
      { title: "Bilgi bankası", href: `${ADMIN_ROOT}/icerik/bilgi-bankasi` },
      { title: "Yeni makale", href: `${ADMIN_ROOT}/icerik/bilgi-bankasi/yeni` },
    ],
  },
];

/** The section whose tab list contains this exact path, if any. */
export function findAdminSection(pathname: string): AdminSection | undefined {
  return ADMIN_SECTIONS.find((s) => s.tabs.some((t) => t.href === pathname));
}

/** Every sub-route for the ⌘K palette (sidebar items are added by the palette itself). */
export function adminSearchItems(nav: AppNavGroup[]): AppSearchItem[] {
  const navHrefs = new Set(nav.flatMap((g) => g.items.map((i) => i.href)));
  const items: AppSearchItem[] = [];
  for (const section of ADMIN_SECTIONS) {
    for (const tab of section.tabs) {
      if (navHrefs.has(tab.href)) continue;
      items.push({
        title: tab.title === "Genel bakış" ? `${section.label} — genel bakış` : `${section.label}: ${tab.title}`,
        href: tab.href,
        group: section.label,
        icon: section.icon,
      });
    }
  }
  items.push({ title: "Kullanıcı sitesi (kleacore.com)", href: "/", group: "Site", icon: LayoutDashboard });
  return items;
}

export const ADMIN_SEGMENT_LABELS: Record<string, string> = {
  yeni: "Yeni",
  duzenle: "Düzenle",
  olustur: "Fatura oluştur",
  "musteri-ekle": "Müşteri ekle",
  "hizmet-ekle": "Hizmet ekle",
  "tum-musteriler": "Tüm müşteriler",
  "tum-siparisler": "Tüm siparişler",
  "tum-hizmetler": "Tüm hizmetler",
  "tum-faturalar": "Tüm faturalar",
  bireysel: "Bireysel",
  kurumsal: "Kurumsal",
  askida: "Askıda",
  kapali: "Kapalı hesaplar",
  beklemede: "Beklemede",
  aktif: "Aktif",
  iptal: "İptal edilen",
  "iptal-talepleri": "İptal talepleri",
  "yukseltme-dusurme": "Yükseltme / düşürme",
  eklentiler: "Eklentiler",
  bekleyen: "Bekleyen",
  gecikmis: "Gecikmiş",
  odendi: "Ödendi",
  icerik: "İçerik",
  paketler: "Paketler",
  kategoriler: "Kategoriler",
  ozellikler: "Özellikler",
  promosyonlar: "Promosyonlar",
  "bilgi-bankasi": "Bilgi bankası",
  durum: "Sistem durumu",
  sablonlar: "Şablonlar",
};
