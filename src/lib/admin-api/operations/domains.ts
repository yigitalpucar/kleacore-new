import type { Prisma } from "@prisma/client";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { renewErrorMessage } from "@/lib/domains/admin-messages";
import { ApiError } from "../errors";
import { defineOperation } from "../operation";
import { keyset, pageOf, paginationQuery } from "../pagination";
import { dateTimeSchema, idParams, idSchema, iso } from "../schemas";

const TAG = "Domains";
const DOMAIN_STATUSES = ["ACTIVE", "EXPIRED", "TRANSFERRING", "PENDING"] as const;

const domainSelect = {
  id: true,
  customerId: true,
  name: true,
  registrar: true,
  registeredAt: true,
  expiresAt: true,
  autoRenew: true,
  privacyEnabled: true,
  status: true,
  nameservers: true,
  lastSyncedAt: true,
  createdAt: true,
  customer: { select: { email: true, name: true, surname: true } },
} satisfies Prisma.DomainSelect;

type DomainRow = Prisma.DomainGetPayload<{ select: typeof domainSelect }>;

export const domainSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  customer: z.object({ email: z.string(), name: z.string() }),
  name: z.string(),
  registrar: z.string(),
  registeredAt: dateTimeSchema,
  expiresAt: dateTimeSchema,
  autoRenew: z.boolean(),
  privacyEnabled: z.boolean(),
  status: z.enum(DOMAIN_STATUSES),
  nameservers: z.array(z.string()),
  lastSyncedAt: dateTimeSchema.nullable(),
  createdAt: dateTimeSchema,
});

function serializeDomain(row: DomainRow): z.infer<typeof domainSchema> {
  return {
    id: row.id,
    customerId: row.customerId,
    customer: { email: row.customer.email, name: `${row.customer.name} ${row.customer.surname}`.trim() },
    name: row.name,
    registrar: row.registrar,
    registeredAt: row.registeredAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    autoRenew: row.autoRenew,
    privacyEnabled: row.privacyEnabled,
    status: row.status,
    nameservers: Array.isArray(row.nameservers) ? row.nameservers.filter((ns): ns is string => typeof ns === "string") : [],
    lastSyncedAt: iso(row.lastSyncedAt),
    createdAt: row.createdAt.toISOString(),
  };
}

async function loadDomain(id: string) {
  const row = await db.domain.findUnique({ where: { id }, select: domainSelect });
  if (!row) throw new ApiError(404, "not_found", "Alan adı bulunamadı");
  return row;
}

export const listDomains = defineOperation({
  id: "listDomains",
  method: "GET",
  path: "/domains",
  tag: TAG,
  summary: "Alan adlarını listele",
  description: "`expiringWithinDays` ile yakında süresi dolacakları süzün.",
  permission: "domains.view",
  query: z.object({
    status: z.enum(DOMAIN_STATUSES).optional(),
    customerId: idSchema.optional(),
    q: z.string().trim().max(253).optional().describe("Alan adında arar"),
    expiringWithinDays: z.coerce.number().int().min(0).max(3650).optional(),
    ...paginationQuery,
  }),
  response: domainSchema,
  list: true,
  handler: async ({ query }) => {
    const page = keyset("createdAt", query);
    const rows = await db.domain.findMany({
      where: {
        AND: [
          query.status ? { status: query.status } : {},
          query.customerId ? { customerId: query.customerId } : {},
          query.q ? { name: { contains: query.q.toLowerCase(), mode: "insensitive" } } : {},
          query.expiringWithinDays !== undefined
            ? { expiresAt: { lte: new Date(Date.now() + query.expiringWithinDays * 24 * 60 * 60 * 1000) } }
            : {},
          page.where,
        ],
      },
      orderBy: page.orderBy,
      take: page.take,
      select: domainSelect,
    });
    const { items, pagination } = pageOf(rows, query.limit, (row) => row.createdAt);
    return { data: items.map(serializeDomain), pagination };
  },
});

export const getDomain = defineOperation({
  id: "getDomain",
  method: "GET",
  path: "/domains/{id}",
  tag: TAG,
  summary: "Alan adı detayı",
  permission: "domains.view",
  params: idParams,
  response: domainSchema,
  handler: async ({ params }) => ({ data: serializeDomain(await loadDomain(params.id)) }),
});

export const syncDomain = defineOperation({
  id: "syncDomain",
  method: "POST",
  path: "/domains/{id}/sync",
  tag: TAG,
  summary: "Registrar ile senkronize et",
  description: "Durum, bitiş tarihi ve NS bilgilerini registrar'dan çeker; farkları uygular.",
  permission: "domains.manage",
  params: idParams,
  body: z.object({}).optional(),
  response: z.object({
    domain: domainSchema,
    changed: z.boolean(),
    diffs: z.array(z.unknown()).describe("Değişen alanlar"),
  }),
  handler: async ({ params, context }) => {
    await loadDomain(params.id);
    const { syncDomainWithRegistrar } = await import("@/lib/domains/sync");
    const result = await syncDomainWithRegistrar(params.id, context.owner.id);
    if (!result.ok) {
      if (result.skipped) throw new ApiError(409, "conflict", "Registrar etkin değil veya bu işlemi desteklemiyor");
      throw new ApiError(502, "upstream_failed", `Senkron başarısız: ${result.error}`);
    }
    return { data: { domain: serializeDomain(await loadDomain(params.id)), changed: result.changed, diffs: result.diffs } };
  },
});

export const renewDomain = defineOperation({
  id: "renewDomain",
  method: "POST",
  path: "/domains/{id}/renew",
  tag: TAG,
  summary: "Registrar'da yenile",
  description:
    "Ödenmiş (veya başarısız) bir yenileme varsa onu yeniden dener; yoksa bu dönem için faturasız bir yönetici yenilemesi yapar. Dönemin ödenmemiş yenileme faturası varsa reddedilir. Registrar'da gerçek işlem yapar — Idempotency-Key kullanın.",
  permission: "domains.manage",
  params: idParams,
  body: z.object({}).optional(),
  response: z.object({ domain: domainSchema, renewalId: z.string(), newExpiresAt: dateTimeSchema }),
  handler: async ({ params, context }) => {
    await loadDomain(params.id);
    const { manualRegistrarRenew } = await import("@/lib/domains/renew");
    const result = await manualRegistrarRenew(params.id, context.owner.id);
    if (!result.ok) {
      const status =
        result.error === "DOMAIN_NOT_FOUND" ? 404 : result.error === "REGISTRAR_NOT_CONFIGURED" || result.error === "RENEWAL_BUSY" || result.error === "ALREADY_COMPLETED" || result.error.startsWith("OPEN_INVOICE:") ? 409 : 502;
      throw new ApiError(status, status === 404 ? "not_found" : status === 409 ? "conflict" : "upstream_failed", renewErrorMessage(result.error), {
        reason: result.error,
      });
    }
    return {
      data: {
        domain: serializeDomain(await loadDomain(params.id)),
        renewalId: result.renewalId,
        newExpiresAt: result.newExpiresAt.toISOString(),
      },
    };
  },
});
