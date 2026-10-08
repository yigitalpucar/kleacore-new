import {
  ArrowLeftRight,
  Building2,
  Cloud,
  Cpu,
  FileBadge,
  Globe,
  HardDrive,
  Layers,
  Network,
  Search,
  Server,
  Shield,
  ShieldCheck,
  Users,
  Waypoints,
  type LucideIcon,
} from "lucide-react";

export interface NavLink {
  title: string;
  href: string;
  description: string;
  icon: LucideIcon;
}

export interface NavGroup {
  title: string;
  description: string;
  items: NavLink[];
  /** Side card in the mega menu. No prices here — prices live on product pages. */
  featured: { title: string; description: string; href: string; cta: string };
}

export const navGroups: NavGroup[] = [
  {
    title: "Alan Adı",
    description: "Alan adı kaydı, transferi ve sorgulama",
    items: [
      { title: "Domain Kaydı", href: "/domain/kayit", description: "Yeni alan adınızı kaydedin", icon: Globe },
      { title: "Domain Transferi", href: "/domain/transfer", description: "Alan adınızı KLEACORE'a taşıyın", icon: ArrowLeftRight },
      { title: "Belgesiz .TR", href: "/domain/belgesiz-tr", description: "Belge gerektirmeyen .tr uzantıları", icon: FileBadge },
      { title: "Whois Sorgulama", href: "/domain/whois", description: "Alan adı kayıt bilgilerini sorgulayın", icon: Search },
    ],
    featured: {
      title: "Alan adı sorgulayın",
      description: "Uzantı fiyatlarını ve müsaitlik durumunu tek aramada görün.",
      href: "/domain/kayit",
      cta: "Sorgulamaya başla",
    },
  },
  {
    title: "Hosting",
    description: "cPanel ve LiteSpeed ile web barındırma",
    items: [
      { title: "Linux Hosting", href: "/hosting/linux", description: "cPanel, LiteSpeed ve NVMe SSD", icon: Server },
      { title: "WordPress Hosting", href: "/hosting/wordpress", description: "WordPress siteleri için paketler", icon: Layers },
      { title: "Kurumsal Hosting", href: "/hosting/kurumsal", description: "Daha yüksek kaynaklı paketler", icon: Building2 },
      { title: "Reseller Hosting", href: "/hosting/reseller", description: "Kendi müşterilerinize hosting satın", icon: Users },
    ],
    featured: {
      title: "Linux Hosting",
      description: "Tüm paketlerde cPanel, LiteSpeed ve ücretsiz Let's Encrypt SSL.",
      href: "/hosting/linux",
      cta: "Paketleri incele",
    },
  },
  {
    title: "Sunucu",
    description: "VDS, VPS, bulut ve fiziksel sunucular",
    items: [
      { title: "VDS Sunucu", href: "/sunucu/vds", description: "NVMe SSD, İstanbul lokasyon", icon: Server },
      { title: "VPS Sunucu", href: "/sunucu/vps", description: "Giriş seviyesi sanal sunucular", icon: HardDrive },
      { title: "Bulut Sunucu", href: "/sunucu/bulut", description: "Esnek kaynaklı sanal sunucular", icon: Cloud },
      { title: "Fiziksel Sunucu", href: "/sunucu/fiziksel", description: "Size ayrılmış donanım", icon: Cpu },
    ],
    featured: {
      title: "VDS Sunucu",
      description: "Tam root erişimi, NVMe SSD disk ve İstanbul lokasyon.",
      href: "/sunucu/vds",
      cta: "Paketleri incele",
    },
  },
  {
    title: "Veri Merkezi",
    description: "Barındırma, ağ ve güvenlik hizmetleri",
    items: [
      { title: "Sunucu Barındırma", href: "/veri-merkezi/barindirma", description: "Colocation (raf kiralama)", icon: HardDrive },
      { title: "IPv4 & ASN", href: "/veri-merkezi/ip-asn", description: "IP bloğu ve ASN kiralama", icon: Network },
      { title: "CDN", href: "/veri-merkezi/cdn", description: "İçerik dağıtım ağı", icon: Waypoints },
      { title: "DDoS Koruma", href: "/veri-merkezi/ddos-koruma", description: "Saldırı filtreleme hizmetleri", icon: Shield },
    ],
    featured: {
      title: "Sunucu Barındırma",
      description: "Kendi donanımınızı raf kiralama ile barındırın.",
      href: "/veri-merkezi/barindirma",
      cta: "Seçenekleri incele",
    },
  },
  {
    title: "SSL",
    description: "Web siteniz için SSL sertifikaları",
    items: [
      { title: "Standart SSL", href: "/ssl/standart", description: "DV ve OV sertifikalar", icon: ShieldCheck },
      { title: "Wildcard SSL", href: "/ssl/wildcard", description: "Tüm alt alan adları için tek sertifika", icon: Globe },
      { title: "EV SSL", href: "/ssl/ev", description: "Genişletilmiş doğrulamalı sertifika", icon: FileBadge },
      { title: "Kurumsal SSL", href: "/ssl/kurumsal", description: "Toplu sertifika ihtiyaçları", icon: Building2 },
    ],
    featured: {
      title: "Ücretli SSL sertifikaları",
      description: "Hosting paketlerinde Let's Encrypt ücretsizdir; kurumsal doğrulama için ücretli sertifika seçin.",
      href: "/ssl/standart",
      cta: "Sertifikaları incele",
    },
  },
];

export const companyLinks: { title: string; href: string }[] = [
  { title: "Hakkımızda", href: "/hakkimizda" },
  { title: "İletişim", href: "/iletisim" },
  { title: "Blog", href: "/blog" },
  { title: "Bilgi Bankası", href: "/bilgi-bankasi" },
  { title: "Kariyer", href: "/kurumsal/kariyer" },
  { title: "API Dokümantasyonu", href: "/api-docs" },
  { title: "Sistem Durumu", href: "/musteri/durum" },
  { title: "Yenilikler", href: "/degisiklikler" },
];

export const legalLinks: { title: string; href: string }[] = [
  { title: "Kullanım Koşulları", href: "/yasal/kullanim-kosullari" },
  { title: "Gizlilik Politikası", href: "/yasal/gizlilik" },
  { title: "İade Koşulları", href: "/yasal/iade-kosullari" },
  { title: "Çerez Politikası", href: "/yasal/cerez" },
  { title: "KVKK Aydınlatma Metni", href: "/yasal/kvkk" },
];
