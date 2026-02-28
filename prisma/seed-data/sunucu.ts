import type { PrismaClient } from "@prisma/client";

export async function seedVdsProducts(db: PrismaClient, categoryId: string) {
  const products = [
    {
      sku: "VDS-01", name: "VDS-1", slug: "vds-1", shortDescription: "Giriş seviye VDS",
      longDescription: "Intel Platinum 8160 işlemci, NVMe depolama ve 50 Gbps port ile yüksek performanslı VDS çözümleri.",
      resourceLimits: { cpu: "1 vCPU", ram: "2 GB", disk: "30 GB", traffic: "Paylaşımlı Trafik", port: "50 Gbps Port" },
      includedFeatures: ["NVMe Storage", "50 Gbps Port", "Platinum 8160", "%99.9 Uptime", "Ücretsiz Kurulum", "7/24 Destek"],
      features: [
        { label: "İşlemci", value: "1 vCPU", icon: "Cpu" },
        { label: "RAM", value: "2 GB DDR4", icon: "MemoryStick" },
        { label: "Disk", value: "30 GB NVMe", icon: "HardDrive", highlight: true },
        { label: "Trafik", value: "Paylaşımlı", icon: "Zap" },
        { label: "Port", value: "50 Gbps", icon: "Globe" },
      ],
      faq: [], basePrice: 99.99, isPopular: false, displayOrder: 1,
      pricingTiers: [
        { period: "monthly" as const, price: 99.99, discountedPrice: 99.99, renewalPrice: 119.98, isDefault: true },
        { period: "yearly" as const, price: 83.99, discountedPrice: 83.99, renewalPrice: 99.99 },
      ],
    },
    {
      sku: "VDS-02", name: "VDS-2", slug: "vds-2", shortDescription: "Standart VDS",
      longDescription: "Intel Platinum 8160 işlemci, NVMe depolama ve 50 Gbps port ile yüksek performanslı VDS çözümleri.",
      resourceLimits: { cpu: "2 vCPU", ram: "4 GB", disk: "50 GB", traffic: "Paylaşımlı Trafik", port: "50 Gbps Port" },
      includedFeatures: ["NVMe Storage", "50 Gbps Port", "Platinum 8160", "%99.9 Uptime", "Ücretsiz Kurulum", "7/24 Destek"],
      features: [
        { label: "İşlemci", value: "2 vCPU", icon: "Cpu" },
        { label: "RAM", value: "4 GB DDR4", icon: "MemoryStick" },
        { label: "Disk", value: "50 GB NVMe", icon: "HardDrive", highlight: true },
        { label: "Trafik", value: "Paylaşımlı", icon: "Zap" },
        { label: "Port", value: "50 Gbps", icon: "Globe" },
      ],
      faq: [], basePrice: 139.99, isPopular: true, displayOrder: 2,
      pricingTiers: [
        { period: "monthly" as const, price: 139.99, discountedPrice: 139.99, renewalPrice: 167.98, isDefault: true },
        { period: "yearly" as const, price: 117.59, discountedPrice: 117.59, renewalPrice: 139.99 },
      ],
    },
    {
      sku: "VDS-03", name: "VDS-3", slug: "vds-3", shortDescription: "Profesyonel VDS",
      longDescription: "Intel Platinum 8160 işlemci, NVMe depolama ve 50 Gbps port ile yüksek performanslı VDS çözümleri.",
      resourceLimits: { cpu: "3 vCPU", ram: "6 GB", disk: "60 GB", traffic: "Paylaşımlı Trafik", port: "50 Gbps Port" },
      includedFeatures: ["NVMe Storage", "50 Gbps Port", "Platinum 8160", "%99.9 Uptime", "Ücretsiz Kurulum", "7/24 Destek"],
      features: [
        { label: "İşlemci", value: "3 vCPU", icon: "Cpu" },
        { label: "RAM", value: "6 GB DDR4", icon: "MemoryStick" },
        { label: "Disk", value: "60 GB NVMe", icon: "HardDrive", highlight: true },
        { label: "Trafik", value: "Paylaşımlı", icon: "Zap" },
        { label: "Port", value: "50 Gbps", icon: "Globe" },
      ],
      faq: [], basePrice: 179.99, isPopular: false, displayOrder: 3,
      pricingTiers: [
        { period: "monthly" as const, price: 179.99, discountedPrice: 179.99, renewalPrice: 215.98, isDefault: true },
        { period: "yearly" as const, price: 151.19, discountedPrice: 151.19, renewalPrice: 179.99 },
      ],
    },
    {
      sku: "VDS-04", name: "VDS-4", slug: "vds-4", shortDescription: "İşletme VDS",
      longDescription: "Intel Platinum 8160 işlemci, NVMe depolama ve 50 Gbps port ile yüksek performanslı VDS çözümleri.",
      resourceLimits: { cpu: "4 vCPU", ram: "8 GB", disk: "80 GB", traffic: "Paylaşımlı Trafik", port: "50 Gbps Port" },
      includedFeatures: ["NVMe Storage", "50 Gbps Port", "Platinum 8160", "%99.9 Uptime", "Ücretsiz Kurulum", "7/24 Destek"],
      features: [
        { label: "İşlemci", value: "4 vCPU", icon: "Cpu" },
        { label: "RAM", value: "8 GB DDR4", icon: "MemoryStick" },
        { label: "Disk", value: "80 GB NVMe", icon: "HardDrive", highlight: true },
        { label: "Trafik", value: "Paylaşımlı", icon: "Zap" },
        { label: "Port", value: "50 Gbps", icon: "Globe" },
      ],
      faq: [], basePrice: 219.99, isPopular: false, displayOrder: 4,
      pricingTiers: [
        { period: "monthly" as const, price: 219.99, discountedPrice: 219.99, renewalPrice: 263.98, isDefault: true },
        { period: "yearly" as const, price: 184.79, discountedPrice: 184.79, renewalPrice: 219.99 },
      ],
    },
    {
      sku: "VDS-05", name: "VDS-5", slug: "vds-5", shortDescription: "Kurumsal VDS",
      longDescription: "Intel Platinum 8160 işlemci, NVMe depolama ve 50 Gbps port ile yüksek performanslı VDS çözümleri.",
      resourceLimits: { cpu: "5 vCPU", ram: "10 GB", disk: "100 GB", traffic: "Paylaşımlı Trafik", port: "50 Gbps Port" },
      includedFeatures: ["NVMe Storage", "50 Gbps Port", "Platinum 8160", "%99.9 Uptime", "Ücretsiz Kurulum", "7/24 Destek"],
      features: [
        { label: "İşlemci", value: "5 vCPU", icon: "Cpu" },
        { label: "RAM", value: "10 GB DDR4", icon: "MemoryStick" },
        { label: "Disk", value: "100 GB NVMe", icon: "HardDrive", highlight: true },
        { label: "Trafik", value: "Paylaşımlı", icon: "Zap" },
        { label: "Port", value: "50 Gbps", icon: "Globe" },
      ],
      faq: [], basePrice: 289.99, isPopular: false, displayOrder: 5,
      pricingTiers: [
        { period: "monthly" as const, price: 289.99, discountedPrice: 289.99, renewalPrice: 347.98, isDefault: true },
        { period: "yearly" as const, price: 243.59, discountedPrice: 243.59, renewalPrice: 289.99 },
      ],
    },
  ];

  for (const product of products) {
    const { pricingTiers, ...productData } = product;
    await db.product.create({
      data: { ...productData, categoryId, status: "ACTIVE", isVisible: true,
        pricingTiers: { create: pricingTiers.map((t) => ({ ...t, isActive: true })) },
      },
    });
  }
}

export async function seedVpsProducts(db: PrismaClient, categoryId: string) {
  const products = [
    {
      sku: "VPS-01", name: "VPS-1", slug: "vps-1", shortDescription: "Giriş seviye VPS",
      longDescription: "Intel Xeon işlemci, SSD depolama ve 1 Gbps port ile güvenilir VPS çözümleri.",
      resourceLimits: { cpu: "1 vCPU", ram: "2 GB", disk: "40 GB", traffic: "1 TB Trafik", port: "1 Gbps Port" },
      includedFeatures: ["SSD Storage", "1 Gbps Port", "Intel Xeon", "%99.9 Uptime", "Ücretsiz Kurulum", "1 IPv4 Dahil", "7/24 Destek"],
      features: [
        { label: "İşlemci", value: "1 vCPU", icon: "Cpu" },
        { label: "RAM", value: "2 GB DDR4", icon: "MemoryStick" },
        { label: "Disk", value: "40 GB SSD", icon: "HardDrive", highlight: true },
        { label: "Trafik", value: "1 TB", icon: "Zap" },
        { label: "Port", value: "1 Gbps", icon: "Globe" },
      ],
      faq: [], basePrice: 99, isPopular: false, displayOrder: 1,
      pricingTiers: [
        { period: "monthly" as const, price: 99, discountedPrice: 99, renewalPrice: 119, isDefault: true },
        { period: "yearly" as const, price: 83.25, discountedPrice: 83.25, renewalPrice: 99 },
      ],
    },
    {
      sku: "VPS-02", name: "VPS-2", slug: "vps-2", shortDescription: "Standart VPS",
      longDescription: "Intel Xeon işlemci, SSD depolama ve 1 Gbps port ile güvenilir VPS çözümleri.",
      resourceLimits: { cpu: "2 vCPU", ram: "4 GB", disk: "80 GB", traffic: "2 TB Trafik", port: "1 Gbps Port" },
      includedFeatures: ["SSD Storage", "1 Gbps Port", "Intel Xeon", "%99.9 Uptime", "Ücretsiz Kurulum", "1 IPv4 Dahil", "7/24 Destek"],
      features: [
        { label: "İşlemci", value: "2 vCPU", icon: "Cpu" },
        { label: "RAM", value: "4 GB DDR4", icon: "MemoryStick" },
        { label: "Disk", value: "80 GB SSD", icon: "HardDrive", highlight: true },
        { label: "Trafik", value: "2 TB", icon: "Zap" },
        { label: "Port", value: "1 Gbps", icon: "Globe" },
      ],
      faq: [], basePrice: 199, isPopular: true, displayOrder: 2,
      pricingTiers: [
        { period: "monthly" as const, price: 199, discountedPrice: 199, renewalPrice: 239, isDefault: true },
        { period: "yearly" as const, price: 167.25, discountedPrice: 167.25, renewalPrice: 199 },
      ],
    },
    {
      sku: "VPS-03", name: "VPS-3", slug: "vps-3", shortDescription: "Profesyonel VPS",
      longDescription: "Intel Xeon işlemci, SSD depolama ve 1 Gbps port ile güvenilir VPS çözümleri.",
      resourceLimits: { cpu: "4 vCPU", ram: "8 GB", disk: "160 GB", traffic: "4 TB Trafik", port: "1 Gbps Port" },
      includedFeatures: ["SSD Storage", "1 Gbps Port", "Intel Xeon", "%99.9 Uptime", "Ücretsiz Kurulum", "1 IPv4 Dahil", "7/24 Destek"],
      features: [
        { label: "İşlemci", value: "4 vCPU", icon: "Cpu" },
        { label: "RAM", value: "8 GB DDR4", icon: "MemoryStick" },
        { label: "Disk", value: "160 GB SSD", icon: "HardDrive", highlight: true },
        { label: "Trafik", value: "4 TB", icon: "Zap" },
        { label: "Port", value: "1 Gbps", icon: "Globe" },
      ],
      faq: [], basePrice: 399, isPopular: false, displayOrder: 3,
      pricingTiers: [
        { period: "monthly" as const, price: 399, discountedPrice: 399, renewalPrice: 479, isDefault: true },
        { period: "yearly" as const, price: 335.25, discountedPrice: 335.25, renewalPrice: 399 },
      ],
    },
    {
      sku: "VPS-04", name: "VPS-4", slug: "vps-4", shortDescription: "Kurumsal VPS",
      longDescription: "Intel Xeon işlemci, SSD depolama ve 1 Gbps port ile güvenilir VPS çözümleri.",
      resourceLimits: { cpu: "6 vCPU", ram: "16 GB", disk: "320 GB", traffic: "8 TB Trafik", port: "1 Gbps Port" },
      includedFeatures: ["SSD Storage", "1 Gbps Port", "Intel Xeon", "%99.9 Uptime", "Ücretsiz Kurulum", "1 IPv4 Dahil", "7/24 Destek"],
      features: [
        { label: "İşlemci", value: "6 vCPU", icon: "Cpu" },
        { label: "RAM", value: "16 GB DDR4", icon: "MemoryStick" },
        { label: "Disk", value: "320 GB SSD", icon: "HardDrive", highlight: true },
        { label: "Trafik", value: "8 TB", icon: "Zap" },
        { label: "Port", value: "1 Gbps", icon: "Globe" },
      ],
      faq: [], basePrice: 749, isPopular: false, displayOrder: 4,
      pricingTiers: [
        { period: "monthly" as const, price: 749, discountedPrice: 749, renewalPrice: 899, isDefault: true },
        { period: "yearly" as const, price: 629.25, discountedPrice: 629.25, renewalPrice: 749 },
      ],
    },
  ];

  for (const product of products) {
    const { pricingTiers, ...productData } = product;
    await db.product.create({
      data: { ...productData, categoryId, status: "ACTIVE", isVisible: true,
        pricingTiers: { create: pricingTiers.map((t) => ({ ...t, isActive: true })) },
      },
    });
  }
}

export async function seedCloudProducts(db: PrismaClient, categoryId: string) {
  const products = [
    {
      sku: "CLD-S", name: "Cloud-S", slug: "cloud-s", shortDescription: "Giriş seviye bulut sunucu",
      longDescription: "AMD EPYC işlemci, NVMe depolama, DDR5 RAM ve 10 Gbps port ile yüksek performanslı bulut sunucu çözümleri.",
      resourceLimits: { cpu: "2 vCPU", ram: "4 GB", disk: "80 GB", traffic: "Sınırsız Trafik", port: "10 Gbps Port" },
      includedFeatures: ["NVMe Storage", "DDR5 RAM", "10 Gbps Port", "AMD EPYC", "%99.99 Uptime", "Ücretsiz Kurulum", "7/24 Destek"],
      features: [
        { label: "İşlemci", value: "2 vCPU", icon: "Cpu" },
        { label: "RAM", value: "4 GB DDR5", icon: "MemoryStick" },
        { label: "Disk", value: "80 GB NVMe", icon: "HardDrive", highlight: true },
        { label: "Trafik", value: "Sınırsız", icon: "Zap" },
        { label: "Port", value: "10 Gbps", icon: "Globe" },
      ],
      faq: [], basePrice: 299, isPopular: false, displayOrder: 1,
      pricingTiers: [
        { period: "monthly" as const, price: 299, discountedPrice: 299, renewalPrice: 359, isDefault: true },
        { period: "yearly" as const, price: 250.92, discountedPrice: 250.92, renewalPrice: 299 },
      ],
    },
    {
      sku: "CLD-M", name: "Cloud-M", slug: "cloud-m", shortDescription: "Standart bulut sunucu",
      longDescription: "AMD EPYC işlemci, NVMe depolama, DDR5 RAM ve 10 Gbps port ile yüksek performanslı bulut sunucu çözümleri.",
      resourceLimits: { cpu: "4 vCPU", ram: "8 GB", disk: "160 GB", traffic: "Sınırsız Trafik", port: "10 Gbps Port" },
      includedFeatures: ["NVMe Storage", "DDR5 RAM", "10 Gbps Port", "AMD EPYC", "%99.99 Uptime", "Ücretsiz Kurulum", "7/24 Destek"],
      features: [
        { label: "İşlemci", value: "4 vCPU", icon: "Cpu" },
        { label: "RAM", value: "8 GB DDR5", icon: "MemoryStick" },
        { label: "Disk", value: "160 GB NVMe", icon: "HardDrive", highlight: true },
        { label: "Trafik", value: "Sınırsız", icon: "Zap" },
        { label: "Port", value: "10 Gbps", icon: "Globe" },
      ],
      faq: [], basePrice: 549, isPopular: true, displayOrder: 2,
      pricingTiers: [
        { period: "monthly" as const, price: 549, discountedPrice: 549, renewalPrice: 659, isDefault: true },
        { period: "yearly" as const, price: 461.17, discountedPrice: 461.17, renewalPrice: 549 },
      ],
    },
    {
      sku: "CLD-L", name: "Cloud-L", slug: "cloud-l", shortDescription: "Profesyonel bulut sunucu",
      longDescription: "AMD EPYC işlemci, NVMe depolama, DDR5 RAM ve 10 Gbps port ile yüksek performanslı bulut sunucu çözümleri.",
      resourceLimits: { cpu: "8 vCPU", ram: "16 GB", disk: "320 GB", traffic: "Sınırsız Trafik", port: "10 Gbps Port" },
      includedFeatures: ["NVMe Storage", "DDR5 RAM", "10 Gbps Port", "AMD EPYC", "%99.99 Uptime", "Ücretsiz Kurulum", "7/24 Destek"],
      features: [
        { label: "İşlemci", value: "8 vCPU", icon: "Cpu" },
        { label: "RAM", value: "16 GB DDR5", icon: "MemoryStick" },
        { label: "Disk", value: "320 GB NVMe", icon: "HardDrive", highlight: true },
        { label: "Trafik", value: "Sınırsız", icon: "Zap" },
        { label: "Port", value: "10 Gbps", icon: "Globe" },
      ],
      faq: [], basePrice: 999, isPopular: false, displayOrder: 3,
      pricingTiers: [
        { period: "monthly" as const, price: 999, discountedPrice: 999, renewalPrice: 1199, isDefault: true },
        { period: "yearly" as const, price: 839.17, discountedPrice: 839.17, renewalPrice: 999 },
      ],
    },
    {
      sku: "CLD-XL", name: "Cloud-XL", slug: "cloud-xl", shortDescription: "Kurumsal bulut sunucu",
      longDescription: "AMD EPYC işlemci, NVMe depolama, DDR5 RAM ve 10 Gbps port ile yüksek performanslı bulut sunucu çözümleri.",
      resourceLimits: { cpu: "16 vCPU", ram: "32 GB", disk: "640 GB", traffic: "Sınırsız Trafik", port: "10 Gbps Port" },
      includedFeatures: ["NVMe Storage", "DDR5 RAM", "10 Gbps Port", "AMD EPYC", "%99.99 Uptime", "Ücretsiz Kurulum", "7/24 Destek"],
      features: [
        { label: "İşlemci", value: "16 vCPU", icon: "Cpu" },
        { label: "RAM", value: "32 GB DDR5", icon: "MemoryStick" },
        { label: "Disk", value: "640 GB NVMe", icon: "HardDrive", highlight: true },
        { label: "Trafik", value: "Sınırsız", icon: "Zap" },
        { label: "Port", value: "10 Gbps", icon: "Globe" },
      ],
      faq: [], basePrice: 1899, isPopular: false, displayOrder: 4,
      pricingTiers: [
        { period: "monthly" as const, price: 1899, discountedPrice: 1899, renewalPrice: 2279, isDefault: true },
        { period: "yearly" as const, price: 1595.17, discountedPrice: 1595.17, renewalPrice: 1899 },
      ],
    },
  ];

  for (const product of products) {
    const { pricingTiers, ...productData } = product;
    await db.product.create({
      data: { ...productData, categoryId, status: "ACTIVE", isVisible: true,
        pricingTiers: { create: pricingTiers.map((t) => ({ ...t, isActive: true })) },
      },
    });
  }
}

export async function seedServerProducts(db: PrismaClient, categoryId: string) {
  const products = [
    {
      sku: "DS-E3", name: "DS-E3", slug: "ds-e3", shortDescription: "Giriş seviye fiziksel sunucu",
      longDescription: "Tamamen size ayrılmış donanım ile maksimum performans. IPMI/KVM erişimi ve 7/24 destek.",
      resourceLimits: { cpu: "Intel Xeon E-2336", cores: "6C / 12T", ram: "32 GB", disk: "2x 500 GB", bandwidth: "10 TB", port: "1 Gbps" },
      includedFeatures: ["NVMe SSD", "Full Root Erişimi", "IPMI/KVM", "%99.99 Uptime", "4 Saat Kurulum", "7/24 Destek"],
      features: [
        { label: "İşlemci", value: "Intel Xeon E-2336", icon: "Cpu" },
        { label: "Çekirdek", value: "6C / 12T", icon: "Cpu" },
        { label: "RAM", value: "32 GB DDR4", icon: "MemoryStick" },
        { label: "Disk", value: "2x 500 GB NVMe", icon: "HardDrive", highlight: true },
        { label: "Bant Genişliği", value: "10 TB", icon: "Zap" },
        { label: "Port", value: "1 Gbps", icon: "Globe" },
      ],
      faq: [], basePrice: 2499, badge: "GİRİŞ", isPopular: false, displayOrder: 1,
      pricingTiers: [
        { period: "monthly" as const, price: 2499, discountedPrice: 2499, renewalPrice: 2999, isDefault: true },
        { period: "yearly" as const, price: 2099.17, discountedPrice: 2099.17, renewalPrice: 2499 },
      ],
    },
    {
      sku: "DS-E5", name: "DS-E5", slug: "ds-e5", shortDescription: "Standart fiziksel sunucu",
      longDescription: "Tamamen size ayrılmış donanım ile maksimum performans. IPMI/KVM erişimi ve 7/24 destek.",
      resourceLimits: { cpu: "Intel Xeon E-2388G", cores: "8C / 16T", ram: "64 GB", disk: "2x 1 TB", bandwidth: "20 TB", port: "1 Gbps" },
      includedFeatures: ["NVMe SSD", "Full Root Erişimi", "IPMI/KVM", "%99.99 Uptime", "4 Saat Kurulum", "7/24 Destek"],
      features: [
        { label: "İşlemci", value: "Intel Xeon E-2388G", icon: "Cpu" },
        { label: "Çekirdek", value: "8C / 16T", icon: "Cpu" },
        { label: "RAM", value: "64 GB DDR4", icon: "MemoryStick" },
        { label: "Disk", value: "2x 1 TB NVMe", icon: "HardDrive", highlight: true },
        { label: "Bant Genişliği", value: "20 TB", icon: "Zap" },
        { label: "Port", value: "1 Gbps", icon: "Globe" },
      ],
      faq: [], basePrice: 3999, isPopular: true, displayOrder: 2,
      pricingTiers: [
        { period: "monthly" as const, price: 3999, discountedPrice: 3999, renewalPrice: 4799, isDefault: true },
        { period: "yearly" as const, price: 3359.17, discountedPrice: 3359.17, renewalPrice: 3999 },
      ],
    },
    {
      sku: "DS-SILVER", name: "DS-Silver", slug: "ds-silver", shortDescription: "Profesyonel fiziksel sunucu",
      longDescription: "Tamamen size ayrılmış donanım ile maksimum performans. IPMI/KVM erişimi ve 7/24 destek.",
      resourceLimits: { cpu: "Intel Xeon Silver 4314", cores: "16C / 32T", ram: "128 GB", disk: "4x 1 TB", bandwidth: "50 TB", port: "10 Gbps" },
      includedFeatures: ["NVMe SSD", "Full Root Erişimi", "IPMI/KVM", "%99.99 Uptime", "4 Saat Kurulum", "7/24 Destek"],
      features: [
        { label: "İşlemci", value: "Intel Xeon Silver 4314", icon: "Cpu" },
        { label: "Çekirdek", value: "16C / 32T", icon: "Cpu" },
        { label: "RAM", value: "128 GB DDR4", icon: "MemoryStick" },
        { label: "Disk", value: "4x 1 TB NVMe", icon: "HardDrive", highlight: true },
        { label: "Bant Genişliği", value: "50 TB", icon: "Zap" },
        { label: "Port", value: "10 Gbps", icon: "Globe" },
      ],
      faq: [], basePrice: 7499, badge: "PROFESYONEL", isPopular: false, displayOrder: 3,
      pricingTiers: [
        { period: "monthly" as const, price: 7499, discountedPrice: 7499, renewalPrice: 8999, isDefault: true },
        { period: "yearly" as const, price: 6299.17, discountedPrice: 6299.17, renewalPrice: 7499 },
      ],
    },
    {
      sku: "DS-GOLD", name: "DS-Gold", slug: "ds-gold", shortDescription: "Kurumsal fiziksel sunucu",
      longDescription: "Tamamen size ayrılmış donanım ile maksimum performans. IPMI/KVM erişimi ve 7/24 destek.",
      resourceLimits: { cpu: "2x Intel Xeon Gold 6330", cores: "56C / 112T", ram: "256 GB", disk: "4x 2 TB", bandwidth: "Sınırsız", port: "10 Gbps" },
      includedFeatures: ["NVMe SSD", "Full Root Erişimi", "IPMI/KVM", "%99.99 Uptime", "4 Saat Kurulum", "7/24 Destek"],
      features: [
        { label: "İşlemci", value: "2x Intel Xeon Gold 6330", icon: "Cpu" },
        { label: "Çekirdek", value: "56C / 112T", icon: "Cpu" },
        { label: "RAM", value: "256 GB DDR4", icon: "MemoryStick" },
        { label: "Disk", value: "4x 2 TB NVMe", icon: "HardDrive", highlight: true },
        { label: "Bant Genişliği", value: "Sınırsız", icon: "Zap" },
        { label: "Port", value: "10 Gbps", icon: "Globe" },
      ],
      faq: [], basePrice: 14999, badge: "KURUMSAL", isPopular: false, displayOrder: 4,
      pricingTiers: [
        { period: "monthly" as const, price: 14999, discountedPrice: 14999, renewalPrice: 17999, isDefault: true },
        { period: "yearly" as const, price: 12599.17, discountedPrice: 12599.17, renewalPrice: 14999 },
      ],
    },
  ];

  for (const product of products) {
    const { pricingTiers, ...productData } = product;
    await db.product.create({
      data: { ...productData, categoryId, status: "ACTIVE", isVisible: true,
        pricingTiers: { create: pricingTiers.map((t) => ({ ...t, isActive: true })) },
      },
    });
  }
}
