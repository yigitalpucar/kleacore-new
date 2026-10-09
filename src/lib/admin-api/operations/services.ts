import type { Prisma } from "@prisma/client";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { retryProvisioningJobAs } from "@/lib/provisioning/admin-retry";
import { suspendServiceAs, terminateServiceAs, unsuspendServiceAs } from "@/lib/services/admin-lifecycle";
import { ApiError, failure } from "../errors";
import { defineOperation } from "../operation";
import { keyset, pageOf, paginationQuery } from "../pagination";
import { dateTimeSchema, decimal, idParams, idSchema, iso, moneySchema, reasonSchema } from "../schemas";

const TAG = "Services";
const SERVICE_STATUSES = ["PENDING", "ACTIVE", "SUSPENDED", "CANCELLED", "EXPIRED"] as const;

const serviceSelect = {
  id: true,
  customerId: true,
  productId: true,
  label: true,
  domain: true,
  username: true,
  ipAddress: true,
  serverName: true,
  billingPeriod: true,
  amount: true,
  nextDueDate: true,
  expiresAt: true,
  status: true,
  suspendedAt: true,
  suspendReason: true,
  cancelledAt: true,
  createdAt: true,
  updatedAt: true,
  product: { select: { name: true, slug: true } },
  customer: { select: { email: true, name: true, surname: true } },
} satisfies Prisma.ServiceSelect;

type ServiceRow = Prisma.ServiceGetPayload<{ select: typeof serviceSelect }>;

export const serviceSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  customer: z.object({ email: z.string(), name: z.string() }),
  productId: z.string(),
  product: z.object({ name: z.string(), slug: z.string() }),
  label: z.string(),
  domain: z.string().nullable(),
  username: z.string().nullable(),
  ipAddress: z.string().nullable(),
  serverName: z.string().nullable(),
  billingPeriod: z.string(),
  amount: moneySchema.describe("KDV hariç dönem tutarı"),
  nextDueDate: dateTimeSchema.nullable(),
  expiresAt: dateTimeSchema.nullable(),
  status: z.enum(SERVICE_STATUSES),
  suspendedAt: dateTimeSchema.nullable(),
  suspendReason: z.string().nullable(),
  cancelledAt: dateTimeSchema.nullable(),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
});

function serializeService(row: ServiceRow): z.infer<typeof serviceSchema> {
  return {
    id: row.id,
    customerId: row.customerId,
    customer: { email: row.customer.email, name: `${row.customer.name} ${row.customer.surname}`.trim() },
    productId: row.productId,
    product: { name: row.product.name, slug: row.product.slug },
    label: row.label,
    domain: row.domain,
    username: row.username,
    ipAddress: row.ipAddress,
    serverName: row.serverName,
    billingPeriod: row.billingPeriod,
    amount: decimal(row.amount)!,
    nextDueDate: iso(row.nextDueDate),
    expiresAt: iso(row.expiresAt),
    status: row.status,
    suspendedAt: iso(row.suspendedAt),
    suspendReason: row.suspendReason,
    cancelledAt: iso(row.cancelledAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function loadService(id: string) {
  const row = await db.service.findUnique({ where: { id }, select: serviceSelect });
  if (!row) throw new ApiError(404, "not_found", "Hizmet bulunamadı");
  return row;
}

const actionResult = z.object({
  service: serviceSchema,
  integration: z.unknown().describe("Uzak sistem (panel / hipervizör) sonucu: { ok, provider, error? }"),
});

export const listServices = defineOperation({
  id: "listServices",
  method: "GET",
  path: "/services",
  tag: TAG,
  summary: "Hizmetleri listele",
  permission: "services.view",
  query: z.object({
    status: z.enum(SERVICE_STATUSES).optional(),
    customerId: idSchema.optional(),
    q: z.string().trim().max(200).optional().describe("Etiket, alan adı, kullanıcı adı veya IP'de arar"),
    ...paginationQuery,
  }),
  response: serviceSchema,
  list: true,
  handler: async ({ query }) => {
    const page = keyset("createdAt", query);
    const search: Prisma.ServiceWhereInput = query.q
      ? { OR: ["label", "domain", "username", "ipAddress"].map((field) => ({ [field]: { contains: query.q, mode: "insensitive" } })) }
      : {};
    const rows = await db.service.findMany({
      where: {
        AND: [
          query.status ? { status: query.status } : {},
          query.customerId ? { customerId: query.customerId } : {},
          search,
          page.where,
        ],
      },
      orderBy: page.orderBy,
      take: page.take,
      select: serviceSelect,
    });
    const { items, pagination } = pageOf(rows, query.limit, (row) => row.createdAt);
    return { data: items.map(serializeService), pagination };
  },
});

export const getService = defineOperation({
  id: "getService",
  method: "GET",
  path: "/services/{id}",
  tag: TAG,
  summary: "Hizmet detayı",
  description: "Hizmet + son kurulum (provisioning) işleri.",
  permission: "services.view",
  params: idParams,
  response: serviceSchema.extend({
    provisioningJobs: z.array(
      z.object({
        id: z.string(),
        kind: z.string(),
        status: z.string(),
        attempts: z.number().int(),
        lastError: z.string().nullable(),
        nextRetryAt: dateTimeSchema,
        updatedAt: dateTimeSchema,
      })
    ),
  }),
  handler: async ({ params }) => {
    const row = await loadService(params.id);
    const jobs = await db.provisioningJob.findMany({
      where: { OR: [{ serviceId: row.id }, { order: { serviceId: row.id } }] },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: { id: true, kind: true, status: true, attempts: true, lastError: true, nextRetryAt: true, updatedAt: true },
    });
    return {
      data: {
        ...serializeService(row),
        provisioningJobs: jobs.map((job) => ({
          ...job,
          nextRetryAt: job.nextRetryAt.toISOString(),
          updatedAt: job.updatedAt.toISOString(),
        })),
      },
    };
  },
});

export const suspendService = defineOperation({
  id: "suspendService",
  method: "POST",
  path: "/services/{id}/suspend",
  tag: TAG,
  summary: "Hizmeti askıya al",
  description: "Yalnız ACTIVE hizmetler. Müşteriye bildirim (service.suspended olayı) gider; uzak hesap askıya alınır.",
  permission: "services.manage",
  params: idParams,
  body: z.object({ reason: reasonSchema }),
  response: actionResult,
  handler: async ({ params, body, context }) => {
    const result = await suspendServiceAs(context.owner.id, params.id, body.reason);
    if (!result.success) throw failure(result);
    return { data: { service: serializeService(await loadService(params.id)), integration: result.integration } };
  },
});

export const unsuspendService = defineOperation({
  id: "unsuspendService",
  method: "POST",
  path: "/services/{id}/unsuspend",
  tag: TAG,
  summary: "Askıyı kaldır",
  description: "Yalnız SUSPENDED hizmetler.",
  permission: "services.manage",
  params: idParams,
  body: z.object({}).optional(),
  response: actionResult,
  handler: async ({ params, context }) => {
    const result = await unsuspendServiceAs(context.owner.id, params.id);
    if (!result.success) throw failure(result);
    return { data: { service: serializeService(await loadService(params.id)), integration: result.integration } };
  },
});

export const terminateService = defineOperation({
  id: "terminateService",
  method: "POST",
  path: "/services/{id}/terminate",
  tag: TAG,
  summary: "Hizmeti sonlandır",
  description:
    "Geri alınamaz: hizmet CANCELLED olur ve uzak hesap silinir. Gerekçe aktivite kaydına yazılır. Yedekli bir VDS önce son yedeğini alır; silme yedek bitince kuyruktan yapılır (`integration.error = FINAL_BACKUP_PENDING`). `skipFinalBackup: true` ek olarak `backups.manage` yetkisi ister.",
  permission: "services.manage",
  params: idParams,
  body: z.object({
    reason: reasonSchema,
    skipFinalBackup: z.boolean().optional().describe("Son yedeği almadan sil (backups.manage gerekir)"),
  }),
  response: actionResult,
  handler: async ({ params, body, context }) => {
    if (body.skipFinalBackup && !context.scopes.includes("backups.manage")) {
      throw new ApiError(403, "insufficient_scope", 'Son yedek olmadan silmek için "backups.manage" yetkisi gerekli', {
        required: "backups.manage",
      });
    }
    const result = await terminateServiceAs(context.owner.id, params.id, body.reason, {
      skipFinalBackup: body.skipFinalBackup === true,
    });
    if (!result.success) throw failure(result);
    return { data: { service: serializeService(await loadService(params.id)), integration: result.integration } };
  },
});

export const retryServiceProvisioning = defineOperation({
  id: "retryServiceProvisioning",
  method: "POST",
  path: "/services/{id}/retry-provisioning",
  tag: TAG,
  summary: "Kurulumu yeniden dene",
  description:
    "Hizmetin tamamlanmamış en son kurulum işini (veya `jobId` ile verileni) şimdi yeniden çalıştırır. Manuel kurulum görevleri bu uçla tamamlanamaz.",
  permission: "provisioning.manage",
  params: idParams,
  body: z.object({ jobId: idSchema.optional() }).optional(),
  response: z.object({ jobId: z.string(), status: z.string(), lastError: z.string().nullable() }),
  handler: async ({ params, body, context }) => {
    await loadService(params.id);
    const job = await db.provisioningJob.findFirst({
      where: {
        OR: [{ serviceId: params.id }, { order: { serviceId: params.id } }],
        ...(body?.jobId ? { id: body.jobId } : { status: { not: "COMPLETED" } }),
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    if (!job) throw new ApiError(404, "not_found", "Bu hizmet için yeniden denenecek kurulum işi yok");
    const result = await retryProvisioningJobAs(context.owner.id, job.id);
    if (!result.success) throw failure(result);
    const after = await db.provisioningJob.findUnique({ where: { id: job.id }, select: { status: true, lastError: true } });
    return { data: { jobId: job.id, status: after?.status ?? "UNKNOWN", lastError: after?.lastError ?? null } };
  },
});
