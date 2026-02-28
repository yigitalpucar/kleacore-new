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
  await prisma.payment.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
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
  const adminPassword = await hash("Admin123!", 12);
  const demoPassword = await hash("Demo123!", 12);

  const admin = await prisma.user.upsert({
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

  const customer1 = await prisma.user.upsert({
    where: { email: "demo@example.com" },
    update: {},
    create: {
      email: "demo@example.com",
      password: demoPassword,
      name: "Ahmet",
      surname: "Yılmaz",
      phone: "+90 532 123 4567",
      role: "CUSTOMER",
      status: "ACTIVE",
      customerType: "INDIVIDUAL",
      address: "Atatürk Cad. No:123",
      city: "İstanbul",
      balance: 250.0,
      affiliateCode: "ahmet123",
    },
  });

  const customer2 = await prisma.user.upsert({
    where: { email: "ayse@demirholding.com" },
    update: {},
    create: {
      email: "ayse@demirholding.com",
      password: demoPassword,
      name: "Ayşe",
      surname: "Demir",
      phone: "+90 533 456 7890",
      role: "CUSTOMER",
      status: "ACTIVE",
      customerType: "CORPORATE",
      companyName: "Demir Holding A.Ş.",
      taxNumber: "1234567890",
      taxOffice: "Büyük Mükellefler",
      address: "Levent İş Merkezi No:45",
      city: "İstanbul",
      balance: 1500.0,
    },
  });

  const customer3 = await prisma.user.upsert({
    where: { email: "mehmet@techstart.io" },
    update: {},
    create: {
      email: "mehmet@techstart.io",
      password: demoPassword,
      name: "Mehmet",
      surname: "Kaya",
      phone: "+90 535 789 0123",
      role: "CUSTOMER",
      status: "ACTIVE",
      customerType: "CORPORATE",
      companyName: "TechStart Yazılım Ltd.",
      taxNumber: "9876543210",
      taxOffice: "Kadıköy",
      address: "Teknoloji Cad. No:78",
      city: "İstanbul",
      balance: 800.0,
    },
  });

  const customer4 = await prisma.user.upsert({
    where: { email: "zeynep@gmail.com" },
    update: {},
    create: {
      email: "zeynep@gmail.com",
      password: demoPassword,
      name: "Zeynep",
      surname: "Aydın",
      phone: "+90 536 234 5678",
      role: "CUSTOMER",
      status: "SUSPENDED",
      customerType: "INDIVIDUAL",
      city: "Ankara",
      balance: 0,
    },
  });

  const customer5 = await prisma.user.upsert({
    where: { email: "ali@ozturk.net" },
    update: {},
    create: {
      email: "ali@ozturk.net",
      password: demoPassword,
      name: "Ali",
      surname: "Öztürk",
      phone: "+90 537 345 6789",
      role: "CUSTOMER",
      status: "ACTIVE",
      customerType: "INDIVIDUAL",
      city: "İzmir",
      balance: 120.0,
    },
  });

  console.log("Users created");

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

  // =====================
  // PRODUCT REFERENCES (for Orders/Services below)
  // =====================
  const hostingStarter = await prisma.product.findUniqueOrThrow({ where: { sku: "HST-LNX-01" } });
  const hostingPro = await prisma.product.findUniqueOrThrow({ where: { sku: "HST-LNX-02" } });
  const hostingBusiness = await prisma.product.findUniqueOrThrow({ where: { sku: "HST-LNX-03" } });
  const vds1 = await prisma.product.findUniqueOrThrow({ where: { sku: "VDS-01" } });
  const vds2 = await prisma.product.findUniqueOrThrow({ where: { sku: "VDS-02" } });
  const vds3 = await prisma.product.findUniqueOrThrow({ where: { sku: "VDS-03" } });

  // =====================
  // ORDERS
  // =====================
  const order1 = await prisma.order.create({
    data: {
      orderNumber: "S-2026-00001",
      customerId: customer1.id,
      productId: hostingPro.id,
      billingPeriod: "yearly",
      basePrice: 599,
      taxRate: 20,
      taxAmount: 119.8,
      totalAmount: 718.8,
      status: "COMPLETED",
      completedAt: new Date("2026-01-15"),
      items: {
        create: {
          productName: "Profesyonel Hosting",
          productSku: "HST-LNX-02",
          unitPrice: 599,
          totalPrice: 599,
        },
      },
    },
  });

  const order2 = await prisma.order.create({
    data: {
      orderNumber: "S-2026-00002",
      customerId: customer2.id,
      productId: vds2.id,
      billingPeriod: "monthly",
      basePrice: 279.9,
      taxRate: 20,
      taxAmount: 55.98,
      totalAmount: 335.88,
      status: "COMPLETED",
      completedAt: new Date("2026-01-20"),
      items: {
        create: {
          productName: "VDS-2",
          productSku: "VDS-02",
          unitPrice: 279.9,
          totalPrice: 279.9,
        },
      },
    },
  });

  await prisma.order.create({
    data: {
      orderNumber: "S-2026-00003",
      customerId: customer3.id,
      productId: vds3.id,
      billingPeriod: "yearly",
      basePrice: 4999,
      taxRate: 20,
      taxAmount: 999.8,
      totalAmount: 5998.8,
      status: "PENDING",
      customerNotes: "Lütfen hızlı kurulum yapın",
    },
  });

  await prisma.order.create({
    data: {
      orderNumber: "S-2026-00004",
      customerId: customer1.id,
      productId: hostingStarter.id,
      billingPeriod: "yearly",
      basePrice: 299,
      taxRate: 20,
      taxAmount: 59.8,
      totalAmount: 358.8,
      status: "APPROVED",
    },
  });

  await prisma.order.create({
    data: {
      orderNumber: "S-2026-00005",
      customerId: customer5.id,
      productId: vds1.id,
      billingPeriod: "monthly",
      basePrice: 149.9,
      taxRate: 20,
      taxAmount: 29.98,
      totalAmount: 179.88,
      status: "PROCESSING",
    },
  });

  console.log("Orders created");

  // =====================
  // SERVICES
  // =====================
  const service1 = await prisma.service.create({
    data: {
      customerId: customer1.id,
      productId: hostingPro.id,
      label: "Profesyonel Hosting",
      domain: "ahmetyilmaz.com",
      username: "ahmetylm",
      ipAddress: "185.123.45.67",
      diskUsed: 12.5,
      diskLimit: 50,
      bandwidthUsed: 85.2,
      bandwidthLimit: -1,
      billingPeriod: "yearly",
      amount: 599,
      nextDueDate: new Date("2027-01-15"),
      status: "ACTIVE",
    },
  });

  await prisma.service.create({
    data: {
      customerId: customer2.id,
      productId: vds2.id,
      label: "VDS-2",
      domain: "vds1.demirholding.com",
      ipAddress: "185.123.45.100",
      diskUsed: 35,
      diskLimit: 80,
      cpuUsage: 45,
      ramUsage: 62,
      billingPeriod: "monthly",
      amount: 279.9,
      nextDueDate: new Date("2026-03-20"),
      status: "ACTIVE",
    },
  });

  await prisma.service.create({
    data: {
      customerId: customer3.id,
      productId: hostingBusiness.id,
      label: "Kurumsal Hosting",
      domain: "techstart.io",
      username: "techstrt",
      ipAddress: "185.123.45.80",
      diskUsed: 28,
      diskLimit: 100,
      billingPeriod: "yearly",
      amount: 1199,
      nextDueDate: new Date("2027-02-10"),
      status: "ACTIVE",
    },
  });

  await prisma.service.create({
    data: {
      customerId: customer4.id,
      productId: hostingStarter.id,
      label: "Başlangıç Hosting",
      domain: "zeynepin-blogu.com",
      diskUsed: 3,
      diskLimit: 10,
      billingPeriod: "yearly",
      amount: 299,
      status: "SUSPENDED",
      suspendedAt: new Date("2026-02-15"),
      suspendReason: "Ödeme yapılmadı",
    },
  });

  await prisma.service.create({
    data: {
      customerId: customer5.id,
      productId: vds1.id,
      label: "VDS-1",
      ipAddress: "185.123.45.120",
      diskUsed: 15,
      diskLimit: 40,
      cpuUsage: 22,
      ramUsage: 40,
      billingPeriod: "monthly",
      amount: 149.9,
      nextDueDate: new Date("2026-03-25"),
      status: "ACTIVE",
    },
  });

  console.log("Services created");

  // =====================
  // DOMAINS
  // =====================
  const domain1 = await prisma.domain.create({
    data: {
      customerId: customer1.id,
      name: "ahmetyilmaz.com",
      expiresAt: new Date("2027-06-15"),
      autoRenew: true,
      privacyEnabled: true,
      status: "ACTIVE",
      nameservers: JSON.stringify(["ns1.kleacore.com", "ns2.kleacore.com"]),
      dnsRecords: {
        create: [
          { type: "A", name: "@", value: "185.123.45.67", ttl: 3600 },
          { type: "A", name: "www", value: "185.123.45.67", ttl: 3600 },
          { type: "MX", name: "@", value: "mail.ahmetyilmaz.com", ttl: 3600, priority: 10 },
          { type: "TXT", name: "@", value: "v=spf1 include:kleacore.com ~all", ttl: 3600 },
        ],
      },
    },
  });

  const domain2 = await prisma.domain.create({
    data: {
      customerId: customer2.id,
      name: "demirholding.com",
      expiresAt: new Date("2028-03-20"),
      autoRenew: true,
      status: "ACTIVE",
      nameservers: JSON.stringify(["ns1.kleacore.com", "ns2.kleacore.com"]),
      dnsRecords: {
        create: [
          { type: "A", name: "@", value: "185.123.45.100", ttl: 3600 },
          { type: "CNAME", name: "www", value: "demirholding.com", ttl: 3600 },
        ],
      },
    },
  });

  const domain3 = await prisma.domain.create({
    data: {
      customerId: customer3.id,
      name: "techstart.io",
      expiresAt: new Date("2027-02-10"),
      autoRenew: true,
      status: "ACTIVE",
      nameservers: JSON.stringify(["ns1.kleacore.com", "ns2.kleacore.com"]),
    },
  });

  console.log("Domains created");

  // =====================
  // EMAIL ACCOUNTS & EMAIL MESSAGES
  // =====================
  await prisma.emailAccount.createMany({
    data: [
      {
        customerId: customer1.id,
        domainId: domain1.id,
        localPart: "info",
        email: "info@ahmetyilmaz.com",
        passwordHash: demoPassword,
        quotaMb: 2048,
        usedMb: 640,
        status: "ACTIVE",
        lastLoginAt: new Date("2026-02-27T10:20:00"),
      },
      {
        customerId: customer1.id,
        domainId: domain1.id,
        localPart: "iletisim",
        email: "iletisim@ahmetyilmaz.com",
        passwordHash: demoPassword,
        quotaMb: 1024,
        usedMb: 180,
        status: "ACTIVE",
      },
      {
        customerId: customer2.id,
        domainId: domain2.id,
        localPart: "destek",
        email: "destek@demirholding.com",
        passwordHash: demoPassword,
        quotaMb: 5120,
        usedMb: 3012,
        status: "SUSPENDED",
      },
      {
        customerId: customer3.id,
        domainId: domain3.id,
        localPart: "hello",
        email: "hello@techstart.io",
        passwordHash: demoPassword,
        quotaMb: 2048,
        usedMb: 512,
        status: "ACTIVE",
        lastLoginAt: new Date("2026-02-26T16:40:00"),
      },
    ],
  });

  await prisma.emailMessage.createMany({
    data: [
      {
        customerId: customer1.id,
        subject: "Hosting hizmetiniz başarıyla aktif edildi",
        preview: "Profesyonel Hosting paketiniz kuruldu ve kullanıma hazır.",
        content:
          "Merhaba Ahmet, Profesyonel Hosting hizmetiniz başarıyla aktif edildi. Yönetim panelinden tüm detaylara ulaşabilirsiniz.",
        category: "SERVICE",
        isRead: true,
        readAt: new Date("2026-02-20T10:00:00"),
        sentAt: new Date("2026-02-20T09:45:00"),
      },
      {
        customerId: customer1.id,
        subject: "Fatura hatırlatması",
        preview: "F-2026-0001 numaralı faturanızın son ödeme tarihi yaklaşıyor.",
        content:
          "F-2026-0001 numaralı faturanızın son ödeme tarihi 5 gün sonra doluyor. Gecikme yaşamamak için ödeme yapmanızı öneririz.",
        category: "BILLING",
        isRead: false,
        sentAt: new Date("2026-02-25T12:30:00"),
      },
      {
        customerId: customer2.id,
        subject: "E-posta hesabınız askıya alındı",
        preview: "destek@demirholding.com hesabı geçici olarak askıya alındı.",
        content:
          "Şüpheli oturum hareketleri nedeniyle destek@demirholding.com hesabı güvenlik amacıyla askıya alınmıştır.",
        category: "SECURITY",
        isRead: false,
        sentAt: new Date("2026-02-26T08:15:00"),
      },
      {
        customerId: customer3.id,
        subject: "Yeni kampanya: 12 aylık yenilemede %15 indirim",
        preview: "Yıllık yenilemelerde geçerli indirim kodunuz hazır.",
        content:
          "Sayın müşterimiz, 12 aylık yenilemelerde geçerli %15 indirim fırsatından yararlanabilirsiniz. Kod: YENILE15",
        category: "PROMOTION",
        isRead: true,
        readAt: new Date("2026-02-24T11:10:00"),
        sentAt: new Date("2026-02-24T10:50:00"),
      },
    ],
  });

  console.log("Email accounts and messages created");

  // =====================
  // INVOICES
  // =====================
  await prisma.invoice.create({
    data: {
      invoiceNumber: "F-2026-0001",
      customerId: customer1.id,
      orderId: order1.id,
      subtotal: 599,
      taxRate: 20,
      taxAmount: 119.8,
      totalAmount: 718.8,
      paidAmount: 718.8,
      status: "PAID",
      dueDate: new Date("2026-01-30"),
      paidAt: new Date("2026-01-16"),
      items: {
        create: {
          description: "Profesyonel Hosting - 1 Yıllık",
          unitPrice: 599,
          totalPrice: 599,
        },
      },
    },
  });

  await prisma.invoice.create({
    data: {
      invoiceNumber: "F-2026-0002",
      customerId: customer2.id,
      orderId: order2.id,
      subtotal: 279.9,
      taxRate: 20,
      taxAmount: 55.98,
      totalAmount: 335.88,
      paidAmount: 335.88,
      status: "PAID",
      dueDate: new Date("2026-02-05"),
      paidAt: new Date("2026-01-21"),
      items: {
        create: {
          description: "VDS-2 - Aylık",
          unitPrice: 279.9,
          totalPrice: 279.9,
        },
      },
    },
  });

  await prisma.invoice.create({
    data: {
      invoiceNumber: "F-2026-0003",
      customerId: customer3.id,
      subtotal: 1199,
      taxRate: 20,
      taxAmount: 239.8,
      totalAmount: 1438.8,
      status: "PENDING",
      dueDate: new Date("2026-03-10"),
      items: {
        create: {
          description: "Kurumsal Hosting - 1 Yıllık",
          unitPrice: 1199,
          totalPrice: 1199,
        },
      },
    },
  });

  await prisma.invoice.create({
    data: {
      invoiceNumber: "F-2026-0004",
      customerId: customer4.id,
      subtotal: 299,
      taxRate: 20,
      taxAmount: 59.8,
      totalAmount: 358.8,
      status: "OVERDUE",
      dueDate: new Date("2026-02-01"),
      items: {
        create: {
          description: "Başlangıç Hosting - 1 Yıllık",
          unitPrice: 299,
          totalPrice: 299,
        },
      },
    },
  });

  console.log("Invoices created");

  // =====================
  // SUPPORT TICKETS
  // =====================
  const ticket1 = await prisma.supportTicket.create({
    data: {
      ticketNumber: "T-100001",
      customerId: customer1.id,
      subject: "SSL sertifikası yenilenmiyor",
      department: "TECHNICAL",
      priority: "HIGH",
      status: "OPEN",
      messages: {
        create: {
          senderId: customer1.id,
          senderName: "Ahmet Yılmaz",
          senderRole: "CUSTOMER",
          message:
            "Merhaba, SSL sertifikam süresi doldu fakat otomatik yenileme çalışmıyor. Yardımcı olabilir misiniz?",
        },
      },
    },
  });

  await prisma.ticketMessage.create({
    data: {
      ticketId: ticket1.id,
      senderId: admin.id,
      senderName: "Admin KLEACORE",
      senderRole: "ADMIN",
      message:
        "Merhaba Ahmet Bey, SSL sertifikanızı kontrol ediyorum. Kısa süre içinde geri dönüş yapacağım.",
    },
  });

  await prisma.supportTicket.create({
    data: {
      ticketNumber: "T-100002",
      customerId: customer2.id,
      subject: "VDS sunucu performans sorunu",
      department: "TECHNICAL",
      priority: "URGENT",
      status: "ADMIN_REPLY",
      messages: {
        create: {
          senderId: customer2.id,
          senderName: "Ayşe Demir",
          senderRole: "CUSTOMER",
          message: "Sunucumuz çok yavaşladı, CPU kullanımı %100'e çıkıyor.",
        },
      },
    },
  });

  await prisma.supportTicket.create({
    data: {
      ticketNumber: "T-100003",
      customerId: customer3.id,
      subject: "Fatura ile ilgili soru",
      department: "BILLING",
      priority: "MEDIUM",
      status: "CLOSED",
      closedAt: new Date("2026-02-25"),
      messages: {
        create: {
          senderId: customer3.id,
          senderName: "Mehmet Kaya",
          senderRole: "CUSTOMER",
          message: "Son faturamda KDV hesaplaması yanlış görünüyor.",
        },
      },
    },
  });

  console.log("Support tickets created");

  // =====================
  // SERVERS (Infrastructure)
  // =====================
  await prisma.server.createMany({
    data: [
      {
        name: "Web Server 1",
        hostname: "web01.kleacore.com",
        ipAddress: "185.123.45.1",
        location: "İstanbul, TR",
        cpuModel: "Intel Xeon E5-2680 v4",
        cpuCores: 28,
        ramTotal: 128,
        diskTotal: 2000,
        cpuUsage: 42,
        ramUsage: 65,
        diskUsage: 55,
        isOnline: true,
        uptime: 99.98,
      },
      {
        name: "Web Server 2",
        hostname: "web02.kleacore.com",
        ipAddress: "185.123.45.2",
        location: "İstanbul, TR",
        cpuModel: "Intel Xeon E5-2680 v4",
        cpuCores: 28,
        ramTotal: 128,
        diskTotal: 2000,
        cpuUsage: 38,
        ramUsage: 52,
        diskUsage: 48,
        isOnline: true,
        uptime: 99.95,
      },
      {
        name: "VDS Node 1",
        hostname: "vds01.kleacore.com",
        ipAddress: "185.123.45.10",
        location: "İstanbul, TR",
        cpuModel: "AMD EPYC 9554",
        cpuCores: 64,
        ramTotal: 256,
        diskTotal: 4000,
        cpuUsage: 55,
        ramUsage: 72,
        diskUsage: 62,
        isOnline: true,
        uptime: 99.99,
      },
      {
        name: "DNS Server",
        hostname: "ns1.kleacore.com",
        ipAddress: "185.123.45.20",
        location: "İstanbul, TR",
        cpuCores: 4,
        ramTotal: 8,
        diskTotal: 100,
        cpuUsage: 5,
        ramUsage: 15,
        diskUsage: 10,
        isOnline: true,
        uptime: 100,
      },
    ],
  });

  console.log("Servers created");

  // =====================
  // TRANSACTIONS
  // =====================
  await prisma.transaction.createMany({
    data: [
      {
        customerId: customer1.id,
        type: "DEPOSIT",
        amount: 500,
        balanceBefore: 0,
        balanceAfter: 500,
        description: "Bakiye yükleme",
      },
      {
        customerId: customer1.id,
        type: "PAYMENT",
        amount: -250,
        balanceBefore: 500,
        balanceAfter: 250,
        description: "Hosting ödemesi",
      },
      {
        customerId: customer2.id,
        type: "DEPOSIT",
        amount: 2000,
        balanceBefore: 0,
        balanceAfter: 2000,
        description: "Bakiye yükleme",
      },
      {
        customerId: customer2.id,
        type: "PAYMENT",
        amount: -500,
        balanceBefore: 2000,
        balanceAfter: 1500,
        description: "VDS ödemesi",
      },
    ],
  });

  console.log("Transactions created");

  // =====================
  // PROMOTION CODES
  // =====================
  await prisma.promotionCode.createMany({
    data: [
      {
        code: "HOSGELDIN",
        name: "Hoşgeldin İndirimi",
        description: "Yeni müşterilere %15 indirim",
        discountType: "PERCENTAGE",
        discountValue: 15,
        maxUses: 100,
        maxUsesPerCustomer: 1,
        validFrom: new Date("2026-01-01"),
        validUntil: new Date("2026-12-31"),
        isNewCustomerOnly: true,
        status: "ACTIVE",
      },
      {
        code: "YAZ2026",
        name: "Yaz Kampanyası",
        description: "Hosting ve VDS ürünlerinde %20 indirim",
        discountType: "PERCENTAGE",
        discountValue: 20,
        maxUses: 50,
        currentUses: 12,
        validFrom: new Date("2026-06-01"),
        validUntil: new Date("2026-08-31"),
        status: "ACTIVE",
      },
      {
        code: "SABIT50",
        name: "50 TL İndirim",
        description: "100 TL üzeri siparişlerde 50 TL indirim",
        discountType: "FIXED",
        discountValue: 50,
        maxUses: 200,
        currentUses: 45,
        validFrom: new Date("2026-01-01"),
        validUntil: new Date("2026-06-30"),
        minOrderAmount: 100,
        status: "ACTIVE",
      },
    ],
  });

  console.log("Promotion codes created");

  // =====================
  // BLOG
  // =====================
  const blogCat1 = await prisma.blogCategory.create({
    data: {
      name: "Hosting",
      slug: "hosting",
      description: "Web hosting ile ilgili yazılar",
    },
  });

  const blogCat2 = await prisma.blogCategory.create({
    data: {
      name: "Güvenlik",
      slug: "guvenlik",
      description: "Siber güvenlik ipuçları",
    },
  });

  const blogCat3 = await prisma.blogCategory.create({
    data: {
      name: "Teknoloji",
      slug: "teknoloji",
      description: "Teknoloji haberleri ve trendler",
    },
  });

  await prisma.blogPost.createMany({
    data: [
      {
        categoryId: blogCat1.id,
        title: "2026'da En İyi Hosting Seçimi Nasıl Yapılır?",
        slug: "2026-en-iyi-hosting-secimi",
        excerpt: "Hosting seçerken dikkat etmeniz gereken 10 önemli kriter.",
        content:
          "Web hosting seçimi, online varlığınızın temelini oluşturur. Bu yazıda, doğru hosting sağlayıcısını seçerken dikkat etmeniz gereken en önemli kriterleri ele alıyoruz...",
        author: "KLEACORE",
        tags: JSON.stringify(["hosting", "web", "performans"]),
        status: "PUBLISHED",
        viewCount: 1250,
        publishedAt: new Date("2026-01-10"),
      },
      {
        categoryId: blogCat2.id,
        title: "SSL Sertifikası Neden Önemli?",
        slug: "ssl-sertifikasi-neden-onemli",
        excerpt: "Web sitenizin güvenliği için SSL sertifikasının önemi.",
        content:
          "SSL sertifikası, web siteniz ile ziyaretçileriniz arasındaki veri iletişimini şifreler. Bu yazıda SSL'in neden vazgeçilmez olduğunu açıklıyoruz...",
        author: "KLEACORE",
        tags: JSON.stringify(["ssl", "güvenlik", "https"]),
        status: "PUBLISHED",
        viewCount: 890,
        publishedAt: new Date("2026-01-25"),
      },
      {
        categoryId: blogCat3.id,
        title: "VDS vs VPS: Hangisi Size Uygun?",
        slug: "vds-vs-vps-hangisi-uygun",
        excerpt: "VDS ve VPS arasındaki farkları ve hangisini seçmeniz gerektiğini açıklıyoruz.",
        content:
          "Sanal sunucu dünyasında VDS ve VPS kavramları sıkça karıştırılır. Bu yazıda her iki teknolojinin avantaj ve dezavantajlarını karşılaştırıyoruz...",
        author: "KLEACORE",
        tags: JSON.stringify(["vds", "vps", "sunucu"]),
        status: "PUBLISHED",
        viewCount: 2100,
        publishedAt: new Date("2026-02-05"),
      },
    ],
  });

  console.log("Blog posts created");

  // =====================
  // KNOWLEDGE BASE
  // =====================
  const kbCat1 = await prisma.knowledgeBaseCategory.create({
    data: {
      name: "Başlangıç Rehberi",
      slug: "baslangic-rehberi",
      description: "Yeni başlayanlar için rehber",
      icon: "BookOpen",
      displayOrder: 1,
    },
  });

  const kbCat2 = await prisma.knowledgeBaseCategory.create({
    data: {
      name: "cPanel Yönetimi",
      slug: "cpanel-yonetimi",
      description: "cPanel kullanım rehberi",
      icon: "Settings",
      displayOrder: 2,
    },
  });

  const kbCat3 = await prisma.knowledgeBaseCategory.create({
    data: {
      name: "DNS Yönetimi",
      slug: "dns-yonetimi",
      description: "DNS ayarları ve yönetimi",
      icon: "Globe",
      displayOrder: 3,
    },
  });

  await prisma.knowledgeBaseArticle.createMany({
    data: [
      {
        categoryId: kbCat1.id,
        title: "Hosting Hesabınızı Nasıl Kurarsınız?",
        slug: "hosting-hesabi-kurulumu",
        content: "Hosting hesabınızı kurduktan sonra yapmanız gereken ilk adımlar...",
        tags: JSON.stringify(["hosting", "başlangıç", "kurulum"]),
        status: "PUBLISHED",
        viewCount: 3400,
        helpfulCount: 120,
        displayOrder: 1,
        publishedAt: new Date("2026-01-01"),
      },
      {
        categoryId: kbCat2.id,
        title: "cPanel'de E-posta Hesabı Oluşturma",
        slug: "cpanel-eposta-olusturma",
        content: "cPanel üzerinden yeni e-posta hesabı oluşturma adımları...",
        tags: JSON.stringify(["cpanel", "e-posta", "rehber"]),
        status: "PUBLISHED",
        viewCount: 2200,
        helpfulCount: 85,
        displayOrder: 1,
        publishedAt: new Date("2026-01-05"),
      },
      {
        categoryId: kbCat3.id,
        title: "DNS Kayıtlarını Yönetme",
        slug: "dns-kayitlari-yonetme",
        content: "A, CNAME, MX, TXT ve diğer DNS kayıtlarını nasıl yönetirsiniz...",
        tags: JSON.stringify(["dns", "domain", "kayıt"]),
        status: "PUBLISHED",
        viewCount: 1800,
        helpfulCount: 65,
        displayOrder: 1,
        publishedAt: new Date("2026-01-10"),
      },
    ],
  });

  console.log("Knowledge base created");

  // =====================
  // SYSTEM STATUS
  // =====================
  await prisma.systemStatus.createMany({
    data: [
      { serviceName: "Web Hosting", status: "OPERATIONAL", description: "Tüm hosting sunucuları sorunsuz çalışıyor" },
      { serviceName: "VDS Sunucular", status: "OPERATIONAL", description: "VDS altyapısı aktif" },
      { serviceName: "VPS Sunucular", status: "OPERATIONAL", description: "VPS hizmeti aktif" },
      { serviceName: "DNS Hizmeti", status: "OPERATIONAL", description: "DNS sunucuları aktif" },
      { serviceName: "SSL Hizmeti", status: "OPERATIONAL", description: "SSL hizmeti aktif" },
      { serviceName: "E-posta Hizmeti", status: "DEGRADED", description: "E-posta teslim hızında geçici yavaşlama" },
      { serviceName: "cPanel", status: "OPERATIONAL", description: "cPanel erişimi aktif" },
      { serviceName: "Müşteri Paneli", status: "OPERATIONAL", description: "Müşteri paneli erişilebilir" },
    ],
  });

  console.log("System statuses created");

  // =====================
  // SETTINGS
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
      { group: "notification", key: "email_notifications", value: "true", type: "boolean", label: "E-posta Bildirimleri" },
      { group: "notification", key: "sms_notifications", value: "false", type: "boolean", label: "SMS Bildirimleri" },
    ],
  });

  console.log("Settings created");

  // =====================
  // NOTIFICATIONS
  // =====================
  await prisma.notification.createMany({
    data: [
      {
        userId: customer1.id,
        type: "INFO",
        title: "Hoş geldiniz!",
        message: "KLEACORE'a hoş geldiniz. Hesabınız başarıyla oluşturuldu.",
        isRead: true,
        readAt: new Date("2026-01-01"),
      },
      {
        userId: customer1.id,
        type: "SUCCESS",
        title: "Hosting hizmetiniz aktif",
        message: "Profesyonel Hosting paketiniz başarıyla kuruldu.",
        isRead: true,
      },
      {
        userId: customer1.id,
        type: "WARNING",
        title: "Fatura hatırlatması",
        message: "F-2026-0001 numaralı faturanızın son ödeme tarihi yaklaşıyor.",
        isRead: false,
        link: "/musteri/panel/faturalar",
      },
      {
        userId: customer2.id,
        type: "INFO",
        title: "Sunucu bakımı planlandı",
        message: "VDS sunucunuzda planlı bakım 2 Mart 2026 tarihinde yapılacaktır.",
        isRead: false,
      },
    ],
  });

  console.log("Notifications created");

  // =====================
  // BACKUPS
  // =====================
  const schedule1 = await prisma.backupSchedule.create({
    data: {
      serviceId: service1.id,
      frequency: "daily",
      retention: 7,
      isActive: true,
      lastRunAt: new Date("2026-02-27"),
      nextRunAt: new Date("2026-02-28"),
    },
  });

  await prisma.backup.createMany({
    data: [
      {
        serviceId: service1.id,
        customerId: customer1.id,
        type: "FULL",
        status: "COMPLETED",
        size: 2.5,
        scheduleId: schedule1.id,
        startedAt: new Date("2026-02-27T02:00:00"),
        completedAt: new Date("2026-02-27T02:15:00"),
      },
      {
        serviceId: service1.id,
        customerId: customer1.id,
        type: "INCREMENTAL",
        status: "COMPLETED",
        size: 0.3,
        scheduleId: schedule1.id,
        startedAt: new Date("2026-02-26T02:00:00"),
        completedAt: new Date("2026-02-26T02:05:00"),
      },
    ],
  });

  console.log("Backups created");

  // =====================
  // SSL CERTIFICATES
  // =====================
  await prisma.sslCertificate.createMany({
    data: [
      {
        customerId: customer1.id,
        domain: "ahmetyilmaz.com",
        type: "DV",
        status: "ACTIVE",
        issuedAt: new Date("2026-01-15"),
        expiresAt: new Date("2027-01-15"),
        autoRenew: true,
      },
      {
        customerId: customer2.id,
        domain: "demirholding.com",
        type: "OV",
        status: "ACTIVE",
        issuedAt: new Date("2026-01-20"),
        expiresAt: new Date("2027-01-20"),
        autoRenew: true,
      },
      {
        customerId: customer3.id,
        domain: "techstart.io",
        type: "EV",
        status: "ACTIVE",
        issuedAt: new Date("2026-02-10"),
        expiresAt: new Date("2027-02-10"),
        autoRenew: true,
      },
    ],
  });

  console.log("SSL certificates created");

  // =====================
  // ACTIVITY LOGS
  // =====================
  await prisma.activityLog.createMany({
    data: [
      {
        userId: admin.id,
        action: "LOGIN",
        entity: "Session",
        details: JSON.stringify({ browser: "Chrome 121", os: "macOS" }),
        ipAddress: "82.25.42.68",
        createdAt: new Date("2026-02-28T08:00:00"),
      },
      {
        userId: admin.id,
        action: "UPDATE_SETTINGS",
        entity: "Setting",
        entityId: "site_name",
        details: JSON.stringify({ field: "site_name", oldValue: "KLEACORE Beta", newValue: "KLEACORE" }),
        ipAddress: "82.25.42.68",
        createdAt: new Date("2026-02-27T14:30:00"),
      },
      {
        userId: admin.id,
        action: "APPROVE_ORDER",
        entity: "Order",
        entityId: order1.id,
        details: JSON.stringify({ orderNumber: "S-2026-00001" }),
        ipAddress: "82.25.42.68",
        createdAt: new Date("2026-01-15T10:00:00"),
      },
      {
        userId: customer1.id,
        action: "LOGIN",
        entity: "Session",
        details: JSON.stringify({ browser: "Firefox 124", os: "Windows 11" }),
        ipAddress: "88.234.12.55",
        createdAt: new Date("2026-02-27T10:20:00"),
      },
      {
        userId: customer1.id,
        action: "CREATE_ORDER",
        entity: "Order",
        entityId: order1.id,
        details: JSON.stringify({ orderNumber: "S-2026-00001", product: "Profesyonel Hosting" }),
        ipAddress: "88.234.12.55",
        createdAt: new Date("2026-01-14T16:45:00"),
      },
      {
        userId: customer1.id,
        action: "UPDATE_PROFILE",
        entity: "User",
        entityId: customer1.id,
        details: JSON.stringify({ fields: ["phone", "address"] }),
        ipAddress: "88.234.12.55",
        createdAt: new Date("2026-02-20T11:30:00"),
      },
      {
        userId: customer2.id,
        action: "LOGIN",
        entity: "Session",
        details: JSON.stringify({ browser: "Safari 18", os: "macOS" }),
        ipAddress: "176.42.88.10",
        createdAt: new Date("2026-02-26T09:15:00"),
      },
      {
        userId: customer2.id,
        action: "CREATE_TICKET",
        entity: "SupportTicket",
        details: JSON.stringify({ ticketNumber: "T-100002", subject: "VDS sunucu performans sorunu" }),
        ipAddress: "176.42.88.10",
        createdAt: new Date("2026-02-26T09:20:00"),
      },
      {
        userId: customer3.id,
        action: "LOGIN",
        entity: "Session",
        details: JSON.stringify({ browser: "Chrome 121", os: "Linux" }),
        ipAddress: "31.145.77.200",
        createdAt: new Date("2026-02-25T14:00:00"),
      },
      {
        userId: customer3.id,
        action: "CREATE_ORDER",
        entity: "Order",
        details: JSON.stringify({ orderNumber: "S-2026-00003", product: "VDS-3" }),
        ipAddress: "31.145.77.200",
        createdAt: new Date("2026-02-25T14:10:00"),
      },
      {
        userId: admin.id,
        action: "SUSPEND_SERVICE",
        entity: "Service",
        details: JSON.stringify({ customer: "Zeynep Aydın", reason: "Ödeme yapılmadı" }),
        ipAddress: "82.25.42.68",
        createdAt: new Date("2026-02-15T09:00:00"),
      },
      {
        userId: customer4.id,
        action: "LOGIN_FAILED",
        entity: "Session",
        details: JSON.stringify({ reason: "Invalid password", attempts: 3 }),
        ipAddress: "95.70.123.45",
        createdAt: new Date("2026-02-14T18:30:00"),
      },
    ],
  });

  console.log("Activity logs created");

  // =====================
  // API KEYS
  // =====================
  await prisma.apiKey.createMany({
    data: [
      {
        userId: admin.id,
        name: "Admin Dashboard API",
        key: "kc_live_admin_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
        isActive: true,
        lastUsedAt: new Date("2026-02-28T07:55:00"),
        expiresAt: new Date("2027-02-28"),
      },
      {
        userId: admin.id,
        name: "Monitoring Service",
        key: "kc_live_mon_q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2",
        isActive: true,
        lastUsedAt: new Date("2026-02-28T08:00:00"),
        expiresAt: new Date("2027-06-30"),
      },
      {
        userId: customer2.id,
        name: "Demir Holding API Integration",
        key: "kc_live_cust_g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7v8",
        isActive: true,
        lastUsedAt: new Date("2026-02-27T16:40:00"),
        expiresAt: new Date("2026-12-31"),
      },
      {
        userId: customer3.id,
        name: "TechStart CI/CD Pipeline",
        key: "kc_live_cust_w9x0y1z2a3b4c5d6e7f8g9h0i1j2k3l4",
        isActive: true,
        lastUsedAt: new Date("2026-02-26T22:10:00"),
      },
      {
        userId: customer1.id,
        name: "Test Key (expired)",
        key: "kc_test_exp_m5n6o7p8q9r0s1t2u3v4w5x6y7z8a9b0",
        isActive: false,
        expiresAt: new Date("2026-01-01"),
      },
    ],
  });

  console.log("API keys created");

  // =====================
  // AFFILIATE REFERRALS
  // =====================
  const referral1 = await prisma.affiliateReferral.create({
    data: {
      affiliateId: customer1.id,
      referredId: customer5.id,
      commission: 29.9,
      isPaid: true,
      createdAt: new Date("2026-01-20"),
    },
  });

  const referral2 = await prisma.affiliateReferral.create({
    data: {
      affiliateId: customer1.id,
      referredId: customer3.id,
      commission: 49.9,
      isPaid: true,
      createdAt: new Date("2026-01-25"),
    },
  });

  const referral3 = await prisma.affiliateReferral.create({
    data: {
      affiliateId: customer1.id,
      referredId: customer4.id,
      commission: 14.95,
      isPaid: false,
      createdAt: new Date("2026-02-10"),
    },
  });

  console.log("Affiliate referrals created");

  // =====================
  // AFFILIATE PAYMENTS
  // =====================
  await prisma.affiliatePayment.createMany({
    data: [
      {
        affiliateId: customer1.id,
        amount: 79.8,
        status: "PAID",
        paidAt: new Date("2026-02-01"),
        createdAt: new Date("2026-01-28"),
      },
      {
        affiliateId: customer1.id,
        amount: 14.95,
        status: "PENDING",
        createdAt: new Date("2026-02-20"),
      },
      {
        affiliateId: customer2.id,
        amount: 0,
        status: "CANCELLED",
        createdAt: new Date("2026-02-15"),
      },
    ],
  });

  console.log("Affiliate payments created");

  // =====================
  // SYSTEM INCIDENTS
  // =====================
  await prisma.systemIncident.createMany({
    data: [
      {
        title: "E-posta teslim gecikmesi",
        description: "E-posta sunucularında kuyruk birikmesi nedeniyle teslimlerde gecikme yaşanmaktadır.",
        severity: "MINOR",
        status: "RESOLVED",
        serviceName: "E-posta Hizmeti",
        startedAt: new Date("2026-02-20T14:00:00"),
        resolvedAt: new Date("2026-02-20T16:30:00"),
        updates: JSON.stringify([
          { time: "2026-02-20T14:00:00", message: "E-posta teslimlerinde gecikme tespit edildi." },
          { time: "2026-02-20T14:30:00", message: "Sorun mail kuyruğundaki birikmeden kaynaklanıyor, müdahale ediliyor." },
          { time: "2026-02-20T16:30:00", message: "Kuyruk temizlendi, teslimler normale döndü." },
        ]),
      },
      {
        title: "VDS Node 1 yüksek CPU kullanımı",
        description: "VDS Node 1 sunucusunda anormal CPU yükü tespit edildi.",
        severity: "MAJOR",
        status: "RESOLVED",
        serviceName: "VDS Sunucular",
        startedAt: new Date("2026-02-15T10:00:00"),
        resolvedAt: new Date("2026-02-15T12:45:00"),
        updates: JSON.stringify([
          { time: "2026-02-15T10:00:00", message: "VDS Node 1 CPU kullanımı %95 üzerine çıktı." },
          { time: "2026-02-15T10:20:00", message: "Sorun bir müşterinin runaway process'inden kaynaklanıyor." },
          { time: "2026-02-15T11:00:00", message: "İlgili process sonlandırıldı, kaynak limitleri güncellendi." },
          { time: "2026-02-15T12:45:00", message: "CPU kullanımı normale döndü, izleme devam ediyor." },
        ]),
      },
      {
        title: "DNS çözümleme gecikmesi",
        description: "DNS sunucularında aralıklı çözümleme gecikmeleri yaşanmaktadır.",
        severity: "MINOR",
        status: "MONITORING",
        serviceName: "DNS Hizmeti",
        startedAt: new Date("2026-02-27T22:00:00"),
        updates: JSON.stringify([
          { time: "2026-02-27T22:00:00", message: "DNS sorgularında aralıklı yavaşlık raporlandı." },
          { time: "2026-02-27T22:30:00", message: "Upstream DNS provider kaynaklı olduğu belirlendi, izleniyor." },
        ]),
      },
      {
        title: "Web hosting disk I/O yavaşlaması",
        description: "Web hosting sunucularında disk I/O performansında düşüş gözlemlenmektedir.",
        severity: "CRITICAL",
        status: "INVESTIGATING",
        serviceName: "Web Hosting",
        startedAt: new Date("2026-02-28T06:00:00"),
        updates: JSON.stringify([
          { time: "2026-02-28T06:00:00", message: "web01 ve web02 sunucularında disk I/O latency artışı tespit edildi." },
          { time: "2026-02-28T06:15:00", message: "Ekip sorunun kaynağını araştırıyor." },
        ]),
      },
    ],
  });

  console.log("System incidents created");

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
