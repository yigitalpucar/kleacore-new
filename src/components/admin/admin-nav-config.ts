import {
  Activity,
  BarChart3,
  Blocks,
  BookOpen,
  Box,
  Download,
  FilePlus,
  FileCheck,
  FileLock2,
  FileText,
  Globe,
  HandCoins,
  KeyRound,
  Headphones,
  IdCard,
  ListChecks,
  LayoutDashboard,
  Mail,
  Megaphone,
  Network,
  Waypoints,
  Newspaper,
  Package,
  PackagePlus,
  Plug,
  Radio,
  RefreshCw,
  ScrollText,
  Server,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Store,
  UserCog,
  UserPlus,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { AppNavGroup, AppSearchItem } from "@/components/app";
import { canAccessRoute, type StaffRole } from "@/lib/auth/permissions";

/**
 * Admin navigation, in one place:
 * - `buildAdminNav` → the grouped sidebar (one entry per section).
 * - `ADMIN_SECTIONS` → the tab row shown above a section's list pages
 *   (sub-routes such as /yonetim/siparisler/beklemede), rendered by
 *   `AdminSectionTabs` inside the shell.
 * - `adminSearchItems` → every sub-route for the ⌘K palette.
 * Client-only (contains lucide components).
 *
 * Every builder takes the staff role and drops entries the role cannot open
 * (src/lib/auth/permissions.ts ADMIN_ROUTE_PERMISSIONS); the pages enforce
 * the same permissions server-side.
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

export function buildAdminNav(counts: AdminCounts, role: StaffRole): AppNavGroup[] {
  const groups: AppNavGroup[] = [
    {
      items: [{ title: "Genel bakış", href: ADMIN_ROOT, icon: LayoutDashboard, exact: true }],
    },
    {
      label: "Müşteriler",
      collapsible: true,
      items: [
        { title: "Müşteriler", href: `${ADMIN_ROOT}/musteriler`, icon: Users, description: "Hesaplar, iletişim ve müşteri geçmişi" },
        { title: "Bayiler", href: `${ADMIN_ROOT}/bayiler`, icon: Store, description: "Bayi hesapları ve indirim oranları" },
        { title: "Affiliate ödemeleri", href: `${ADMIN_ROOT}/affiliate-odemeleri`, icon: HandCoins, description: "Satış ortaklığı kazanç talepleri" },
        { title: "Kimlik doğrulama", href: `${ADMIN_ROOT}/kyc`, icon: IdCard, description: "KYC belgeleri ve onay kuyruğu" },
        { title: "KVKK talepleri", href: `${ADMIN_ROOT}/kvkk-talepleri`, icon: FileLock2, description: "Veri erişim ve silme başvuruları" },
      ],
    },
    {
      label: "Satış",
      collapsible: true,
      items: [
        {
          title: "Siparişler",
          href: `${ADMIN_ROOT}/siparisler`,
          icon: ShoppingCart,
          description: "Yeni siparişler, onay ve iptal talepleri",
          badge: counts.pendingOrders + counts.pendingCancellations || null,
        },
        { title: "Hizmetler", href: `${ADMIN_ROOT}/hizmetler`, icon: Package, description: "Hosting, sunucu ve SSL hizmetleri" },
        { title: "Alan adları", href: `${ADMIN_ROOT}/domainler`, icon: Globe, description: "Kayıt, yenileme ve transferler" },
        {
          title: "Kurulum görevleri",
          href: `${ADMIN_ROOT}/kurulumlar`,
          icon: Wrench,
          description: "Elle kurulacak hizmetler",
          badge: counts.pendingManualProvisioning || null,
        },
        { title: "Ürünler", href: `${ADMIN_ROOT}/urunler`, icon: ShoppingBag, description: "Paketler, fiyatlar, promosyonlar, TLD'ler" },
      ],
    },
    {
      label: "Finans",
      collapsible: true,
      items: [
        {
          title: "Faturalar",
          href: `${ADMIN_ROOT}/faturalar`,
          icon: FileText,
          description: "Tahsilat, gecikmeler ve havale bildirimleri",
          badge: counts.overdueInvoices + counts.pendingBankTransfers || null,
        },
        { title: "E-Fatura / e-Arşiv", href: `${ADMIN_ROOT}/efatura`, icon: FileCheck, description: "Uyumsoft gönderimleri ve durumları" },
        { title: "Raporlar", href: `${ADMIN_ROOT}/raporlar`, icon: BarChart3, description: "Gelir, MRR, KDV ve kayıp oranı" },
      ],
    },
    {
      label: "Destek",
      collapsible: true,
      items: [
        {
          title: "Destek talepleri",
          href: `${ADMIN_ROOT}/destek`,
          icon: Headphones,
          description: "Açık talepler ve hazır yanıtlar",
          badge: counts.openTickets || null,
        },
        { title: "Duyurular", href: `${ADMIN_ROOT}/duyurular`, icon: Megaphone, description: "Müşterilere toplu e-posta" },
        { title: "Sistem durumu", href: `${ADMIN_ROOT}/durum`, icon: Activity, description: "Durum sayfası ve olay kayıtları" },
        { title: "Bildirimler", href: `${ADMIN_ROOT}/bildirimler`, icon: Mail, description: "Gönderilen e-postalar ve şablonlar" },
        { title: "Blog", href: `${ADMIN_ROOT}/icerik/blog`, icon: Newspaper, description: "Yazılar ve taslaklar" },
        { title: "Bilgi bankası", href: `${ADMIN_ROOT}/icerik/bilgi-bankasi`, icon: BookOpen, description: "Yardım makaleleri" },
      ],
    },
    {
      label: "Altyapı",
      collapsible: true,
      items: [
        { title: "Sunucular", href: `${ADMIN_ROOT}/sunucular`, icon: Server, description: "Fiziksel sunucular ve kapasite" },
        { title: "Modüller", href: `${ADMIN_ROOT}/moduller`, icon: Blocks, description: "WHM, Proxmox, kayıt firması, DNS" },
        { title: "IP havuzları", href: `${ADMIN_ROOT}/ip-havuzlari`, icon: Network, description: "IP blokları ve atamalar" },
        { title: "DNS bölgeleri", href: `${ADMIN_ROOT}/dns`, icon: Waypoints, description: "Cloudflare ve kayıt firması DNS'i" },
        { title: "Provisioning kuyruğu", href: `${ADMIN_ROOT}/provisioning`, icon: RefreshCw, description: "Otomatik kurulum işleri" },
        { title: "İçe aktarma", href: `${ADMIN_ROOT}/ice-aktar`, icon: Download, description: "WHM, Proxmox ve kayıt firmasından" },
      ],
    },
    {
      label: "Sistem",
      collapsible: true,
      items: [
        { title: "Personel", href: `${ADMIN_ROOT}/personel`, icon: UserCog, description: "Ekip üyeleri ve roller" },
        { title: "API token'ları", href: `${ADMIN_ROOT}/api-tokenlari`, icon: KeyRound, description: "Yönetim API erişimi" },
        { title: "Entegrasyonlar", href: `${ADMIN_ROOT}/entegrasyonlar`, icon: Plug, description: "Ödeme, e-posta ve dış servisler" },
        { title: "Arka plan işleri", href: `${ADMIN_ROOT}/isler`, icon: ListChecks, description: "Kuyruk ve zamanlanmış görevler" },
        { title: "Olaylar", href: `${ADMIN_ROOT}/olaylar`, icon: Radio, description: "Sistem olayları ve teslimatlar" },
        { title: "Aktivite kayıtları", href: `${ADMIN_ROOT}/aktivite`, icon: ScrollText, description: "Kim, ne zaman, ne yaptı" },
        { title: "Ayarlar", href: `${ADMIN_ROOT}/ayarlar`, icon: Settings, description: "Genel, faturalama ve güvenlik" },
      ],
    },
  ];
  return groups
    .map((group) => ({ ...group, items: group.items.filter((item) => canAccessRoute(role, item.href)) }))
    .filter((group) => group.items.length > 0);
}

/**
 * Sub-pages worth one click from the mega menu: a group's section tabs minus
 * the overview and the pages already listed as group items.
 */
export function adminGroupShortcuts(group: AppNavGroup, role: StaffRole, limit = 8): AdminSectionTab[] {
  const roots = new Set(group.items.map((item) => item.href));
  return adminSectionsFor(role)
    .flatMap((section) => (roots.has(section.tabs[0]?.href ?? "") ? section.tabs.slice(1) : []))
    .filter((tab) => !roots.has(tab.href))
    .slice(0, limit);
}

export type AdminQuickAction = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Pending count shown on the right (queues only). */
  count?: number;
};

/** "Hızlı işlemler" menu in the top bar: create shortcuts + the queues that need someone. */
export function adminQuickActions(counts: AdminCounts, role: StaffRole) {
  const create: AdminQuickAction[] = [
    { title: "Müşteri ekle", href: `${ADMIN_ROOT}/musteri-ekle`, icon: UserPlus },
    { title: "Hizmet ekle", href: `${ADMIN_ROOT}/hizmet-ekle`, icon: PackagePlus },
    { title: "Fatura oluştur", href: `${ADMIN_ROOT}/faturalar/olustur`, icon: FilePlus },
    { title: "Duyuru hazırla", href: `${ADMIN_ROOT}/duyurular/yeni`, icon: Megaphone },
    { title: "Blog yazısı", href: `${ADMIN_ROOT}/icerik/blog/yeni`, icon: Newspaper },
    { title: "Bilgi bankası makalesi", href: `${ADMIN_ROOT}/icerik/bilgi-bankasi/yeni`, icon: BookOpen },
  ];
  const queues: AdminQuickAction[] = [
    { title: "Bekleyen siparişler", href: `${ADMIN_ROOT}/siparisler/beklemede`, icon: ShoppingCart, count: counts.pendingOrders },
    { title: "İptal talepleri", href: `${ADMIN_ROOT}/siparisler/iptal-talepleri`, icon: ShoppingCart, count: counts.pendingCancellations },
    { title: "Havale bildirimleri", href: `${ADMIN_ROOT}/faturalar/havale-bildirimleri`, icon: HandCoins, count: counts.pendingBankTransfers },
    { title: "Gecikmiş faturalar", href: `${ADMIN_ROOT}/faturalar/gecikmis`, icon: FileText, count: counts.overdueInvoices },
    { title: "Kurulum görevleri", href: `${ADMIN_ROOT}/kurulumlar`, icon: Wrench, count: counts.pendingManualProvisioning },
    { title: "Açık destek talepleri", href: `${ADMIN_ROOT}/destek`, icon: Headphones, count: counts.openTickets },
  ];
  const allowed = (list: AdminQuickAction[]) => list.filter((a) => canAccessRoute(role, a.href));
  return { create: allowed(create), queues: allowed(queues) };
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
      { title: "İnceleme", href: `${ADMIN_ROOT}/siparisler/inceleme` },
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
      { title: "Kota aşımı", href: `${ADMIN_ROOT}/hizmetler/kota` },
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
      { title: "Otomatik tahsilat", href: `${ADMIN_ROOT}/faturalar/otomatik-tahsilat` },
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
      { title: "TLD fiyatları", href: `${ADMIN_ROOT}/urunler/tld-fiyatlari` },
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

/** ADMIN_SECTIONS with the tabs this role may open (sections left empty are dropped). */
export function adminSectionsFor(role: StaffRole): AdminSection[] {
  return ADMIN_SECTIONS.map((s) => ({ ...s, tabs: s.tabs.filter((t) => canAccessRoute(role, t.href)) })).filter(
    (s) => s.tabs.length > 0
  );
}

/** The section whose tab list contains this exact path, if any (tabs filtered by role). */
export function findAdminSection(pathname: string, role: StaffRole): AdminSection | undefined {
  return adminSectionsFor(role).find((s) => s.tabs.some((t) => t.href === pathname));
}

/** Every sub-route for the ⌘K palette (sidebar items are added by the palette itself). */
export function adminSearchItems(nav: AppNavGroup[], role: StaffRole): AppSearchItem[] {
  const navHrefs = new Set(nav.flatMap((g) => g.items.map((i) => i.href)));
  const items: AppSearchItem[] = [];
  for (const section of adminSectionsFor(role)) {
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
  kota: "Kota aşımı",
  "hazir-yanitlar": "Hazır yanıtlar",
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
  "otomatik-tahsilat": "Otomatik tahsilat",
  icerik: "İçerik",
  paketler: "Paketler",
  kategoriler: "Kategoriler",
  ozellikler: "Özellikler",
  promosyonlar: "Promosyonlar",
  "tld-fiyatlari": "TLD fiyatları",
  "bilgi-bankasi": "Bilgi bankası",
  durum: "Sistem durumu",
  duyurular: "Duyurular",
  sablonlar: "Şablonlar",
  hatirlatmalar: "Hatırlatma takvimi",
  personel: "Personel",
  "api-tokenlari": "API token'ları",
  dokumantasyon: "Dokümantasyon",
  inceleme: "İnceleme",
  kyc: "Kimlik doğrulama",
  "kvkk-talepleri": "KVKK talepleri",
};
