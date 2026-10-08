/**
 * Public changelog ("Yenilikler") shown at /degisiklikler.
 *
 * Entries are summarised by hand from this repository's git history and only
 * describe changes customers can see. Newest first. Dates are ISO (YYYY-MM-DD).
 */

export type ChangelogCategory = "yeni" | "iyilestirme" | "duzeltme" | "guvenlik";

export interface ChangelogEntry {
  /** ISO date, e.g. "2026-10-08". */
  date: string;
  title: string;
  category: ChangelogCategory;
  summary: string;
  items?: string[];
  /** Optional related page on the site. */
  link?: { label: string; href: string };
}

export const changelogCategoryLabels: Record<ChangelogCategory, string> = {
  yeni: "Yeni",
  iyilestirme: "İyileştirme",
  duzeltme: "Düzeltme",
  guvenlik: "Güvenlik",
};

export const changelog: ChangelogEntry[] = [
  {
    date: "2026-10-08",
    title: "Alan adı sorgusunda kayıtlı alan adları doğru gösteriliyor",
    category: "duzeltme",
    summary:
      "Alan adı aramasında, kayıt sorgusu yanıt vermediğinde bazı kayıtlı alan adları yanlışlıkla müsait görünüyordu. Sorgu düzeltildi.",
    items: [
      "Kayıtlı alan adları artık arama sonuçlarında kayıtlı olarak görünüyor.",
      "Müsaitlik doğrulanamadığında sonuç “müsait” yerine nötr bir durumla gösteriliyor.",
    ],
    link: { label: "Alan adı sorgula", href: "/domain/kayit" },
  },
  {
    date: "2026-10-08",
    title: "Web sitesi yeni tasarımıyla yayında",
    category: "yeni",
    summary:
      "Tüm ürün, kurumsal ve içerik sayfaları ortak bir tasarım sistemiyle yeniden oluşturuldu. Sayfalar daha sade, mobilde daha rahat okunuyor.",
    items: [
      "Hosting, sunucu, alan adı, SSL ve veri merkezi sayfalarındaki fiyatlar doğrudan ürün kataloğundan geliyor; KDV hariç olduğu açıkça belirtiliyor.",
      "Aylık ve yıllık ödeme arasında tek bir geçişle karşılaştırma yapılabiliyor.",
      "Plan ve fiyat tabloları telefonda kart görünümüne geçiyor.",
      "Yenilenen üst menü, mobil menü ve alt bilgi; mobil menüye giriş, kayıt ve sepet bağlantıları eklendi.",
      "Bilgi bankasında sayfa içi arama, makalelerde içindekiler bölümü.",
      "Doğrulanamayan ifadeler (yurt dışı lokasyonlar, uptime garantisi, indirim bantları) sitenin tamamından kaldırıldı.",
    ],
  },
  {
    date: "2026-06-24",
    title: "Mobil menü ve kurumsal sayfalarda iyileştirmeler",
    category: "iyilestirme",
    summary:
      "Mobil menüye hızlı bağlantılar ve sabit eylem düğmeleri eklendi; kurumsal sayfaların içeriği güncellendi.",
    items: [
      "Hareket azaltma tercihine saygı gösteren animasyonlar.",
      "Hakkımızda, Kariyer ve İletişim sayfalarında içerik ve bağlantı düzeltmeleri.",
    ],
  },
  {
    date: "2026-06-20",
    title: "İki adımlı doğrulama (2FA)",
    category: "guvenlik",
    summary:
      "Müşteri hesaplarında doğrulama uygulamasıyla (TOTP) iki adımlı doğrulama kullanılabiliyor.",
    items: [
      "Kurulum, girişte doğrulama kodu adımı ve yedek kodlar.",
      "KVKK kapsamında çerez onay bandı.",
    ],
  },
  {
    date: "2026-06-20",
    title: "Otomatik faturalama ve hizmet işlemleri",
    category: "yeni",
    summary:
      "Tekrarlayan işlemler artık zamanlanmış görevlerle düzenli olarak çalışıyor.",
    items: [
      "Yenileme faturalarının oluşturulması ve vadesi geçen faturaların takibi.",
      "Başarısız hizmet kurulumlarının otomatik olarak yeniden denenmesi.",
      "SSL sertifikası bitiş tarihi kontrolleri ve yedekleme görevleri.",
    ],
  },
  {
    date: "2026-06-17",
    title: "Güvenlik sıkılaştırmaları",
    category: "guvenlik",
    summary: "Altyapı ve uygulama tarafında güvenlik iyileştirmeleri yapıldı.",
    items: [
      "Hassas bilgiler veritabanında şifreli saklanıyor.",
      "API anahtarları özetlenmiş (hash) olarak tutuluyor.",
      "Giriş ve form işlemlerinde istek sınırlaması.",
    ],
  },
  {
    date: "2026-03-01",
    title: "Üç adımlı hosting sipariş akışı",
    category: "yeni",
    summary:
      "Hosting siparişi artık alan adı seçimi, ek hizmetler ve sipariş özeti adımlarından oluşan bir sihirbazla tamamlanıyor.",
    items: [
      "Yedekleme, SSL, önbellek, kötü amaçlı yazılım taraması ve ek IP gibi ek hizmetler siparişe eklenebiliyor.",
      "Giriş ve çıkış sonrasında oturumun her sayfada doğru görünmemesi sorunu giderildi.",
    ],
    link: { label: "Hosting paketleri", href: "/hosting/linux" },
  },
  {
    date: "2026-02-28",
    title: "Tüm ürün sayfalarından sepete ekleme",
    category: "iyilestirme",
    summary:
      "Sunucu, SSL ve veri merkezi ürünleri de doğrudan ürün sayfasından sepete eklenebiliyor.",
  },
  {
    date: "2026-01-14",
    title: "Müşteri paneli ve bilgi bankası",
    category: "yeni",
    summary:
      "Hizmetlerinizi, faturalarınızı, alan adlarınızı ve destek taleplerinizi tek yerden yönetebileceğiniz müşteri paneli açıldı.",
    items: [
      "Hizmet detayı, yenileme ve fatura sayfaları.",
      "Destek talebi oluşturma ve talep üzerinden yazışma.",
      "Bilgi bankası kategori ve makale sayfaları.",
    ],
    link: { label: "Bilgi bankası", href: "/bilgi-bankasi" },
  },
  {
    date: "2026-01-11",
    title: "KLEACORE web sitesi yayında",
    category: "yeni",
    summary:
      "Hosting, sunucu, alan adı ve SSL ürünlerimizi tanıtan ilk web sitesi; yasal metinler ve iletişim sayfası yayımlandı.",
  },
];
