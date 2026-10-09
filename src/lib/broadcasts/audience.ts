import type { BroadcastKind, Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";

/**
 * Broadcast audience: who receives an announcement.
 *
 * Groups are combined with AND, values inside a group with OR. The service
 * groups (products / categories, servers) must match the SAME service: "on
 * WHM-1 and has a Linux hosting product" means one service that is both.
 *
 * Marketing broadcasts only reach customers who opted in
 * (User.marketingConsent); service / maintenance notices are transactional
 * and reach everyone the filter matches.
 */

const USER_STATUSES = ["ACTIVE", "SUSPENDED", "CLOSED"] as const;
const SERVICE_STATUSES = ["PENDING", "ACTIVE", "SUSPENDED", "CANCELLED", "EXPIRED"] as const;
const CUSTOMER_TYPES = ["INDIVIDUAL", "CORPORATE"] as const;

/** A module instance (WHM server, Proxmox cluster…) and optionally one Proxmox node of it. */
export const serverTargetSchema = z.object({
  instanceId: z.string().min(1),
  node: z.string().trim().min(1).max(100).optional(),
});

const tld = z
  .string()
  .trim()
  .toLowerCase()
  .transform((value) => value.replace(/^\.+/, ""))
  .pipe(z.string().regex(/^[a-z0-9-]+(\.[a-z0-9-]+)*$/, "Geçersiz uzantı"));

export const audienceFilterSchema = z.object({
  /** Customer account status; default: only active accounts. */
  userStatuses: z.array(z.enum(USER_STATUSES)).default(["ACTIVE"]),
  customerTypes: z.array(z.enum(CUSTOMER_TYPES)).default([]),
  productIds: z.array(z.string().min(1)).default([]),
  categoryIds: z.array(z.string().min(1)).default([]),
  servers: z.array(serverTargetSchema).default([]),
  /** Status of the matching service (only with a product / category / server filter). */
  serviceStatuses: z.array(z.enum(SERVICE_STATUSES)).default(["ACTIVE", "SUSPENDED"]),
  /** Domain extensions without the dot: "com.tr", "com". */
  tlds: z.array(tld).default([]),
});

export type AudienceFilter = z.output<typeof audienceFilterSchema>;
export type AudienceFilterInput = z.input<typeof audienceFilterSchema>;

/** Domains a customer still holds (expired ones no longer make them "affected"). */
const LIVE_DOMAIN_STATUSES = ["ACTIVE", "PENDING", "TRANSFERRING"] as const;

export function parseAudience(value: unknown): AudienceFilter {
  return audienceFilterSchema.parse(value ?? {});
}

function hasServiceFilter(filter: AudienceFilter) {
  return filter.productIds.length > 0 || filter.categoryIds.length > 0 || filter.servers.length > 0;
}

export function buildServiceWhere(filter: AudienceFilter): Prisma.ServiceWhereInput {
  const and: Prisma.ServiceWhereInput[] = [{ status: { in: [...filter.serviceStatuses] } }];

  const productOr: Prisma.ServiceWhereInput[] = [];
  if (filter.productIds.length) productOr.push({ productId: { in: filter.productIds } });
  if (filter.categoryIds.length) productOr.push({ product: { categoryId: { in: filter.categoryIds } } });
  if (productOr.length) and.push({ OR: productOr });

  if (filter.servers.length) {
    and.push({
      OR: filter.servers.map((target) =>
        target.node
          ? {
              moduleInstanceId: target.instanceId,
              // Proxmox keeps the node of each VM in Service.moduleData.proxmox.node.
              moduleData: { path: ["proxmox", "node"], equals: target.node },
            }
          : { moduleInstanceId: target.instanceId }
      ),
    });
  }
  return { AND: and };
}

/** Prisma filter for the customers a broadcast reaches. */
export function buildAudienceWhere(filter: AudienceFilter, kind: BroadcastKind): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [
    { role: "CUSTOMER" },
    { status: { in: filter.userStatuses.length ? [...filter.userStatuses] : ["ACTIVE"] } },
  ];
  if (filter.customerTypes.length) and.push({ customerType: { in: [...filter.customerTypes] } });
  if (kind === "MARKETING") and.push({ marketingConsent: true });
  if (hasServiceFilter(filter)) and.push({ services: { some: buildServiceWhere(filter) } });
  if (filter.tlds.length) {
    and.push({
      domains: {
        some: {
          status: { in: [...LIVE_DOMAIN_STATUSES] },
          OR: filter.tlds.map((ext) => ({ name: { endsWith: `.${ext}`, mode: "insensitive" as const } })),
        },
      },
    });
  }
  return { AND: and };
}

export interface AudiencePreview {
  total: number;
  withPhone: number;
  /** Matching customers left out because they did not opt in (marketing only). */
  excludedNoConsent: number;
  sample: Array<{ id: string; name: string; email: string; phone: string | null; companyName: string | null }>;
}

export async function previewAudience(filter: AudienceFilter, kind: BroadcastKind, sampleSize = 10): Promise<AudiencePreview> {
  const where = buildAudienceWhere(filter, kind);
  const [total, withPhone, users, unfiltered] = await Promise.all([
    db.user.count({ where }),
    db.user.count({ where: { AND: [where, { phone: { not: null } }, { NOT: { phone: "" } }] } }),
    db.user.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: sampleSize,
      select: { id: true, name: true, surname: true, email: true, phone: true, companyName: true },
    }),
    kind === "MARKETING" ? db.user.count({ where: buildAudienceWhere(filter, "SERVICE") }) : Promise.resolve(0),
  ]);
  return {
    total,
    withPhone,
    excludedNoConsent: kind === "MARKETING" ? Math.max(0, unfiltered - total) : 0,
    sample: users.map((user) => ({
      id: user.id,
      name: `${user.name} ${user.surname}`.trim(),
      email: user.email,
      phone: user.phone,
      companyName: user.companyName,
    })),
  };
}

/** Options for the audience builder (products, categories, server instances + known Proxmox nodes). */
export async function loadAudienceOptions() {
  const [categories, products, instances, nodeRows] = await Promise.all([
    db.productCategory.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.product.findMany({
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
      select: { id: true, name: true, category: { select: { name: true } } },
    }),
    db.moduleInstance.findMany({
      where: { kind: "server" },
      orderBy: [{ moduleId: "asc" }, { label: "asc" }],
      select: { id: true, label: true, moduleId: true, isActive: true },
    }),
    db.$queryRaw<Array<{ instanceId: string; node: string }>>`
      SELECT DISTINCT "moduleInstanceId" AS "instanceId", "moduleData"->'proxmox'->>'node' AS "node"
      FROM "services"
      WHERE "moduleInstanceId" IS NOT NULL AND "moduleData"->'proxmox'->>'node' IS NOT NULL
      ORDER BY 1, 2`,
  ]);
  return {
    categories,
    products: products.map((product) => ({ id: product.id, name: product.name, category: product.category.name })),
    instances: instances.map((instance) => ({
      ...instance,
      nodes: nodeRows.filter((row) => row.instanceId === instance.id).map((row) => row.node),
    })),
  };
}

export type AudienceOptions = Awaited<ReturnType<typeof loadAudienceOptions>>;

/** Short Turkish description of a filter for lists ("Aktif müşteriler · WHM-1 · .com.tr"). */
export function describeAudience(
  filter: AudienceFilter,
  labels: { products?: Map<string, string>; categories?: Map<string, string>; instances?: Map<string, string> } = {}
) {
  const parts: string[] = [];
  const statusLabel: Record<string, string> = { ACTIVE: "aktif", SUSPENDED: "askıdaki", CLOSED: "kapalı" };
  parts.push(`${filter.userStatuses.map((status) => statusLabel[status]).join("/")} müşteriler`.replace(/^./, (c) => c.toUpperCase()));
  if (filter.customerTypes.length === 1) parts.push(filter.customerTypes[0] === "CORPORATE" ? "Kurumsal" : "Bireysel");
  for (const id of filter.categoryIds) parts.push(labels.categories?.get(id) ?? "Kategori");
  for (const id of filter.productIds) parts.push(labels.products?.get(id) ?? "Ürün");
  for (const target of filter.servers) {
    const name = labels.instances?.get(target.instanceId) ?? "Sunucu";
    parts.push(target.node ? `${name} / ${target.node}` : name);
  }
  if (filter.tlds.length) parts.push(filter.tlds.map((ext) => `.${ext}`).join(", "));
  return parts.join(" · ");
}
