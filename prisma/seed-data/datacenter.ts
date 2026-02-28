import type { PrismaClient } from "@prisma/client";

export async function seedDatacenterProducts(db: PrismaClient, categoryId: string) {
  const products = [
    // === BARINDIRMA / COLOCATION (subType: barindirma) ===
    {
      sku: "DC-1U", name: "1U Raf", slug: "colocation-1u", subType: "barindirma",
      shortDescription: "Giriş seviye colocation",
      longDescription: "Tier III+ veri merkezinde güvenli sunucu barındırma. 7/24 NOC izleme ve %99.999 uptime SLA.",
      resourceLimits: { rackSpace: "1U", power: "300W", bandwidth: "10 TB", ip: "1 IPv4", port: "1 Gbps" },
      includedFeatures: ["1U raf alanı", "1 Gbps port", "Uzaktan hands desteği", "7/24 NOC izleme"],
      features: [
        { label: "Raf Alanı", value: "1U", icon: "Server" },
        { label: "Güç", value: "300W", icon: "Zap" },
        { label: "Bant Genişliği", value: "10 TB", icon: "Globe" },
        { label: "IP Adresi", value: "1 IPv4", icon: "Network" },
      ],
      faq: [
        { question: "Colocation (sunucu barındırma) nedir?", answer: "Colocation, kendi sunucunuzu profesyonel bir veri merkezinde barındırma hizmetidir. Güç, soğutma, fiziksel güvenlik ve ağ bağlantısı veri merkezi tarafından sağlanır." },
        { question: "Sunucumu nasıl veri merkezine ulaştırabilirim?", answer: "Sunucunuzu kargo ile gönderebilir veya randevu alarak kendiniz getirebilirsiniz. Ekibimiz sunucunuzun montajını ve bağlantısını ücretsiz olarak yapar." },
        { question: "Remote hands desteği nedir?", answer: "Remote hands, veri merkezi personelinin sizin adınıza fiziksel müdahale yapmasıdır. Kablo değişimi, yeniden başlatma, donanım değişimi gibi işlemler için kullanılır." },
        { question: "KVM over IP nedir?", answer: "KVM over IP, sunucunuza internet üzerinden BIOS seviyesinde erişim sağlamanızı mümkün kılar. İşletim sistemi çökmelerinde bile sunucunuza müdahale edebilirsiniz." },
        { question: "Ek güç veya bant genişliği alabilir miyim?", answer: "Evet, ihtiyacınıza göre ek güç ve bant genişliği satın alabilirsiniz. Ücretlendirme kullanıma göre yapılır." },
        { question: "SLA garantisi nedir?", answer: "%99.999 uptime SLA sunuyoruz. Bu, yılda maksimum 5 dakika kesinti anlamına gelir." },
      ],
      basePrice: 799, badge: "BAŞLANGIÇ", isPopular: false, displayOrder: 1,
      pricingTiers: [
        { period: "monthly" as const, price: 799, renewalPrice: 799, isDefault: true },
        { period: "yearly" as const, price: 671, discountedPrice: 671, renewalPrice: 799 },
      ],
    },
    {
      sku: "DC-2U", name: "2U Raf", slug: "colocation-2u", subType: "barindirma",
      shortDescription: "Standart colocation",
      longDescription: "Tier III+ veri merkezinde güvenli sunucu barındırma. KVM over IP ve 7/24 NOC izleme.",
      resourceLimits: { rackSpace: "2U", power: "500W", bandwidth: "20 TB", ip: "2 IPv4", port: "1 Gbps" },
      includedFeatures: ["2U raf alanı", "1 Gbps port", "Uzaktan hands desteği", "7/24 NOC izleme", "KVM over IP"],
      features: [
        { label: "Raf Alanı", value: "2U", icon: "Server" },
        { label: "Güç", value: "500W", icon: "Zap" },
        { label: "Bant Genişliği", value: "20 TB", icon: "Globe" },
        { label: "IP Adresi", value: "2 IPv4", icon: "Network" },
      ],
      faq: [], basePrice: 1299, isPopular: true, displayOrder: 2,
      pricingTiers: [
        { period: "monthly" as const, price: 1299, renewalPrice: 1299, isDefault: true },
        { period: "yearly" as const, price: 1091, discountedPrice: 1091, renewalPrice: 1299 },
      ],
    },
    {
      sku: "DC-4U", name: "4U Raf", slug: "colocation-4u", subType: "barindirma",
      shortDescription: "İşletme colocation",
      longDescription: "Tier III+ veri merkezinde güvenli sunucu barındırma. Özel VLAN ve KVM over IP.",
      resourceLimits: { rackSpace: "4U", power: "1000W", bandwidth: "50 TB", ip: "4 IPv4", port: "1 Gbps" },
      includedFeatures: ["4U raf alanı", "1 Gbps port", "Uzaktan hands desteği", "7/24 NOC izleme", "KVM over IP", "Özel VLAN"],
      features: [
        { label: "Raf Alanı", value: "4U", icon: "Server" },
        { label: "Güç", value: "1000W", icon: "Zap" },
        { label: "Bant Genişliği", value: "50 TB", icon: "Globe" },
        { label: "IP Adresi", value: "4 IPv4", icon: "Network" },
      ],
      faq: [], basePrice: 2199, badge: "İŞLETME", isPopular: false, displayOrder: 3,
      pricingTiers: [
        { period: "monthly" as const, price: 2199, renewalPrice: 2199, isDefault: true },
        { period: "yearly" as const, price: 1847, discountedPrice: 1847, renewalPrice: 2199 },
      ],
    },
    {
      sku: "DC-HALF", name: "Yarım Kabinet", slug: "colocation-yarim-kabinet", subType: "barindirma",
      shortDescription: "Kurumsal colocation",
      longDescription: "21U raf alanı, 10 Gbps port ve private ağ ile kurumsal seviye barındırma.",
      resourceLimits: { rackSpace: "21U", power: "3000W", bandwidth: "100 TB", ip: "8 IPv4", port: "10 Gbps" },
      includedFeatures: ["21U raf alanı", "10 Gbps port", "Uzaktan hands desteği", "7/24 NOC izleme", "KVM over IP", "Özel VLAN", "Private ağ"],
      features: [
        { label: "Raf Alanı", value: "21U", icon: "Server" },
        { label: "Güç", value: "3000W", icon: "Zap" },
        { label: "Bant Genişliği", value: "100 TB", icon: "Globe" },
        { label: "IP Adresi", value: "8 IPv4", icon: "Network" },
      ],
      faq: [], basePrice: 4999, badge: "KURUMSAL", isPopular: false, displayOrder: 4,
      pricingTiers: [
        { period: "monthly" as const, price: 4999, renewalPrice: 4999, isDefault: true },
        { period: "yearly" as const, price: 4199, discountedPrice: 4199, renewalPrice: 4999 },
      ],
    },
    // === CDN (subType: cdn) ===
    {
      sku: "DC-CDN-01", name: "CDN Starter", slug: "cdn-starter", subType: "cdn",
      shortDescription: "Kişisel siteler için",
      longDescription: "Global CDN ağı ile içeriklerinizi dünya genelinde hızla dağıtın.",
      resourceLimits: { bandwidth: "500 GB", pops: "50+", ssl: "Dahil" },
      includedFeatures: ["500 GB aylık trafik", "50+ global PoP", "SSL sertifikası dahil", "Temel DDoS koruması", "Gerçek zamanlı analitik"],
      features: [
        { label: "Trafik", value: "500 GB/ay", icon: "Zap" },
        { label: "Global PoP", value: "50+", icon: "Globe" },
        { label: "SSL", value: "Dahil", icon: "Lock" },
        { label: "DDoS Koruma", value: "Temel", icon: "Shield" },
      ],
      faq: [
        { question: "CDN nedir ve ne işe yarar?", answer: "CDN (Content Delivery Network), web sitenizin içeriklerini dünya genelindeki sunuculara dağıtarak ziyaretçilerinize en yakın noktadan hızlı erişim sağlar." },
        { question: "CDN kurulumu zor mu?", answer: "Hayır, DNS ayarlarınızı değiştirerek dakikalar içinde CDN'i aktif edebilirsiniz. Detaylı kurulum kılavuzumuz mevcuttur." },
        { question: "Hangi içerik türleri önbelleklenir?", answer: "Görseller, CSS, JavaScript, video ve diğer statik dosyalar önbelleğe alınır. Dinamik içerik için de kural tanımlayabilirsiniz." },
        { question: "SSL sertifikası dahil mi?", answer: "Evet, tüm CDN paketlerinde SSL sertifikası ücretsiz olarak dahildir." },
        { question: "Trafik kotasını aşarsam ne olur?", answer: "Kota aşımında hizmet kesilmez, fazla kullanım sonraki faturaya yansıtılır." },
        { question: "Video streaming desteği nasıl çalışır?", answer: "Enterprise paketimizde HLS ve DASH protokolleri ile canlı ve on-demand video streaming desteği sunulmaktadır." },
      ],
      basePrice: 99, badge: "BAŞLANGIÇ", isPopular: false, displayOrder: 1,
      pricingTiers: [
        { period: "monthly" as const, price: 99, renewalPrice: 99, isDefault: true },
        { period: "yearly" as const, price: 83, discountedPrice: 83, renewalPrice: 99 },
      ],
    },
    {
      sku: "DC-CDN-02", name: "CDN Business", slug: "cdn-business", subType: "cdn",
      shortDescription: "İşletmeler için",
      longDescription: "100+ global PoP, WAF koruması ve görsel optimizasyon ile işletme seviyesi CDN.",
      resourceLimits: { bandwidth: "2 TB", pops: "100+", ssl: "Wildcard" },
      includedFeatures: ["2 TB aylık trafik", "100+ global PoP", "Wildcard SSL dahil", "Gelişmiş DDoS koruması", "WAF koruması", "Görsel optimizasyon"],
      features: [
        { label: "Trafik", value: "2 TB/ay", icon: "Zap" },
        { label: "Global PoP", value: "100+", icon: "Globe" },
        { label: "SSL", value: "Wildcard", icon: "Lock" },
        { label: "DDoS Koruma", value: "Gelişmiş", icon: "Shield" },
      ],
      faq: [], basePrice: 299, isPopular: true, displayOrder: 2,
      pricingTiers: [
        { period: "monthly" as const, price: 299, renewalPrice: 299, isDefault: true },
        { period: "yearly" as const, price: 251, discountedPrice: 251, renewalPrice: 299 },
      ],
    },
    {
      sku: "DC-CDN-03", name: "CDN Enterprise", slug: "cdn-enterprise", subType: "cdn",
      shortDescription: "Kurumsal projeler için",
      longDescription: "200+ global PoP, video streaming desteği ve API erişimi ile kurumsal CDN.",
      resourceLimits: { bandwidth: "10 TB", pops: "200+", ssl: "Özel" },
      includedFeatures: ["10 TB aylık trafik", "200+ global PoP", "Özel SSL sertifikası", "Premium DDoS koruması", "WAF + Bot koruması", "Video streaming desteği", "API erişimi"],
      features: [
        { label: "Trafik", value: "10 TB/ay", icon: "Zap" },
        { label: "Global PoP", value: "200+", icon: "Globe" },
        { label: "SSL", value: "Özel", icon: "Lock" },
        { label: "DDoS Koruma", value: "Premium", icon: "Shield" },
      ],
      faq: [], basePrice: 799, badge: "KURUMSAL", isPopular: false, displayOrder: 3,
      pricingTiers: [
        { period: "monthly" as const, price: 799, renewalPrice: 799, isDefault: true },
        { period: "yearly" as const, price: 671, discountedPrice: 671, renewalPrice: 799 },
      ],
    },
    // === DDoS KORUMA (subType: ddos) ===
    {
      sku: "DC-DDOS-01", name: "DDoS Standart", slug: "ddos-standart", subType: "ddos",
      shortDescription: "Küçük ve orta siteler için",
      longDescription: "Otomatik DDoS algılama ve mitigasyon ile web sitenizi koruyun.",
      resourceLimits: { capacity: "10 Gbps", layers: "Layer 3-4" },
      includedFeatures: ["10 Gbps mitigasyon", "Layer 3-4 koruma", "Otomatik algılama", "Gerçek zamanlı izleme", "Temel raporlama"],
      features: [
        { label: "Kapasite", value: "10 Gbps", icon: "Shield" },
        { label: "Koruma", value: "Layer 3-4", icon: "Lock" },
        { label: "Algılama", value: "Otomatik", icon: "Zap" },
        { label: "İzleme", value: "Gerçek zamanlı", icon: "Monitor" },
      ],
      faq: [
        { question: "DDoS saldırısı nedir?", answer: "DDoS (Distributed Denial of Service), sunucunuza aşırı trafik göndererek hizmetinizi kesintiye uğratmayı amaçlayan bir siber saldırı türüdür." },
        { question: "Koruma nasıl aktif edilir?", answer: "DNS ayarlarınızı değiştirerek veya BGP yönlendirmesi ile korumayı aktif edebilirsiniz. Kurulum sürecinde ekibimiz size destek sağlar." },
        { question: "Saldırı sırasında hizmetim kesilir mi?", answer: "Mitigasyon kapasitesi dahilindeki saldırılarda hizmetiniz kesintisiz devam eder. Zararlı trafik filtrelenir, meşru trafik geçirilir." },
        { question: "Layer 7 koruma ne anlama geliyor?", answer: "Layer 7, uygulama katmanı saldırılarına karşı koruma sağlar. HTTP flood, slowloris gibi sofistike saldırıları tespit edip engeller." },
        { question: "Mitigasyon kapasitesi nedir?", answer: "Mitigasyon kapasitesi, aynı anda filtrelenebilecek maksimum saldırı trafiğidir. Örneğin 100 Gbps kapasite, 100 Gbps'ye kadar saldırıları absorbe edebilir." },
        { question: "SLA garantisi neyi kapsar?", answer: "Enterprise pakette %99.99 uptime SLA sunuyoruz. Bu, yılda maksimum 52 dakika kesinti anlamına gelir." },
      ],
      basePrice: 199, badge: "BAŞLANGIÇ", isPopular: false, displayOrder: 1,
      pricingTiers: [
        { period: "monthly" as const, price: 199, renewalPrice: 199, isDefault: true },
        { period: "yearly" as const, price: 167, discountedPrice: 167, renewalPrice: 199 },
      ],
    },
    {
      sku: "DC-DDOS-02", name: "DDoS Pro", slug: "ddos-pro", subType: "ddos",
      shortDescription: "E-ticaret ve kurumsal siteler",
      longDescription: "AI destekli algılama, Layer 3-4-7 koruma ve detaylı analitik.",
      resourceLimits: { capacity: "100 Gbps", layers: "Layer 3-4-7" },
      includedFeatures: ["100 Gbps mitigasyon", "Layer 3-4-7 koruma", "AI destekli algılama", "Detaylı analitik", "Özel kural tanımlama", "7/24 öncelikli destek"],
      features: [
        { label: "Kapasite", value: "100 Gbps", icon: "Shield" },
        { label: "Koruma", value: "Layer 3-4-7", icon: "Lock" },
        { label: "Algılama", value: "AI destekli", icon: "Zap" },
        { label: "Destek", value: "7/24 Öncelikli", icon: "Headphones" },
      ],
      faq: [], basePrice: 499, isPopular: true, displayOrder: 2,
      pricingTiers: [
        { period: "monthly" as const, price: 499, renewalPrice: 499, isDefault: true },
        { period: "yearly" as const, price: 419, discountedPrice: 419, renewalPrice: 499 },
      ],
    },
    {
      sku: "DC-DDOS-03", name: "DDoS Enterprise", slug: "ddos-enterprise", subType: "ddos",
      shortDescription: "Kritik altyapılar için",
      longDescription: "1+ Tbps mitigasyon, SOC ekibi izleme ve BGP Anycast ile enterprise seviye koruma.",
      resourceLimits: { capacity: "1 Tbps", layers: "Layer 3-4-7" },
      includedFeatures: ["1+ Tbps mitigasyon", "Layer 3-4-7 koruma", "AI + ML algılama", "SOC ekibi izleme", "BGP Anycast", "SLA garantisi (%99.99)"],
      features: [
        { label: "Kapasite", value: "1+ Tbps", icon: "Shield" },
        { label: "Koruma", value: "Layer 3-4-7", icon: "Lock" },
        { label: "Algılama", value: "AI + ML", icon: "Zap" },
        { label: "SOC", value: "7/24 İzleme", icon: "Monitor" },
      ],
      faq: [], basePrice: 1499, badge: "KURUMSAL", isPopular: false, displayOrder: 3,
      pricingTiers: [
        { period: "monthly" as const, price: 1499, renewalPrice: 1499, isDefault: true },
        { period: "yearly" as const, price: 1259, discountedPrice: 1259, renewalPrice: 1499 },
      ],
    },
    // === IP & ASN (subType: ip-asn) ===
    {
      sku: "DC-IP29", name: "/29 Blok", slug: "ipv4-29", subType: "ip-asn",
      shortDescription: "5 kullanılabilir IP",
      longDescription: "RIPE kayıtlı IPv4 blokları. Hemen teslim ve PTR yönetimi dahil.",
      resourceLimits: { ips: "5 Kullanılabilir IP", block: "/29" },
      includedFeatures: ["RIPE kayıtlı", "Hemen teslim", "PTR yönetimi", "Abuse yönetimi"],
      features: [
        { label: "IP Sayısı", value: "5 Kullanılabilir", icon: "Globe" },
        { label: "Blok", value: "/29", icon: "Network" },
        { label: "Kayıt", value: "RIPE", icon: "Shield" },
        { label: "Teslim", value: "Hemen", icon: "Zap" },
      ],
      faq: [
        { question: "IPv4 blokları ne için kullanılır?", answer: "IPv4 blokları sunucularınıza, VPN hizmetlerine, CDN yapılarına veya hosting altyapınıza ek IP adresleri eklemek için kullanılır." },
        { question: "IP bloklarının geçmişi kontrol ediliyor mu?", answer: "Evet, tüm IP bloklarımız kara liste kontrolünden geçirilir. Temiz geçmişe sahip IP'ler sunuyoruz." },
        { question: "BGP session desteği var mı?", answer: "Evet, ASN hizmetlerimiz ile birlikte BGP session desteği sunuyoruz. Kendi ASN'iniz ile IP bloklarınızı announce edebilirsiniz." },
        { question: "Geolocation güncellemesi nedir?", answer: "IP bloklarınızın coğrafi konum bilgisini istediğiniz ülke/şehir olarak güncelliyoruz. /28 ve üstü bloklarda bu hizmet dahildir." },
        { question: "ASN kiralama nedir?", answer: "ASN (Autonomous System Number), IP bloklarınızı BGP protokolü ile internet üzerinde announce etmenizi sağlayan benzersiz bir numaradır." },
        { question: "Daha büyük bloklar mevcut mu?", answer: "Evet, /25 ve /24 gibi daha büyük bloklar için bizimle iletişime geçebilirsiniz. Özel fiyatlandırma yapılmaktadır." },
      ],
      basePrice: 299, badge: "BAŞLANGIÇ", isPopular: false, displayOrder: 1,
      pricingTiers: [
        { period: "monthly" as const, price: 299, renewalPrice: 299, isDefault: true },
      ],
    },
    {
      sku: "DC-IP28", name: "/28 Blok", slug: "ipv4-28", subType: "ip-asn",
      shortDescription: "13 kullanılabilir IP",
      longDescription: "RIPE kayıtlı IPv4 blokları. Geolocation güncelleme dahil.",
      resourceLimits: { ips: "13 Kullanılabilir IP", block: "/28" },
      includedFeatures: ["RIPE kayıtlı", "Hemen teslim", "PTR yönetimi", "Abuse yönetimi", "Geolocation güncelleme"],
      features: [
        { label: "IP Sayısı", value: "13 Kullanılabilir", icon: "Globe" },
        { label: "Blok", value: "/28", icon: "Network" },
        { label: "Kayıt", value: "RIPE", icon: "Shield" },
        { label: "Teslim", value: "Hemen", icon: "Zap" },
      ],
      faq: [], basePrice: 549, isPopular: true, displayOrder: 2,
      pricingTiers: [
        { period: "monthly" as const, price: 549, renewalPrice: 549, isDefault: true },
      ],
    },
    {
      sku: "DC-IP27", name: "/27 Blok", slug: "ipv4-27", subType: "ip-asn",
      shortDescription: "29 kullanılabilir IP",
      longDescription: "RIPE kayıtlı IPv4 blokları. Özel destek ve geolocation güncelleme.",
      resourceLimits: { ips: "29 Kullanılabilir IP", block: "/27" },
      includedFeatures: ["RIPE kayıtlı", "Hemen teslim", "PTR yönetimi", "Abuse yönetimi", "Geolocation güncelleme", "Özel destek"],
      features: [
        { label: "IP Sayısı", value: "29 Kullanılabilir", icon: "Globe" },
        { label: "Blok", value: "/27", icon: "Network" },
        { label: "Kayıt", value: "RIPE", icon: "Shield" },
        { label: "Teslim", value: "Hemen", icon: "Zap" },
      ],
      faq: [], basePrice: 999, badge: "İŞLETME", isPopular: false, displayOrder: 3,
      pricingTiers: [
        { period: "monthly" as const, price: 999, renewalPrice: 999, isDefault: true },
      ],
    },
    {
      sku: "DC-IP26", name: "/26 Blok", slug: "ipv4-26", subType: "ip-asn",
      shortDescription: "61 kullanılabilir IP",
      longDescription: "RIPE kayıtlı IPv4 blokları. SLA garantisi ve özel destek.",
      resourceLimits: { ips: "61 Kullanılabilir IP", block: "/26" },
      includedFeatures: ["RIPE kayıtlı", "Hemen teslim", "PTR yönetimi", "Abuse yönetimi", "Geolocation güncelleme", "Özel destek", "SLA garantisi"],
      features: [
        { label: "IP Sayısı", value: "61 Kullanılabilir", icon: "Globe" },
        { label: "Blok", value: "/26", icon: "Network" },
        { label: "Kayıt", value: "RIPE", icon: "Shield" },
        { label: "Teslim", value: "Hemen", icon: "Zap" },
      ],
      faq: [], basePrice: 1899, badge: "KURUMSAL", isPopular: false, displayOrder: 4,
      pricingTiers: [
        { period: "monthly" as const, price: 1899, renewalPrice: 1899, isDefault: true },
      ],
    },
    {
      sku: "DC-ASN-01", name: "ASN Kiralama", slug: "asn-kiralama", subType: "ip-asn",
      shortDescription: "RIPE kayıtlı ASN numarası",
      longDescription: "RIPE kayıtlı ASN numarası kiralama. BGP session desteği ve LOA belgesi dahil.",
      resourceLimits: { asn: "2 Basamaklı ASN" },
      includedFeatures: ["2 basamaklı ASN", "RIPE veritabanı kaydı", "IRR kayıtları", "BGP session desteği", "LOA belgesi"],
      features: [
        { label: "ASN", value: "2 Basamaklı", icon: "Network" },
        { label: "Kayıt", value: "RIPE", icon: "Shield" },
        { label: "BGP", value: "Session Desteği", icon: "Globe" },
        { label: "LOA", value: "Dahil", icon: "FileText" },
      ],
      faq: [], basePrice: 499, badge: "TEMEL", isPopular: false, displayOrder: 5,
      pricingTiers: [
        { period: "monthly" as const, price: 499, renewalPrice: 499, isDefault: true },
      ],
    },
    {
      sku: "DC-ASN-02", name: "ASN + IP Paketi", slug: "asn-ip-paketi", subType: "ip-asn",
      shortDescription: "ASN + /24 IPv4 blok",
      longDescription: "ASN + /24 IPv4 blok kiralama. 253 kullanılabilir IP ve geolocation güncelleme dahil.",
      resourceLimits: { asn: "2 Basamaklı ASN", ips: "253 Kullanılabilir IP", block: "/24" },
      includedFeatures: ["2 basamaklı ASN", "/24 IPv4 blok (253 IP)", "RIPE veritabanı kaydı", "IRR kayıtları", "BGP session desteği", "LOA belgesi", "Geolocation güncelleme"],
      features: [
        { label: "ASN", value: "2 Basamaklı", icon: "Network" },
        { label: "IP", value: "253 Kullanılabilir", icon: "Globe" },
        { label: "BGP", value: "Session Desteği", icon: "Globe" },
        { label: "Geolocation", value: "Dahil", icon: "MapPin" },
      ],
      faq: [], basePrice: 1299, isPopular: true, displayOrder: 6,
      pricingTiers: [
        { period: "monthly" as const, price: 1299, renewalPrice: 1299, isDefault: true },
      ],
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
