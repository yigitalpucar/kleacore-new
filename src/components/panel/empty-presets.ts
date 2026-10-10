/**
 * Empty states of the customer panel lists, in one place so every list
 * speaks the same way: icon, title, one sentence, one primary action.
 * Render with <PanelEmptyState kind="…" /> (./panel-empty-state.tsx).
 */
import {
  Activity,
  Archive,
  CreditCard,
  FileArchive,
  FileText,
  Globe,
  Headphones,
  Inbox,
  Key,
  Mail,
  Package,
  ReceiptText,
  Server,
  ShieldCheck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

const P = "/musteri/panel";

export interface PanelEmptyPreset {
  icon: LucideIcon;
  title: string;
  /** Exactly one sentence. */
  description: string;
  /** The one primary action (a link); omitted only when the page itself is the action. */
  cta?: { label: string; href: string };
}

export const PANEL_EMPTY_PRESETS = {
  services: {
    icon: Package,
    title: "Henüz hizmetiniz yok",
    description: "Hosting, sunucu veya SSL paketlerinden birini seçerek dakikalar içinde başlayabilirsiniz.",
    cta: { label: "Paketleri incele", href: "/hosting/linux" },
  },
  servers: {
    icon: Server,
    title: "Henüz sunucunuz yok",
    description: "VDS veya VPS paketlerinden birini seçerek dakikalar içinde sunucunuzu açabilirsiniz.",
    cta: { label: "Sunucu paketlerini incele", href: "/sunucu/vds" },
  },
  domains: {
    icon: Globe,
    title: "Henüz alan adınız yok",
    description: "Yeni bir alan adı kaydedebilir veya mevcut alan adınızı KLEACORE'a taşıyabilirsiniz.",
    cta: { label: "Alan adı sorgula", href: "/domain/kayit" },
  },
  invoices: {
    icon: FileText,
    title: "Henüz faturanız yok",
    description: "Satın aldığınız hizmetlerin faturaları burada listelenir.",
    cta: { label: "Paketleri incele", href: "/hosting/linux" },
  },
  tickets: {
    icon: Headphones,
    title: "Henüz destek talebiniz yok",
    description: "Bir sorun yaşarsanız ya da sorunuz olursa destek ekibimize buradan yazabilirsiniz.",
    cta: { label: "Yeni talep oluştur", href: `${P}/destek/yeni` },
  },
  openTickets: {
    icon: Headphones,
    title: "Açık destek talebiniz yok",
    description: "Bir sorun yaşarsanız yeni talep oluşturabilirsiniz.",
    cta: { label: "Yeni talep oluştur", href: `${P}/destek/yeni` },
  },
  ssl: {
    icon: ShieldCheck,
    title: "Henüz SSL sertifikanız yok",
    description: "Sitenizi HTTPS ile korumak için bir SSL sertifikası alın.",
    cta: { label: "SSL paketlerini incele", href: "/ssl" },
  },
  inbox: {
    icon: Inbox,
    title: "Henüz e-posta yok",
    description: "Fatura, destek ve hizmet bildirimleri gönderildikçe burada listelenir.",
    cta: { label: "Bildirim ayarları", href: `${P}/ayarlar` },
  },
  mailAccounts: {
    icon: Mail,
    title: "Henüz e-posta hesabınız yok",
    description: "Alan adınıza bağlı kurumsal e-posta adresleri burada listelenir.",
    cta: { label: "Hosting paketlerini incele", href: "/hosting/linux" },
  },
  backups: {
    icon: FileArchive,
    title: "Henüz yedek yok",
    description: "Otomatik yedekleme zamanlaması olan hizmetlerinizin yedekleri burada listelenir.",
    cta: { label: "Hizmetlerime git", href: `${P}/hizmetlerim` },
  },
  serviceBackups: {
    icon: Archive,
    title: "Henüz yedek yok",
    description: "Bu hizmet için alınan yedekler burada listelenir.",
    cta: { label: "Tüm yedekler", href: `${P}/yedekleme` },
  },
  credit: {
    icon: ReceiptText,
    title: "Henüz bakiye hareketi yok",
    description: "Bakiye yüklediğinizde veya bakiyenizle ödeme yaptığınızda hareketler burada listelenir.",
    cta: { label: "Bakiye yükle", href: "#bakiye-yukle" },
  },
  affiliateReferrals: {
    icon: Users,
    title: "Henüz referansınız yok",
    description: "Referans bağlantınızla hesap açan müşteriler burada, e-posta adresleri kısaltılarak listelenir.",
    cta: { label: "Bağlantınızı paylaşın", href: "#referans-baglantisi" },
  },
  affiliatePayouts: {
    icon: Wallet,
    title: "Henüz ödeme talebiniz yok",
    description: "Kullanılabilir bakiyeniz alt sınıra ulaştığında buradan ödeme talep edebilirsiniz.",
  },
  resellerClients: {
    icon: Users,
    title: "Henüz alt müşteriniz yok",
    description: "Hesabınıza müşteri atandığında burada listelenir; yeni atama için destek ekibimize yazabilirsiniz.",
    cta: { label: "Destek talebi oluştur", href: `${P}/destek/yeni` },
  },
  savedCards: {
    icon: CreditCard,
    title: "Kayıtlı kartınız yok",
    description: "Kart ekleyerek faturalarınızı tek tıkla veya otomatik olarak ödeyebilirsiniz.",
  },
  usage: {
    icon: Activity,
    title: "Henüz hizmetiniz yok",
    description: "Hizmet satın aldığınızda kaynak kullanımı burada görünür.",
    cta: { label: "Paketleri incele", href: "/hosting/linux" },
  },
  apiKeys: {
    icon: Key,
    title: "Henüz API anahtarınız yok",
    description: "Hizmet, fatura ve destek işlemlerinizi otomatikleştirmek için bir anahtar oluşturun.",
  },
} satisfies Record<string, PanelEmptyPreset>;

export type PanelEmptyKind = keyof typeof PANEL_EMPTY_PRESETS;
