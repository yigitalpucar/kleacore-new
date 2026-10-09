/**
 * Turns an operation into a Next.js route handler:
 * auth → rate limit → scope check → input validation → Idempotency-Key →
 * handler → JSON envelope; every call with a known token is audited.
 */
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { z } from "zod/v4";
import { checkRateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import { auditAdminApiCall, logUnattributedCall } from "./audit";
import { authenticateAdminApiRequest } from "./auth";
import { ApiError } from "./errors";
import {
  IDEMPOTENCY_HEADER,
  beginIdempotentRequest,
  completeIdempotentRequest,
  releaseIdempotentRequest,
} from "./idempotency";
import { clientIp } from "./ip";
import type { AnyOperation } from "./operation";

const log = createLogger("admin-api");

export const ADMIN_API_BASE = "/api/admin/v1";
const RATE_WINDOW_MS = 60_000;
const MAX_BODY_BYTES = 1_000_000;

type RouteContext = { params: Promise<Record<string, string | string[] | undefined>> };

export type AdminApiRouteHandler = ((request: Request, context: RouteContext) => Promise<Response>) & {
  operation: AnyOperation;
};

function issuesOf(error: z.ZodError) {
  return error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
}

function parse<S extends z.ZodType>(schema: S | undefined, value: unknown, where: string): z.output<S> | undefined {
  if (!schema) return undefined;
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiError(422, "validation_failed", `Doğrulama hatası (${where})`, { in: where, issues: issuesOf(result.error) });
  }
  return result.data;
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

async function readBody(request: Request): Promise<string> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) throw new ApiError(413, "bad_request", "İstek gövdesi çok büyük (en fazla 1 MB)");
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new ApiError(413, "bad_request", "İstek gövdesi çok büyük (en fazla 1 MB)");
  return text;
}

export function adminApiRoute(operation: AnyOperation): AdminApiRouteHandler {
  const handler = async (request: Request, routeContext: RouteContext) => {
    const started = Date.now();
    const requestId = randomUUID();
    const ip = clientIp(request);
    const path = new URL(request.url).pathname;
    const headers: Record<string, string> = { "x-request-id": requestId };
    let auditTarget: { ownerId: string; tokenId: string; tokenName: string } | null = null;
    let idempotencyRecord: string | null = null;
    let replayed = false;
    let response: Response | undefined;
    let errorCode: string | undefined;

    try {
      const auth = await authenticateAdminApiRequest(request, ip);
      if (!auth.ok) {
        if (auth.token) auditTarget = { ownerId: auth.token.ownerId, tokenId: auth.token.id, tokenName: auth.token.name };
        throw auth.error;
      }
      const { context } = auth;
      auditTarget = { ownerId: context.owner.id, tokenId: context.token.id, tokenName: context.token.name };

      const limit = await checkRateLimit({
        key: `admin-api:${context.token.id}`,
        limit: context.token.rateLimitPerMinute,
        windowMs: RATE_WINDOW_MS,
      });
      headers["x-ratelimit-limit"] = String(context.token.rateLimitPerMinute);
      headers["x-ratelimit-remaining"] = String(Math.max(0, limit.remaining));
      if (!limit.allowed) {
        throw new ApiError(429, "rate_limited", "Çok fazla istek; biraz sonra tekrar deneyin", undefined, {
          "retry-after": String(limit.retryAfterSeconds ?? 60),
        });
      }

      if (operation.permission && !context.scopes.includes(operation.permission)) {
        throw new ApiError(403, "insufficient_scope", `Bu işlem için "${operation.permission}" yetkisi gerekli`, {
          required: operation.permission,
          granted: context.scopes,
        });
      }

      const params = parse(operation.params, await routeContext.params, "path");
      const query = parse(operation.query, Object.fromEntries(new URL(request.url).searchParams), "query");

      const hasBody = operation.method !== "GET";
      const rawBody = hasBody ? await readBody(request) : "";
      let bodyValue: unknown = undefined;
      if (operation.body) {
        try {
          bodyValue = rawBody.trim() ? JSON.parse(rawBody) : {};
        } catch {
          throw new ApiError(400, "invalid_json", "Gövde geçerli JSON değil");
        }
      }
      const body = parse(operation.body, bodyValue, "body");

      const idempotencyKey = request.headers.get(IDEMPOTENCY_HEADER);
      if (idempotencyKey !== null && operation.method === "POST") {
        const start = await beginIdempotentRequest({
          tokenId: context.token.id,
          key: idempotencyKey,
          method: operation.method,
          path,
          body: rawBody,
        });
        if (start.kind === "replay") {
          replayed = true;
          response = json(start.body, start.status, { ...headers, "idempotent-replayed": "true" });
          return response;
        }
        idempotencyRecord = start.recordId;
      }

      const result = await operation.handler({ request, context, params, query, body, requestId });
      const status = result.status ?? operation.successStatus ?? 200;
      const payload = result.raw ? result.data : result.pagination ? { data: result.data, pagination: result.pagination } : { data: result.data };
      // Store/replay exactly what the client sees (dates as strings, Decimals as strings).
      const serialized = JSON.parse(JSON.stringify(payload));
      if (idempotencyRecord) await completeIdempotentRequest(idempotencyRecord, status, serialized);
      response = json(serialized, status, headers);
      return response;
    } catch (caught) {
      const error =
        caught instanceof ApiError ? caught : new ApiError(500, "internal_error", "Beklenmeyen bir hata oluştu");
      if (!(caught instanceof ApiError)) {
        log.error("admin api handler failed", { operation: operation.id, path, requestId, error: caught });
      }
      errorCode = error.code;
      const body = {
        error: { code: error.code, message: error.message, ...(error.details !== undefined ? { details: error.details } : {}) },
        requestId,
      };
      if (idempotencyRecord) {
        if (error.status >= 500) await releaseIdempotentRequest(idempotencyRecord).catch(() => undefined);
        else await completeIdempotentRequest(idempotencyRecord, error.status, body).catch(() => undefined);
      }
      response = json(body, error.status, { ...headers, ...error.headers });
      return response;
    } finally {
      const status = response?.status ?? 500;
      if (auditTarget) {
        await auditAdminApiCall({
          ...auditTarget,
          operationId: operation.id,
          method: operation.method,
          endpoint: operation.path,
          path,
          status,
          ip,
          durationMs: Date.now() - started,
          requestId,
          errorCode,
          replayed,
        });
      } else {
        logUnattributedCall({ method: operation.method, path, status, ip, errorCode: errorCode ?? "unknown" });
      }
    }
  };
  return Object.assign(handler, { operation });
}
