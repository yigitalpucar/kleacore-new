import type { PrismaClient } from "@prisma/client";

export async function seedHostingAddons(db: PrismaClient) {
  const addons = [
    {
      sku: "ADDON-BACKUP",
      name: "Günlük Yedekleme",
      slug: "gunluk-yedekleme",
      description:
        "Otomatik günlük yedekleme ile verileriniz her zaman güvende. Tek tıkla geri yükleme.",
      categorySlug: "hosting" as const,
      applicableSubTypes: [],
      monthlyPrice: 29,
      yearlyPrice: 24,
      setupFee: 0,
      icon: "DatabaseBackup",
      badge: null,
      isRequired: false,
      isPopular: true,
      displayOrder: 1,
    },
    {
      sku: "ADDON-WILDCARD-SSL",
      name: "Wildcard SSL",
      slug: "wildcard-ssl",
      description:
        "Tüm alt domainlerinizi tek bir SSL sertifikası ile koruyun. *.domain.com desteği.",
      categorySlug: "hosting" as const,
      applicableSubTypes: [],
      monthlyPrice: 49,
      yearlyPrice: 39,
      setupFee: 0,
      icon: "ShieldCheck",
      badge: null,
      isRequired: false,
      isPopular: false,
      displayOrder: 2,
    },
    {
      sku: "ADDON-LITESPEED",
      name: "LiteSpeed Cache",
      slug: "litespeed-cache",
      description:
        "Sitenizi 10 kata kadar hızlandırın. LiteSpeed sunucu düzeyinde önbellekleme.",
      categorySlug: "hosting" as const,
      applicableSubTypes: ["linux", "wordpress"],
      monthlyPrice: 19,
      yearlyPrice: 15,
      setupFee: 0,
      icon: "Zap",
      badge: "Popüler",
      isRequired: false,
      isPopular: true,
      displayOrder: 3,
    },
    {
      sku: "ADDON-MALWARE",
      name: "Malware Taraması",
      slug: "malware-taramasi",
      description:
        "7/24 otomatik malware tarama ve temizleme. Zararlı yazılımlara karşı sürekli koruma.",
      categorySlug: "hosting" as const,
      applicableSubTypes: [],
      monthlyPrice: 39,
      yearlyPrice: 29,
      setupFee: 0,
      icon: "ScanSearch",
      badge: null,
      isRequired: false,
      isPopular: false,
      displayOrder: 4,
    },
    {
      sku: "ADDON-DEDICATED-IP",
      name: "Özel IP Adresi",
      slug: "ozel-ip-adresi",
      description:
        "Paylaşımsız, size özel IP adresi. E-posta itibarı ve SSL uyumluluğu için ideal.",
      categorySlug: "hosting" as const,
      applicableSubTypes: [],
      monthlyPrice: 59,
      yearlyPrice: 49,
      setupFee: 0,
      icon: "Globe",
      badge: null,
      isRequired: false,
      isPopular: false,
      displayOrder: 5,
    },
  ];

  for (const addon of addons) {
    await db.productAddon.upsert({
      where: { sku: addon.sku },
      update: addon,
      create: addon,
    });
  }

  console.log(`  ✓ ${addons.length} hosting addons seeded`);
}
