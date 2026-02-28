import type { PrismaClient } from "@prisma/client";

export async function seedSslProducts(db: PrismaClient, categoryId: string) {
  const products = [
    // === STANDART SSL (subType: standart) ===
    {
      sku: "SSL-DV-01", name: "DV SSL", slug: "ssl-dv", subType: "standart",
      shortDescription: "Kişisel web siteleri için",
      longDescription: "Domain doğrulamalı SSL sertifikaları. Hızlı onay, güçlü şifreleme ve uygun fiyat.",
      resourceLimits: { validationType: "DV", validationTime: "5 dakika", warranty: "$10.000" },
      includedFeatures: ["Domain doğrulaması", "256-bit şifreleme", "Tek domain koruma", "99.9% tarayıcı uyumu", "Statik site mührü", "$10.000 garanti", "Ücretsiz tekrar oluşturma"],
      features: [
        { label: "Doğrulama", value: "Domain (DV)", icon: "Shield" },
        { label: "Şifreleme", value: "256-bit", icon: "Lock" },
        { label: "Onay Süresi", value: "5 dakika", icon: "Clock" },
        { label: "Garanti", value: "$10.000", icon: "BadgeCheck" },
      ],
      faq: [
        { question: "DV SSL nedir?", answer: "DV (Domain Validation) SSL, sadece domain sahipliğinin doğrulandığı en temel SSL sertifikası türüdür. Kişisel siteler, bloglar ve portfolyolar için idealdir." },
        { question: "SSL sertifikası ne kadar sürede aktif olur?", answer: "DV SSL sertifikaları genellikle 5 dakika içinde aktif edilir. OV ve EV sertifikaları şirket doğrulaması gerektirdiği için 1-7 gün sürebilir." },
        { question: "Ücretsiz SSL ile ücretli SSL arasındaki fark nedir?", answer: "Ücretli SSL sertifikaları daha yüksek garanti tutarları, şirket doğrulaması, dinamik site mühürleri ve öncelikli destek gibi ek özellikler sunar." },
        { question: "SSL sertifikası SEO'yu etkiler mi?", answer: "Evet, Google HTTPS kullanan siteleri sıralamada avantajlı konumlandırır. SSL sertifikası hem güvenlik hem de SEO açısından önemlidir." },
      ],
      basePrice: 99, isPopular: false, displayOrder: 1,
      pricingTiers: [
        { period: "yearly" as const, price: 99, renewalPrice: 99, isDefault: true },
        { period: "biennial" as const, price: 179, renewalPrice: 198 },
      ],
    },
    {
      sku: "SSL-OV-01", name: "OV SSL", slug: "ssl-ov", subType: "standart",
      shortDescription: "Küçük işletmeler için",
      longDescription: "Şirket doğrulamalı SSL sertifikaları. Kurumsal güven ve yüksek garanti.",
      resourceLimits: { validationType: "OV", validationTime: "1-3 gün", warranty: "$250.000" },
      includedFeatures: ["Şirket doğrulaması", "256-bit şifreleme", "Tek domain koruma", "99.9% tarayıcı uyumu", "Dinamik site mührü", "$250.000 garanti", "Ücretsiz tekrar oluşturma", "Şirket bilgisi gösterimi"],
      features: [
        { label: "Doğrulama", value: "Şirket (OV)", icon: "Shield" },
        { label: "Şifreleme", value: "256-bit", icon: "Lock" },
        { label: "Onay Süresi", value: "1-3 gün", icon: "Clock" },
        { label: "Garanti", value: "$250.000", icon: "BadgeCheck" },
      ],
      faq: [], basePrice: 299, isPopular: true, displayOrder: 2,
      pricingTiers: [
        { period: "yearly" as const, price: 299, renewalPrice: 299, isDefault: true },
        { period: "biennial" as const, price: 549, renewalPrice: 598 },
      ],
    },
    {
      sku: "SSL-OVP-01", name: "OV SSL Pro", slug: "ssl-ov-pro", subType: "standart",
      shortDescription: "Orta ölçekli işletmeler için",
      longDescription: "Gelişmiş şirket doğrulamalı SSL sertifikaları. Öncelikli destek ve yüksek garanti.",
      resourceLimits: { validationType: "OV Pro", validationTime: "1-3 gün", warranty: "$500.000" },
      includedFeatures: ["Gelişmiş şirket doğrulaması", "256-bit şifreleme", "Tek domain koruma", "99.9% tarayıcı uyumu", "Dinamik site mührü", "$500.000 garanti", "Ücretsiz tekrar oluşturma", "Öncelikli destek", "Şirket bilgisi gösterimi"],
      features: [
        { label: "Doğrulama", value: "Gelişmiş OV", icon: "Shield" },
        { label: "Şifreleme", value: "256-bit", icon: "Lock" },
        { label: "Onay Süresi", value: "1-3 gün", icon: "Clock" },
        { label: "Garanti", value: "$500.000", icon: "BadgeCheck" },
      ],
      faq: [], basePrice: 499, isPopular: false, displayOrder: 3,
      pricingTiers: [
        { period: "yearly" as const, price: 499, renewalPrice: 499, isDefault: true },
        { period: "biennial" as const, price: 899, renewalPrice: 998 },
      ],
    },
    // === WILDCARD SSL (subType: wildcard) ===
    {
      sku: "SSL-WC-DV", name: "Wildcard DV", slug: "ssl-wildcard-dv", subType: "wildcard",
      shortDescription: "Tüm alt domainler için",
      longDescription: "Wildcard SSL ile tüm alt domainlerinizi tek sertifika ile koruyun.",
      resourceLimits: { validationType: "DV", validationTime: "15 dakika", warranty: "$10.000" },
      includedFeatures: ["*.domain.com koruma", "Sınırsız alt domain", "Domain doğrulaması", "256-bit şifreleme", "99.9% tarayıcı uyumu", "$10.000 garanti", "Ücretsiz tekrar oluşturma"],
      features: [
        { label: "Koruma", value: "*.domain.com", icon: "Shield" },
        { label: "Alt Domain", value: "Sınırsız", icon: "Globe" },
        { label: "Onay Süresi", value: "15 dakika", icon: "Clock" },
        { label: "Garanti", value: "$10.000", icon: "BadgeCheck" },
      ],
      faq: [
        { question: "Wildcard SSL nedir?", answer: "Wildcard SSL, ana domain ve tüm alt domainlerinizi (*.domain.com) tek bir sertifika ile koruyan SSL türüdür." },
        { question: "Kaç tane alt domain koruyabilirim?", answer: "Sınırsız sayıda alt domain koruyabilirsiniz. Yeni eklenen alt domainler de otomatik olarak korunur." },
        { question: "Alt domainlerin alt domainlerini de korur mu?", answer: "Hayır, standart Wildcard SSL sadece bir seviye alt domaini korur. *.domain.com olarak çalışır, *.sub.domain.com için ayrı sertifika gerekir." },
      ],
      basePrice: 299, isPopular: false, displayOrder: 1,
      pricingTiers: [
        { period: "yearly" as const, price: 299, renewalPrice: 299, isDefault: true },
        { period: "biennial" as const, price: 549, renewalPrice: 598 },
      ],
    },
    {
      sku: "SSL-WC-OV", name: "Wildcard OV", slug: "ssl-wildcard-ov", subType: "wildcard",
      shortDescription: "İşletmeler için önerilen",
      longDescription: "Şirket doğrulamalı Wildcard SSL ile kurumsal güven.",
      resourceLimits: { validationType: "OV", validationTime: "1-3 gün", warranty: "$250.000" },
      includedFeatures: ["*.domain.com koruma", "Sınırsız alt domain", "Şirket doğrulaması", "256-bit şifreleme", "99.9% tarayıcı uyumu", "$250.000 garanti", "Ücretsiz tekrar oluşturma", "Dinamik site mührü", "Şirket bilgisi gösterimi"],
      features: [
        { label: "Koruma", value: "*.domain.com", icon: "Shield" },
        { label: "Alt Domain", value: "Sınırsız", icon: "Globe" },
        { label: "Onay Süresi", value: "1-3 gün", icon: "Clock" },
        { label: "Garanti", value: "$250.000", icon: "BadgeCheck" },
      ],
      faq: [], basePrice: 599, isPopular: true, displayOrder: 2,
      pricingTiers: [
        { period: "yearly" as const, price: 599, renewalPrice: 599, isDefault: true },
        { period: "biennial" as const, price: 1099, renewalPrice: 1198 },
      ],
    },
    {
      sku: "SSL-WC-OVP", name: "Wildcard OV Pro", slug: "ssl-wildcard-ov-pro", subType: "wildcard",
      shortDescription: "Kurumsal projeler için",
      longDescription: "Gelişmiş şirket doğrulamalı Wildcard SSL. Çoklu sunucu lisansı ve öncelikli destek.",
      resourceLimits: { validationType: "OV Pro", validationTime: "1-3 gün", warranty: "$500.000" },
      includedFeatures: ["*.domain.com koruma", "Sınırsız alt domain", "Gelişmiş şirket doğrulaması", "256-bit şifreleme", "99.9% tarayıcı uyumu", "$500.000 garanti", "Ücretsiz tekrar oluşturma", "Dinamik site mührü", "Öncelikli destek", "Çoklu sunucu lisansı"],
      features: [
        { label: "Koruma", value: "*.domain.com", icon: "Shield" },
        { label: "Alt Domain", value: "Sınırsız", icon: "Globe" },
        { label: "Onay Süresi", value: "1-3 gün", icon: "Clock" },
        { label: "Garanti", value: "$500.000", icon: "BadgeCheck" },
      ],
      faq: [], basePrice: 999, isPopular: false, displayOrder: 3,
      pricingTiers: [
        { period: "yearly" as const, price: 999, renewalPrice: 999, isDefault: true },
        { period: "biennial" as const, price: 1799, renewalPrice: 1998 },
      ],
    },
    // === EV SSL (subType: ev) ===
    {
      sku: "SSL-EV-01", name: "EV SSL", slug: "ssl-ev", subType: "ev",
      shortDescription: "Tek domain için",
      longDescription: "Kapsamlı şirket doğrulamalı EV SSL. Yeşil adres çubuğu ve maksimum güven.",
      resourceLimits: { validationType: "EV", validationTime: "3-7 gün", warranty: "$1.500.000" },
      includedFeatures: ["Kapsamlı şirket doğrulaması", "Yeşil adres çubuğu", "256-bit şifreleme", "Tek domain koruma", "99.9% tarayıcı uyumu", "$1.500.000 garanti", "Ücretsiz tekrar oluşturma", "Dinamik site mührü"],
      features: [
        { label: "Doğrulama", value: "Extended (EV)", icon: "Shield" },
        { label: "Şifreleme", value: "256-bit", icon: "Lock" },
        { label: "Onay Süresi", value: "3-7 gün", icon: "Clock" },
        { label: "Garanti", value: "$1.500.000", icon: "BadgeCheck" },
      ],
      faq: [
        { question: "EV SSL nedir?", answer: "EV (Extended Validation) SSL, en kapsamlı doğrulama sürecinden geçen SSL sertifikası türüdür. Şirketinizin yasal durumu, fiziksel adresi ve operasyonel varlığı doğrulanır." },
        { question: "Yeşil adres çubuğu nedir?", answer: "EV SSL sertifikası ile tarayıcıda şirket adınız görünür. Bu, ziyaretçilerinize en üst düzey güven sağlar." },
        { question: "EV SSL doğrulama süreci nasıl işler?", answer: "Başvuru, şirket doğrulama, adres ve telefon doğrulama, operasyonel doğrulama ve sertifika onayı olmak üzere 5 adımdan oluşur." },
      ],
      basePrice: 799, isPopular: false, displayOrder: 1,
      pricingTiers: [
        { period: "yearly" as const, price: 799, renewalPrice: 799, isDefault: true },
        { period: "biennial" as const, price: 1449, renewalPrice: 1598 },
      ],
    },
    {
      sku: "SSL-EV-02", name: "EV SSL Pro", slug: "ssl-ev-pro", subType: "ev",
      shortDescription: "Kurumsal projeler için",
      longDescription: "Kapsamlı şirket doğrulamalı EV SSL Pro. SLA garantisi ve öncelikli destek.",
      resourceLimits: { validationType: "EV", validationTime: "3-7 gün", warranty: "$1.750.000" },
      includedFeatures: ["Kapsamlı şirket doğrulaması", "Yeşil adres çubuğu", "256-bit şifreleme", "Tek domain koruma", "99.9% tarayıcı uyumu", "$1.750.000 garanti", "Ücretsiz tekrar oluşturma", "Dinamik site mührü", "Öncelikli destek", "SLA garantisi"],
      features: [
        { label: "Doğrulama", value: "Extended (EV)", icon: "Shield" },
        { label: "Şifreleme", value: "256-bit", icon: "Lock" },
        { label: "Onay Süresi", value: "3-7 gün", icon: "Clock" },
        { label: "Garanti", value: "$1.750.000", icon: "BadgeCheck" },
      ],
      faq: [], basePrice: 1299, isPopular: true, displayOrder: 2,
      pricingTiers: [
        { period: "yearly" as const, price: 1299, renewalPrice: 1299, isDefault: true },
        { period: "biennial" as const, price: 2349, renewalPrice: 2598 },
      ],
    },
    {
      sku: "SSL-EV-MD", name: "EV Multi-Domain", slug: "ssl-ev-multi-domain", subType: "ev",
      shortDescription: "Çoklu domain için",
      longDescription: "Birden fazla domaini tek EV SSL sertifikası ile koruyun. 5 domain dahil, 25'e kadar genişletilebilir.",
      resourceLimits: { validationType: "EV", validationTime: "3-7 gün", warranty: "$2.000.000", domains: "5 dahil (25'e kadar)" },
      includedFeatures: ["Kapsamlı şirket doğrulaması", "Yeşil adres çubuğu", "256-bit şifreleme", "5 domain dahil (25'e kadar)", "99.9% tarayıcı uyumu", "$2.000.000 garanti", "Ücretsiz tekrar oluşturma", "Dinamik site mührü", "Öncelikli destek", "Dedicated account manager"],
      features: [
        { label: "Doğrulama", value: "Extended (EV)", icon: "Shield" },
        { label: "Domain", value: "5 dahil (25'e kadar)", icon: "Globe" },
        { label: "Onay Süresi", value: "3-7 gün", icon: "Clock" },
        { label: "Garanti", value: "$2.000.000", icon: "BadgeCheck" },
      ],
      faq: [], basePrice: 1999, isPopular: false, displayOrder: 3,
      pricingTiers: [
        { period: "yearly" as const, price: 1999, renewalPrice: 1999, isDefault: true },
        { period: "biennial" as const, price: 3599, renewalPrice: 3998 },
      ],
    },
    // === KURUMSAL SSL (subType: kurumsal) ===
    {
      sku: "SSL-ENT-01", name: "Kurumsal Paket", slug: "ssl-kurumsal", subType: "kurumsal",
      shortDescription: "Orta ölçekli işletmeler",
      longDescription: "10+ SSL sertifikası için toplu indirim ve merkezi yönetim.",
      resourceLimits: { sslCount: "10+" },
      includedFeatures: ["10+ SSL sertifikası", "Toplu indirim", "Merkezi yönetim paneli", "Otomatik yenileme", "E-posta desteği", "Aylık raporlama"],
      features: [
        { label: "SSL Sayısı", value: "10+", icon: "Shield" },
        { label: "Yönetim", value: "Merkezi Panel", icon: "Monitor" },
        { label: "Destek", value: "E-posta", icon: "Mail" },
      ],
      faq: [
        { question: "Kurumsal SSL paketleri nasıl çalışır?", answer: "Kurumsal SSL paketleri, birden fazla SSL sertifikasını toplu indirimle almanızı ve merkezi bir panel üzerinden yönetmenizi sağlar." },
        { question: "Hangi SSL türlerini seçebilirim?", answer: "DV, OV, EV, Wildcard ve Multi-Domain dahil tüm SSL türlerini kurumsal paket kapsamında alabilirsiniz." },
        { question: "Fiyatlandırma nasıl yapılıyor?", answer: "Sertifika sayısına ve türüne göre özel fiyatlandırma yapılmaktadır. İletişime geçerek size özel teklif alabilirsiniz." },
      ],
      basePrice: 0, isPopular: false, displayOrder: 1,
      pricingTiers: [],
    },
    {
      sku: "SSL-ENT-02", name: "Enterprise Paket", slug: "ssl-enterprise", subType: "kurumsal",
      shortDescription: "Büyük kuruluşlar",
      longDescription: "50+ SSL sertifikası için özel fiyatlandırma, API entegrasyonu ve 7/24 öncelikli destek.",
      resourceLimits: { sslCount: "50+" },
      includedFeatures: ["50+ SSL sertifikası", "Özel fiyatlandırma", "API entegrasyonu", "Otomatik yenileme", "7/24 öncelikli destek", "Dedicated account manager", "Haftalık raporlama", "SLA garantisi"],
      features: [
        { label: "SSL Sayısı", value: "50+", icon: "Shield" },
        { label: "Yönetim", value: "API + Panel", icon: "Monitor" },
        { label: "Destek", value: "7/24 Öncelikli", icon: "Headphones" },
      ],
      faq: [], basePrice: 0, isPopular: true, displayOrder: 2,
      pricingTiers: [],
    },
    {
      sku: "SSL-ENT-03", name: "Özel Çözümler", slug: "ssl-ozel-cozumler", subType: "kurumsal",
      shortDescription: "Holding ve grup şirketleri",
      longDescription: "Sınırsız SSL sertifikası, white-label seçeneği ve dedicated destek ekibi.",
      resourceLimits: { sslCount: "Sınırsız" },
      includedFeatures: ["Sınırsız SSL sertifikası", "Tamamen özel fiyat", "Tam API kontrolü", "White-label seçeneği", "Dedicated destek ekibi", "Özel SLA", "Günlük raporlama", "Yerinde eğitim"],
      features: [
        { label: "SSL Sayısı", value: "Sınırsız", icon: "Shield" },
        { label: "Yönetim", value: "Tam API", icon: "Monitor" },
        { label: "Destek", value: "Dedicated Ekip", icon: "Headphones" },
      ],
      faq: [], basePrice: 0, isPopular: false, displayOrder: 3,
      pricingTiers: [],
    },
  ];

  for (const product of products) {
    const { pricingTiers, ...productData } = product;
    await db.product.create({
      data: {
        ...productData,
        categoryId,
        status: "ACTIVE",
        isVisible: true,
        ...(pricingTiers.length > 0 ? {
          pricingTiers: { create: pricingTiers.map((t) => ({ ...t, isActive: true })) },
        } : {}),
      },
    });
  }
}
