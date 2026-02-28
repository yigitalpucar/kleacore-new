import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/utils/auth-helpers";
import { AddServiceContent } from "./content";
import type { BillingPeriod, ProductCategorySlug } from "@prisma/client";

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export default async function AddServicePage() {
  await requireAdmin();

  const [customers, products, servers] = await Promise.all([
    db.user.findMany({
      where: {
        role: "CUSTOMER",
        status: { not: "CLOSED" },
      },
      select: {
        id: true,
        name: true,
        surname: true,
        email: true,
      },
      orderBy: [{ name: "asc" }, { surname: "asc" }],
      take: 500,
    }),
    db.product.findMany({
      where: {
        status: "ACTIVE",
      },
      include: {
        category: {
          select: {
            slug: true,
            name: true,
          },
        },
        pricingTiers: {
          where: { isActive: true },
          select: {
            period: true,
            price: true,
            isDefault: true,
          },
        },
      },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    }),
    db.server.findMany({
      select: {
        id: true,
        name: true,
        ipAddress: true,
        location: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const serializedCustomers = customers.map((customer) => ({
    id: customer.id,
    name: `${customer.name} ${customer.surname}`.trim(),
    email: customer.email,
  }));

  const serializedProducts = products.map((product) => ({
    id: product.id,
    name: product.name,
    shortDescription: product.shortDescription,
    basePrice: product.basePrice,
    category: {
      slug: product.category.slug as ProductCategorySlug,
      name: product.category.name,
    },
    features: toStringArray(product.includedFeatures).slice(0, 4),
    pricingTiers: product.pricingTiers.map((tier) => ({
      period: tier.period as BillingPeriod,
      price: tier.price,
      isDefault: tier.isDefault,
    })),
  }));

  const serializedServers = servers.map((server) => ({
    id: server.id,
    name: server.name,
    ip: server.ipAddress,
    location: server.location,
  }));

  return (
    <AddServiceContent
      customers={serializedCustomers}
      products={serializedProducts}
      servers={serializedServers}
    />
  );
}
