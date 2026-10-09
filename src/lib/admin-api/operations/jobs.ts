import { z } from "zod/v4";
import { listProblemJobs } from "@/lib/jobs/admin";
import { retryFailedQueueJob } from "@/lib/jobs/admin-retry";
import { jobRegistry } from "@/lib/jobs/definitions";
import { ApiError, failure } from "../errors";
import { defineOperation } from "../operation";
import { dateTimeSchema, iso } from "../schemas";

const TAG = "Jobs";

const jobSchema = z.object({
  id: z.string().describe("Kuyruk iş kimliği (uuid)"),
  name: z.string().describe('İş türü, örn. "provisioning.run"'),
  label: z.string(),
  state: z.string(),
  retryCount: z.number().int(),
  error: z.string().nullable(),
  data: z.unknown(),
  createdOn: dateTimeSchema.nullable(),
  completedOn: dateTimeSchema.nullable(),
});

export const listFailedJobs = defineOperation({
  id: "listFailedJobs",
  method: "GET",
  path: "/jobs/failed",
  tag: TAG,
  summary: "Başarısız arka plan işleri",
  description: "Kuyruktaki başarısız işler (en yeni önce, en fazla `limit`). Sayfalama yok: liste kuyruğun saklama süresiyle sınırlı.",
  permission: "jobs.manage",
  query: z.object({
    name: z.string().max(100).optional().describe("Yalnız bu iş türü"),
    limit: z.coerce.number().int().min(1).max(200).default(100),
  }),
  response: z.array(jobSchema),
  handler: async ({ query }) => {
    const rows = await listProblemJobs(200);
    const failed = rows
      .filter((row) => row.state === "failed" && (!query.name || row.name === query.name))
      .slice(0, query.limit);
    return {
      data: failed.map((row) => ({
        id: row.id,
        name: row.name,
        label: row.label,
        state: row.state,
        retryCount: row.retryCount,
        error: row.error,
        data: row.data,
        createdOn: iso(row.createdOn),
        completedOn: iso(row.completedOn),
      })),
    };
  },
});

export const retryJob = defineOperation({
  id: "retryJob",
  method: "POST",
  path: "/jobs/{name}/{id}/retry",
  tag: TAG,
  summary: "Başarısız işi yeniden dene",
  description: "İşi kuyruğa geri koyar ve ~25 sn içinde bu istekte çalıştırmayı dener. Sonuç `state` alanında.",
  permission: "jobs.manage",
  params: z.object({
    name: z.string().max(100).describe("İş türü"),
    id: z.uuid().describe("Kuyruk iş kimliği"),
  }),
  body: z.object({}).optional(),
  response: z.object({ state: z.string().nullable(), message: z.string() }),
  handler: async ({ params, context }) => {
    if (!jobRegistry.has(params.name)) throw new ApiError(404, "not_found", "Bilinmeyen iş türü");
    const result = await retryFailedQueueJob(context.owner.id, params.name, params.id);
    if (!result.success) throw failure(result);
    return { data: { state: result.state, message: result.message } };
  },
});
