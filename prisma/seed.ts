import "dotenv/config";
import { Pool } from "pg";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import { seedHostingProducts } from "./seed-data/hosting";
import { seedVdsProducts, seedVpsProducts, seedCloudProducts, seedServerProducts } from "./seed-data/sunucu";
import { seedSslProducts } from "./seed-data/ssl";
import { seedDatacenterProducts } from "./seed-data/datacenter";
import { seedDomainTlds } from "./seed-data/domain-tlds";
import { seedHostingAddons } from "./seed-data/addons";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // =====================
  // CLEANUP (order matters for FK constraints)
  // =====================
  await prisma.affiliatePayment.deleteMany();
  await prisma.affiliateReferral.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.systemIncident.deleteMany();
  await prisma.systemStatus.deleteMany();
  await prisma.ticketMessage.deleteMany();
  await prisma.supportTicket.deleteMany();
  await prisma.backup.deleteMany();
  await prisma.backupSchedule.deleteMany();
  await prisma.stripeWebhookEvent.deleteMany();
  await prisma.eInvoiceRecord.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.cancellationRequest.deleteMany();
  await prisma.servicePlanChange.deleteMany();
  await prisma.provisioningJob.deleteMany();
  await prisma.dnsRecord.deleteMany();
  await prisma.domain.deleteMany();
  await prisma.sslCertificate.deleteMany();
  await prisma.emailMessage.deleteMany();
  await prisma.emailAccount.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.orderActivity.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.service.deleteMany();
  await prisma.server.deleteMany();
  await prisma.productAddon.deleteMany();
  await prisma.productConfigOption.deleteMany();
  await prisma.pricingTier.deleteMany();
  await prisma.product.deleteMany();
  await prisma.productFeature.deleteMany();
  await prisma.productCategory.deleteMany();
  await prisma.domainTld.deleteMany();
  await prisma.promotionCode.deleteMany();
  await prisma.blogPost.deleteMany();
  await prisma.blogCategory.deleteMany();
  await prisma.knowledgeBaseArticle.deleteMany();
  await prisma.knowledgeBaseCategory.deleteMany();
  await prisma.contactMessage.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  console.log("Cleanup done");

  // =====================
  // USERS
  // =====================
  const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD?.trim();
  if (!seedAdminPassword) {
    console.warn(
      "SEED_ADMIN_PASSWORD is not set — admin user will not be created. Set SEED_ADMIN_PASSWORD in .env before seeding."
    );
  } else {
    const adminPassword = await hash(seedAdminPassword, 12);

    await prisma.user.upsert({
      where: { email: "admin@kleacore.com" },
      update: {},
      create: {
      email: "admin@kleacore.com",
      password: adminPassword,
      name: "Admin",
      surname: "KLEACORE",
      phone: "+90 555 000 0000",
      role: "ADMIN",
      status: "ACTIVE",
      customerType: "CORPORATE",
      companyName: "KLEAWORK DIGITAL LLC",
      },
    });

    console.log("Admin user created");
  }

  // =====================
  // PRODUCT CATEGORIES
  // =====================
  const categories = await Promise.all([
    prisma.productCategory.upsert({
      where: { slug: "hosting" },
      update: {},
      create: {
        slug: "hosting",
        name: "Web Hosting",
        description: "Paylaşımlı ve özel web hosting paketleri",
        icon: "Server",
        displayOrder: 1,
      },
    }),
    prisma.productCategory.upsert({
      where: { slug: "vds" },
      update: {},
      create: {
        slug: "vds",
        name: "VDS Sunucu",
        description: "Virtual Dedicated Server çözümleri",
        icon: "HardDrive",
        displayOrder: 2,
      },
    }),
    prisma.productCategory.upsert({
      where: { slug: "vps" },
      update: {},
      create: {
        slug: "vps",
        name: "VPS Sunucu",
        description: "Virtual Private Server paketleri",
        icon: "Cloud",
        displayOrder: 3,
      },
    }),
    prisma.productCategory.upsert({
      where: { slug: "server" },
      update: {},
      create: {
        slug: "server",
        name: "Fiziksel Sunucu",
        description: "Dedicated sunucu çözümleri",
        icon: "Server",
        displayOrder: 4,
      },
    }),
    prisma.productCategory.upsert({
      where: { slug: "cloud" },
      update: {},
      create: {
        slug: "cloud",
        name: "Bulut Sunucu",
        description: "Yüksek performanslı bulut sunucu çözümleri",
        icon: "Cloud",
        displayOrder: 5,
      },
    }),
    prisma.productCategory.upsert({
      where: { slug: "datacenter" },
      update: {},
      create: {
        slug: "datacenter",
        name: "Veri Merkezi",
        description: "Colocation, CDN, DDoS koruma ve IP/ASN hizmetleri",
        icon: "Building",
        displayOrder: 6,
      },
    }),
    prisma.productCategory.upsert({
      where: { slug: "domain" },
      update: {},
      create: {
        slug: "domain",
        name: "Domain",
        description: "Alan adı kayıt ve transfer",
        icon: "Globe",
        displayOrder: 7,
      },
    }),
    prisma.productCategory.upsert({
      where: { slug: "ssl" },
      update: {},
      create: {
        slug: "ssl",
        name: "SSL Sertifikası",
        description: "SSL/TLS güvenlik sertifikaları",
        icon: "Shield",
        displayOrder: 8,
      },
    }),
    prisma.productCategory.upsert({
      where: { slug: "email" },
      update: {},
      create: {
        slug: "email",
        name: "Kurumsal E-posta",
        description: "Profesyonel e-posta hizmetleri",
        icon: "Mail",
        displayOrder: 9,
      },
    }),
  ]);

  const [catHosting, catVds, catVps, catServer, catCloud, catDatacenter, catDomain, catSsl, catEmail] =
    categories;

  console.log("Categories created");

  // =====================
  // PRODUCT FEATURES
  // =====================
  const productFeatures = [
    { categoryId: "hosting", name: "Disk Alanı", slug: "disk-space", unit: "GB", icon: "HardDrive", isHighlighted: true, displayOrder: 1, isActive: true },
    { categoryId: "hosting", name: "Aylık Trafik", slug: "bandwidth", unit: "GB", icon: "RefreshCcw", isHighlighted: true, displayOrder: 2, isActive: true },
    { categoryId: "hosting", name: "E-posta Hesabı", slug: "email-accounts", unit: "Adet", icon: "Mail", isHighlighted: true, displayOrder: 3, isActive: true },
    { categoryId: "hosting", name: "Veritabanı", slug: "databases", unit: "Adet", icon: "Database", isHighlighted: false, displayOrder: 4, isActive: true },
    { categoryId: "hosting", name: "Domain", slug: "domains", unit: "Adet", icon: "Globe", isHighlighted: false, displayOrder: 5, isActive: true },
    { categoryId: "hosting", name: "Alt Domain", slug: "subdomains", unit: "Adet", icon: "Globe", isHighlighted: false, displayOrder: 6, isActive: true },
    { categoryId: "hosting", name: "FTP Hesabı", slug: "ftp-accounts", unit: "Adet", icon: "Server", isHighlighted: false, displayOrder: 7, isActive: true },
    { categoryId: "hosting", name: "SSL Sertifikası", slug: "ssl", unit: "Adet", icon: "Shield", isHighlighted: true, displayOrder: 8, isActive: true },
    { categoryId: "vds", name: "CPU Çekirdek", slug: "cpu-cores", unit: "Adet", icon: "Cpu", isHighlighted: true, displayOrder: 1, isActive: true },
    { categoryId: "vds", name: "RAM", slug: "ram", unit: "GB", icon: "MemoryStick", isHighlighted: true, displayOrder: 2, isActive: true },
    { categoryId: "vds", name: "SSD Disk", slug: "ssd-disk", unit: "GB", icon: "HardDrive", isHighlighted: true, displayOrder: 3, isActive: true },
    { categoryId: "vds", name: "IP Adresi", slug: "ip-addresses", unit: "Adet", icon: "Globe", isHighlighted: false, displayOrder: 4, isActive: true },
    { categoryId: "vps", name: "CPU Çekirdek", slug: "cpu-cores", unit: "Adet", icon: "Cpu", isHighlighted: true, displayOrder: 1, isActive: true },
    { categoryId: "vps", name: "RAM", slug: "ram", unit: "GB", icon: "MemoryStick", isHighlighted: true, displayOrder: 2, isActive: true },
    { categoryId: "vps", name: "NVMe Disk", slug: "nvme-disk", unit: "GB", icon: "HardDrive", isHighlighted: true, displayOrder: 3, isActive: true },
    { categoryId: "domain", name: "WHOIS Gizliliği", slug: "whois-privacy", unit: "-", icon: "Shield", isHighlighted: true, displayOrder: 1, isActive: true },
    { categoryId: "domain", name: "DNS Yönetimi", slug: "dns-management", unit: "-", icon: "Server", isHighlighted: false, displayOrder: 2, isActive: true },
    { categoryId: "ssl", name: "Doğrulama Tipi", slug: "validation-type", unit: "-", icon: "Shield", isHighlighted: true, displayOrder: 1, isActive: true },
    { categoryId: "ssl", name: "Garanti", slug: "warranty", unit: "$", icon: "DollarSign", isHighlighted: true, displayOrder: 2, isActive: false },
    { categoryId: "email", name: "Posta Kutusu", slug: "mailbox-count", unit: "Adet", icon: "Mail", isHighlighted: true, displayOrder: 1, isActive: true },
    { categoryId: "email", name: "Kota", slug: "mailbox-quota", unit: "GB", icon: "HardDrive", isHighlighted: true, displayOrder: 2, isActive: true },
  ] as const;

  for (const feature of productFeatures) {
    await prisma.productFeature.upsert({
      where: {
        categoryId_slug: {
          categoryId: feature.categoryId,
          slug: feature.slug,
        },
      },
      update: {
        name: feature.name,
        unit: feature.unit,
        icon: feature.icon,
        isHighlighted: feature.isHighlighted,
        displayOrder: feature.displayOrder,
        isActive: feature.isActive,
      },
      create: {
        categoryId: feature.categoryId,
        name: feature.name,
        slug: feature.slug,
        unit: feature.unit,
        icon: feature.icon,
        isHighlighted: feature.isHighlighted,
        displayOrder: feature.displayOrder,
        isActive: feature.isActive,
      },
    });
  }

  console.log("Product features created");

  // =====================
  // PRODUCTS (legacy SSL, Domain, Email only — hosting/VDS/VPS come from seed-data)
  // =====================

  // --- SSL Products ---
  await prisma.product.create({
    data: {
      categoryId: catSsl.id,
      sku: "SSL-STD-01",
      name: "Standart SSL",
      slug: "standart-ssl",
      shortDescription: "Domain doğrulama (DV) SSL sertifikası",
      basePrice: 149,
      status: "ACTIVE",
      isVisible: true,
      displayOrder: 1,
      pricingTiers: {
        create: [
          { period: "yearly", price: 149, renewalPrice: 149, isDefault: true },
          { period: "biennial", price: 249, renewalPrice: 249 },
        ],
      },
    },
  });

  await prisma.product.create({
    data: {
      categoryId: catSsl.id,
      sku: "SSL-WC-01",
      name: "Wildcard SSL",
      slug: "wildcard-ssl",
      shortDescription: "Tüm alt alan adları için wildcard SSL",
      basePrice: 599,
      status: "ACTIVE",
      isVisible: true,
      displayOrder: 2,
      pricingTiers: {
        create: [
          { period: "yearly", price: 599, renewalPrice: 599, isDefault: true },
          { period: "biennial", price: 999, renewalPrice: 999 },
        ],
      },
    },
  });

  // --- Domain Products ---
  await prisma.product.create({
    data: {
      categoryId: catDomain.id,
      sku: "DOM-COM",
      name: ".com Domain",
      slug: "com-domain",
      shortDescription: ".com alan adı kaydı",
      basePrice: 179,
      status: "ACTIVE",
      isVisible: true,
      displayOrder: 1,
      pricingTiers: {
        create: [
          { period: "yearly", price: 179, renewalPrice: 199, isDefault: true },
          { period: "biennial", price: 349, renewalPrice: 389 },
        ],
      },
    },
  });

  await prisma.product.create({
    data: {
      categoryId: catDomain.id,
      sku: "DOM-TR",
      name: ".com.tr Domain",
      slug: "com-tr-domain",
      shortDescription: ".com.tr alan adı kaydı",
      basePrice: 49,
      status: "ACTIVE",
      isVisible: true,
      displayOrder: 2,
      pricingTiers: {
        create: [
          { period: "yearly", price: 49, renewalPrice: 69, isDefault: true },
        ],
      },
    },
  });

  // --- Email Products ---
  await prisma.product.create({
    data: {
      categoryId: catEmail.id,
      sku: "EML-BIZ-01",
      name: "Kurumsal E-posta",
      slug: "kurumsal-eposta",
      shortDescription: "5 GB depolama, özel domain e-posta",
      basePrice: 19.9,
      status: "ACTIVE",
      isVisible: true,
      displayOrder: 1,
      pricingTiers: {
        create: [
          { period: "monthly", price: 19.9, renewalPrice: 19.9, isDefault: true },
          { period: "yearly", price: 199, renewalPrice: 199 },
        ],
      },
    },
  });

  console.log("Products created (legacy)");

  // =====================
  // NEW SEED DATA (page-driven products)
  // =====================
  await seedHostingProducts(prisma, catHosting.id);
  console.log("Hosting products seeded (linux/wordpress/reseller/kurumsal)");

  await seedHostingAddons(prisma);
  console.log("Hosting addons seeded");

  await seedVdsProducts(prisma, catVds.id);
  await seedVpsProducts(prisma, catVps.id);
  await seedCloudProducts(prisma, catCloud.id);
  await seedServerProducts(prisma, catServer.id);
  console.log("Server products seeded (vds/vps/cloud/fiziksel)");

  await seedSslProducts(prisma, catSsl.id);
  console.log("SSL products seeded (standart/wildcard/ev/kurumsal)");

  await seedDatacenterProducts(prisma, catDatacenter.id);
  console.log("Datacenter products seeded (barindirma/cdn/ddos/ip-asn)");

  await seedDomainTlds(prisma);
  console.log("Domain TLDs seeded (27 TLDs)");

  const hostingPro = await prisma.product.findUniqueOrThrow({ where: { sku: "HST-LNX-02" } });

  await prisma.productConfigOption.createMany({
    data: [
      {
        productId: hostingPro.id,
        name: "PHP Sürümü",
        slug: "php-version",
        optionType: "select",
        choices: [
          { value: "8.1", label: "PHP 8.1", priceMonthly: 0, priceYearly: 0 },
          { value: "8.2", label: "PHP 8.2", priceMonthly: 0, priceYearly: 0 },
          { value: "8.3", label: "PHP 8.3", priceMonthly: 10, priceYearly: 100 },
        ],
        isRequired: true,
        displayOrder: 1,
      },
      {
        productId: hostingPro.id,
        name: "Ek E-posta Hesabı",
        slug: "extra-email",
        optionType: "quantity",
        choices: [],
        minValue: 0,
        maxValue: 20,
        unitPrice: 5,
        unitPriceYearly: 50,
        isRequired: false,
        displayOrder: 2,
      },
      {
        productId: hostingPro.id,
        name: "Yedekleme Sıklığı",
        slug: "backup-frequency",
        optionType: "select",
        choices: [
          { value: "weekly", label: "Haftalık", priceMonthly: 0, priceYearly: 0 },
          { value: "daily", label: "Günlük", priceMonthly: 15, priceYearly: 150 },
        ],
        isRequired: false,
        displayOrder: 3,
      },
    ],
    skipDuplicates: true,
  });
  console.log("Product config options seeded for HST-LNX-02");

  // =====================
  // SETTINGS (defaults — integrations disabled until configured in admin)
  // =====================
  await prisma.setting.createMany({
    data: [
      { group: "general", key: "site_name", value: "KLEACORE", type: "string", label: "Site Adı" },
      { group: "general", key: "site_url", value: "https://kleacore.com", type: "string", label: "Site URL" },
      { group: "general", key: "support_email", value: "destek@kleacore.com", type: "string", label: "Destek E-posta" },
      { group: "general", key: "phone", value: "+90 850 000 0000", type: "string", label: "Telefon" },
      { group: "billing", key: "tax_rate", value: "20", type: "number", label: "KDV Oranı (%)" },
      { group: "billing", key: "currency", value: "TRY", type: "string", label: "Para Birimi" },
      { group: "billing", key: "invoice_prefix", value: "F", type: "string", label: "Fatura Öneki" },
      { group: "billing", key: "suspend_grace_days", value: "3", type: "number", label: "Askıya Alma Toleransı (gün)" },
      { group: "notification", key: "email_notifications", value: "true", type: "boolean", label: "E-posta Bildirimleri" },
      { group: "notification", key: "sms_notifications", value: "false", type: "boolean", label: "SMS Bildirimleri" },
      { group: "integration", key: "sms_enabled", value: "false", type: "boolean", label: "SMS Entegrasyonu" },
      { group: "integration", key: "sms_provider", value: "disabled", type: "string", label: "SMS Sağlayıcı" },
      { group: "integration", key: "backup_enabled", value: "false", type: "boolean", label: "Yedekleme" },
      { group: "integration", key: "ssl_enabled", value: "false", type: "boolean", label: "SSL Sağlama" },
      { group: "integration", key: "ssl_provider", value: "disabled", type: "string", label: "SSL Sağlayıcı" },
      { group: "integration", key: "efatura_enabled", value: "false", type: "boolean", label: "E-Fatura" },
      { group: "integration", key: "efatura_provider", value: "disabled", type: "string", label: "E-Fatura Sağlayıcı" },
      { group: "integration", key: "payment_gateway_provider", value: "stripe", type: "string", label: "Ödeme Sağlayıcı" },
    ],
  });
  console.log("Settings created");

  console.log("Bootstrap seed completed — catalog + admin only, no demo transactions.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
