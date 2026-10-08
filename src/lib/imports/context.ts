/** Loads the MatchContext (customers, products, existing bindings) the pure mapping rules need. */
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { CustomerRef, MatchContext, ProductCandidate } from "./mapping";

type DbClient = Prisma.TransactionClient | typeof db;

function customerLabel(user: { name: string; surname: string; companyName: string | null; email: string }) {
  return user.companyName?.trim() || `${user.name} ${user.surname}`.trim() || user.email;
}

export async function loadProducts(client: DbClient = db): Promise<ProductCandidate[]> {
  const products = await client.product.findMany({
    where: { status: { not: "ARCHIVED" } },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      sku: true,
      basePrice: true,
      moduleInstanceId: true,
      moduleOptions: true,
      category: { select: { slug: true } },
      pricingTiers: { where: { isActive: true }, select: { period: true, price: true, isDefault: true } },
    },
  });
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    categorySlug: p.category.slug,
    moduleInstanceId: p.moduleInstanceId,
    moduleOptions:
      p.moduleOptions && typeof p.moduleOptions === "object" && !Array.isArray(p.moduleOptions)
        ? (p.moduleOptions as Record<string, unknown>)
        : {},
    basePrice: p.basePrice,
    pricingTiers: p.pricingTiers,
  }));
}

export async function loadMatchContext(instanceId: string, client: DbClient = db, now = new Date()): Promise<MatchContext> {
  const [customers, services, domains, products] = await Promise.all([
    client.user.findMany({
      where: { role: "CUSTOMER" },
      select: { id: true, email: true, name: true, surname: true, companyName: true },
    }),
    client.service.findMany({
      select: {
        id: true,
        customerId: true,
        domain: true,
        username: true,
        serverName: true,
        status: true,
        moduleInstanceId: true,
        remoteId: true,
        product: { select: { category: { select: { slug: true } } } },
      },
    }),
    client.domain.findMany({ select: { id: true, name: true, customerId: true } }),
    loadProducts(client),
  ]);

  const byId = new Map<string, CustomerRef>();
  const customersByEmail = new Map<string, CustomerRef>();
  for (const user of customers) {
    const ref = { id: user.id, email: user.email, label: customerLabel(user) };
    byId.set(user.id, ref);
    customersByEmail.set(user.email.trim().toLowerCase(), ref);
  }

  const customersByDomain = new Map<string, CustomerRef>();
  for (const service of services) {
    const domain = service.domain?.trim().toLowerCase();
    const ref = byId.get(service.customerId);
    if (domain && ref && service.status !== "CANCELLED" && !customersByDomain.has(domain)) customersByDomain.set(domain, ref);
  }
  const existingDomains = new Map<string, string>();
  for (const domain of domains) {
    const name = domain.name.trim().toLowerCase();
    existingDomains.set(name, domain.id);
    const ref = byId.get(domain.customerId);
    if (ref) customersByDomain.set(name, ref); // registered domain wins over a service's domain field
  }

  const importedServices = new Map<string, string>();
  for (const service of services) {
    if (service.moduleInstanceId === instanceId && service.remoteId) importedServices.set(service.remoteId, service.id);
  }

  const legacyServices = services
    .filter(
      (s) =>
        !s.moduleInstanceId &&
        !s.remoteId &&
        ["PENDING", "ACTIVE", "SUSPENDED"].includes(s.status) &&
        ["hosting", "email"].includes(s.product.category.slug) &&
        (s.username || s.serverName)
    )
    .map((s) => ({ id: s.id, customerId: s.customerId, username: s.username, serverName: s.serverName, domain: s.domain }));

  return { now, instanceId, customersByEmail, customersByDomain, products, importedServices, legacyServices, existingDomains };
}
