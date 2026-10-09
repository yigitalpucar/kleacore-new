/**
 * OpenAPI 3.1 document of the admin API, generated from the operation
 * registry's zod schemas (JSON Schema 2020-12, which OpenAPI 3.1 uses).
 */
import { z } from "zod/v4";
import { ERROR_CODES } from "./errors";
import { IDEMPOTENCY_TTL_MS } from "./idempotency";
import type { AnyOperation } from "./operation";
import { paginationSchema } from "./pagination";
import { ADMIN_API_OPERATIONS } from "./registry";
import { ADMIN_API_BASE } from "./route";

type JsonSchema = Record<string, unknown>;

function toSchema(schema: z.ZodType, io: "input" | "output"): JsonSchema {
  const json = z.toJSONSchema(schema, { target: "draft-2020-12", io, unrepresentable: "any" }) as JsonSchema;
  delete json.$schema;
  return json;
}

/** `z.object(...)` (possibly `.optional()`) → its shape, else null. */
function objectShape(schema: z.ZodType | undefined): Record<string, z.ZodType> | null {
  if (!schema) return null;
  let current: z.ZodType = schema;
  while (current instanceof z.ZodOptional || current instanceof z.ZodNullable) current = current.unwrap() as z.ZodType;
  return current instanceof z.ZodObject ? (current.shape as Record<string, z.ZodType>) : null;
}

const isOptional = (schema: z.ZodType) => schema.safeParse(undefined).success;

function parameters(operation: AnyOperation) {
  const out: JsonSchema[] = [];
  for (const [location, schema] of [
    ["path", operation.params],
    ["query", operation.query],
  ] as const) {
    const shape = objectShape(schema);
    if (!shape) continue;
    for (const [name, field] of Object.entries(shape)) {
      const json = toSchema(field, "input");
      const description = typeof json.description === "string" ? json.description : undefined;
      delete json.description;
      out.push({
        name,
        in: location,
        required: location === "path" ? true : !isOptional(field),
        ...(description ? { description } : {}),
        schema: json,
      });
    }
  }
  if (operation.method === "POST") {
    out.push({ $ref: "#/components/parameters/IdempotencyKey" });
  }
  return out;
}

function successSchema(operation: AnyOperation): JsonSchema {
  const data = toSchema(operation.response, "output");
  if (operation.id === "getOpenApiDocument") return { type: "object", description: "OpenAPI 3.1 belgesi" };
  if (operation.list) {
    return {
      type: "object",
      properties: { data: { type: "array", items: data }, pagination: { $ref: "#/components/schemas/Pagination" } },
      required: ["data", "pagination"],
    };
  }
  return { type: "object", properties: { data }, required: ["data"] };
}

const errorRef = (description: string) => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
});

function operationObject(operation: AnyOperation) {
  const status = String(operation.successStatus ?? 200);
  const body = operation.body ? objectShape(operation.body) : null;
  const permissionNote = operation.permission
    ? `Gerekli yetki (scope): \`${operation.permission}\`.`
    : "Geçerli herhangi bir token yeterli.";
  return {
    operationId: operation.id,
    tags: [operation.tag],
    summary: operation.summary,
    description: [operation.description, permissionNote].filter(Boolean).join("\n\n"),
    "x-required-permission": operation.permission,
    parameters: parameters(operation),
    ...(operation.body
      ? {
          requestBody: {
            required: !isOptional(operation.body),
            content: { "application/json": { schema: body ? toSchema(operation.body, "input") : { type: "object" } } },
          },
        }
      : {}),
    responses: {
      [status]: { description: "Başarılı", content: { "application/json": { schema: successSchema(operation) } } },
      "400": errorRef("Geçersiz istek / JSON / cursor"),
      "401": errorRef("Token yok, geçersiz, iptal edilmiş, süresi dolmuş veya sahibi pasif"),
      "403": errorRef("Yetki (scope) yetersiz, IP izinli değil veya sahibinin 2FA'sı eksik"),
      ...(operation.params ? { "404": errorRef("Kayıt bulunamadı") } : {}),
      ...(operation.method !== "GET" ? { "409": errorRef("Kaydın durumu işleme uygun değil / Idempotency-Key işleniyor") } : {}),
      "422": errorRef("Doğrulama hatası (details.issues) / Idempotency-Key başka istekle kullanılmış"),
      "429": {
        ...errorRef("Token'ın dakikalık istek sınırı aşıldı"),
        headers: { "Retry-After": { schema: { type: "integer" }, description: "Saniye" } },
      },
    },
  };
}

export function buildAdminOpenApiDocument(origin: string) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const operation of ADMIN_API_OPERATIONS) {
    paths[operation.path] ??= {};
    paths[operation.path][operation.method.toLowerCase()] = operationObject(operation);
  }

  return {
    openapi: "3.1.0",
    jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema",
    info: {
      title: "KLEACORE Admin API",
      version: "1.0.0",
      description: [
        "Otomasyon ve yapay zekâ ajanları için yönetim API'si. Her istek `Authorization: Bearer kc_admin_…` ister.",
        "Token'ın etkin yetkileri = token'a verilen scope'lar ∩ sahibinin o anki rol yetkileri; her istekte yeniden hesaplanır.",
        "Yanıtlar `{ data }` (listelerde `{ data, pagination }`), hatalar `{ error: { code, message, details? }, requestId }` biçimindedir.",
        "Listeler cursor ile sayfalanır: `limit` (≤100) + `cursor` = önceki yanıttaki `pagination.nextCursor`.",
        `POST isteklerinde \`Idempotency-Key\` başlığı desteklenir: aynı anahtar + aynı gövde ${IDEMPOTENCY_TTL_MS / 3_600_000} saat boyunca ilk yanıtı tekrar döner (\`Idempotent-Replayed: true\`).`,
        "Tutarlar ondalık metin (\"1234.50\"), zamanlar ISO 8601 UTC'dir. Her çağrı aktivite kaydına yazılır.",
      ].join("\n\n"),
    },
    servers: [{ url: `${origin}${ADMIN_API_BASE}` }],
    security: [{ bearerAuth: [] }],
    tags: [...new Set(ADMIN_API_OPERATIONS.map((operation) => operation.tag))].map((name) => ({ name })),
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "kc_admin_…", description: "Yönetim → API token'larım" },
      },
      parameters: {
        IdempotencyKey: {
          name: "Idempotency-Key",
          in: "header",
          required: false,
          description: "Tekrar denemelerde işlemin iki kez yapılmasını önler (1–255 görünür ASCII karakter, örn. UUID).",
          schema: { type: "string", maxLength: 255 },
        },
      },
      schemas: {
        Pagination: toSchema(paginationSchema, "output"),
        Error: {
          type: "object",
          properties: {
            error: {
              type: "object",
              properties: {
                code: { type: "string", enum: Object.keys(ERROR_CODES) },
                message: { type: "string" },
                details: {},
              },
              required: ["code", "message"],
            },
            requestId: { type: "string" },
          },
          required: ["error", "requestId"],
        },
      },
    },
  };
}
