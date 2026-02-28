// ===========================================
// KLEACORE - Ürün Yönetimi Sabitleri
// ===========================================

import {
  Server,
  HardDrive,
  Cloud,
  Building,
  Globe,
  Shield,
  Mail,
  Package,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  Pause,
  FileText,
  Tag,
  Percent,
  DollarSign,
  RefreshCcw,
  ShoppingCart,
  Archive,
} from "lucide-react";

// -------------------
// Kategori Konfigürasyonu
// -------------------
export const categoryConfig = {
  hosting: {
    name: "Web Hosting",
    icon: Server,
    color: "bg-blue-500/10 text-blue-500",
    description: "Paylaşımlı ve özel web hosting paketleri",
  },
  vds: {
    name: "VDS Sunucu",
    icon: HardDrive,
    color: "bg-purple-500/10 text-purple-500",
    description: "Virtual Dedicated Server çözümleri",
  },
  vps: {
    name: "VPS Sunucu",
    icon: Cloud,
    color: "bg-cyan-500/10 text-cyan-500",
    description: "Virtual Private Server paketleri",
  },
  server: {
    name: "Fiziksel Sunucu",
    icon: Server,
    color: "bg-orange-500/10 text-orange-500",
    description: "Dedicated sunucu çözümleri",
  },
  cloud: {
    name: "Bulut Sunucu",
    icon: Cloud,
    color: "bg-sky-500/10 text-sky-500",
    description: "Yüksek performanslı bulut sunucu çözümleri",
  },
  datacenter: {
    name: "Veri Merkezi",
    icon: Building,
    color: "bg-slate-500/10 text-slate-500",
    description: "Colocation, CDN, DDoS koruma ve IP/ASN hizmetleri",
  },
  domain: {
    name: "Domain",
    icon: Globe,
    color: "bg-green-500/10 text-green-500",
    description: "Alan adı kayıt ve transfer",
  },
  ssl: {
    name: "SSL Sertifikası",
    icon: Shield,
    color: "bg-yellow-500/10 text-yellow-500",
    description: "SSL/TLS güvenlik sertifikaları",
  },
  email: {
    name: "Kurumsal E-posta",
    icon: Mail,
    color: "bg-pink-500/10 text-pink-500",
    description: "Profesyonel e-posta hizmetleri",
  },
} as const;

// -------------------
// Ürün Durumu Konfigürasyonu
// -------------------
export const productStatusConfig = {
  active: {
    label: "Aktif",
    variant: "default" as const,
    icon: CheckCircle,
    color: "text-green-500",
    bgColor: "bg-green-500",
  },
  inactive: {
    label: "Pasif",
    variant: "secondary" as const,
    icon: Pause,
    color: "text-zinc-500",
    bgColor: "bg-zinc-500",
  },
  draft: {
    label: "Taslak",
    variant: "outline" as const,
    icon: FileText,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500",
  },
  archived: {
    label: "Arşivlenmiş",
    variant: "secondary" as const,
    icon: Archive,
    color: "text-zinc-400",
    bgColor: "bg-zinc-400",
  },
};

// -------------------
// Sipariş Durumu Konfigürasyonu
// -------------------
export const orderStatusConfig = {
  pending: {
    label: "Onay Bekliyor",
    variant: "secondary" as const,
    icon: Clock,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500",
  },
  approved: {
    label: "Onaylandı",
    variant: "default" as const,
    icon: CheckCircle,
    color: "text-blue-500",
    bgColor: "bg-blue-500",
  },
  processing: {
    label: "İşleniyor",
    variant: "outline" as const,
    icon: RefreshCcw,
    color: "text-cyan-500",
    bgColor: "bg-cyan-500",
  },
  completed: {
    label: "Tamamlandı",
    variant: "default" as const,
    icon: CheckCircle,
    color: "text-green-500",
    bgColor: "bg-green-500",
  },
  cancelled: {
    label: "İptal Edildi",
    variant: "destructive" as const,
    icon: XCircle,
    color: "text-red-500",
    bgColor: "bg-red-500",
  },
  refunded: {
    label: "İade Edildi",
    variant: "secondary" as const,
    icon: RefreshCcw,
    color: "text-orange-500",
    bgColor: "bg-orange-500",
  },
};

// -------------------
// Promosyon Durumu Konfigürasyonu
// -------------------
export const promoStatusConfig = {
  active: {
    label: "Aktif",
    variant: "default" as const,
    icon: CheckCircle,
    color: "text-green-500",
    bgColor: "bg-green-500",
  },
  inactive: {
    label: "Pasif",
    variant: "secondary" as const,
    icon: Pause,
    color: "text-zinc-500",
    bgColor: "bg-zinc-500",
  },
  expired: {
    label: "Süresi Dolmuş",
    variant: "destructive" as const,
    icon: Clock,
    color: "text-red-500",
    bgColor: "bg-red-500",
  },
};

// -------------------
// Faturalama Dönemleri
// -------------------
export const billingPeriodConfig = {
  monthly: {
    label: "Aylık",
    shortLabel: "1 Ay",
    months: 1,
    discount: 0,
  },
  quarterly: {
    label: "3 Aylık",
    shortLabel: "3 Ay",
    months: 3,
    discount: 5,
  },
  semiannual: {
    label: "6 Aylık",
    shortLabel: "6 Ay",
    months: 6,
    discount: 10,
  },
  yearly: {
    label: "Yıllık",
    shortLabel: "1 Yıl",
    months: 12,
    discount: 16,
  },
  biennial: {
    label: "2 Yıllık",
    shortLabel: "2 Yıl",
    months: 24,
    discount: 20,
  },
  triennial: {
    label: "3 Yıllık",
    shortLabel: "3 Yıl",
    months: 36,
    discount: 25,
  },
};

// -------------------
// İndirim Tipi Konfigürasyonu
// -------------------
export const discountTypeConfig = {
  percentage: {
    label: "Yüzde",
    icon: Percent,
    suffix: "%",
  },
  fixed: {
    label: "Sabit Tutar",
    icon: DollarSign,
    suffix: "₺",
  },
};

// -------------------
// Stok Uyarı Seviyeleri
// -------------------
export const stockAlertConfig = {
  low: {
    label: "Düşük Stok",
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    threshold: 10,
  },
  critical: {
    label: "Kritik Stok",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    threshold: 3,
  },
  out_of_stock: {
    label: "Stok Yok",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    threshold: 0,
  },
};

// -------------------
// Kaynak Limit Etiketleri
// -------------------
export const resourceLimitLabels = {
  diskSpace: { label: "Disk Alanı", unit: "GB", icon: HardDrive },
  bandwidth: { label: "Aylık Trafik", unit: "GB", icon: RefreshCcw },
  emailAccounts: { label: "E-posta Hesabı", unit: "Adet", icon: Mail },
  databases: { label: "Veritabanı", unit: "Adet", icon: Package },
  domains: { label: "Domain", unit: "Adet", icon: Globe },
  subdomains: { label: "Alt Domain", unit: "Adet", icon: Globe },
  ftpAccounts: { label: "FTP Hesabı", unit: "Adet", icon: Server },
  cpuCores: { label: "CPU Çekirdek", unit: "Adet", icon: Server },
  ram: { label: "RAM", unit: "GB", icon: Server },
  ipAddresses: { label: "IP Adresi", unit: "Adet", icon: Globe },
  sslCertificates: { label: "SSL Sertifikası", unit: "Adet", icon: Shield },
};

// -------------------
// Destek Seviyeleri
// -------------------
export const supportLevelConfig = {
  basic: { label: "Temel Destek", description: "E-posta ile destek" },
  priority: { label: "Öncelikli Destek", description: "E-posta + Canlı destek" },
  premium: { label: "Premium Destek", description: "7/24 Telefon + Canlı destek" },
};

// -------------------
// Yedekleme Frekansları
// -------------------
export const backupFrequencyConfig = {
  none: { label: "Yedekleme Yok", days: 0 },
  weekly: { label: "Haftalık", days: 7 },
  daily: { label: "Günlük", days: 1 },
  realtime: { label: "Anlık", days: 0 },
};

// -------------------
// Varsayılan Değerler
// -------------------
export const defaultResourceLimits = {
  diskSpace: 10,
  bandwidth: -1,
  emailAccounts: 10,
  databases: 5,
  domains: 1,
  subdomains: 10,
  ftpAccounts: 5,
  cpuCores: 1,
  ram: 1,
  ipAddresses: 1,
  sslCertificates: 1,
  backupFrequency: "weekly",
  supportLevel: "basic",
};

export const defaultPricingTier = {
  period: "monthly" as const,
  price: 0,
  setupFee: 0,
  renewalPrice: 0,
  isDefault: true,
  isActive: true,
};

// -------------------
// Sayfa Başına Kayıt Seçenekleri
// -------------------
export const perPageOptions = [10, 25, 50, 100];

// -------------------
// Sipariş Numarası Öneki
// -------------------
export const ORDER_NUMBER_PREFIX = "S";
export const PRODUCT_SKU_PREFIX = "PRD";
