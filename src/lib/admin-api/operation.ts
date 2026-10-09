/**
 * One admin API operation = one method on one path, with its permission,
 * zod schemas (params / query / body / response — the OpenAPI document is
 * generated from them) and handler. Route files export
 * `adminApiRoute(operation)`; the permission coverage test checks every
 * route maps to an operation with a valid permission.
 */
import type { z } from "zod/v4";
import type { Permission } from "@/lib/auth/permissions";
import type { AdminApiContext } from "./auth";
import type { Pagination } from "./pagination";

export type HttpMethod = "GET" | "POST" | "PATCH";

export interface OperationInput<P, Q, B> {
  request: Request;
  context: AdminApiContext;
  params: P;
  query: Q;
  body: B;
  requestId: string;
}

export interface OperationResult {
  data: unknown;
  pagination?: Pagination;
  /** Defaults to the operation's successStatus. */
  status?: number;
  /** Send `data` as the whole body (no envelope), e.g. the OpenAPI document. */
  raw?: boolean;
}

export interface AdminApiOperation<
  P extends z.ZodType = z.ZodType,
  Q extends z.ZodType = z.ZodType,
  B extends z.ZodType = z.ZodType,
> {
  /** Stable operationId (OpenAPI, audit log, tool names). */
  id: string;
  method: HttpMethod;
  /** Path under /api/admin/v1, OpenAPI style: /customers/{id}. */
  path: string;
  tag: string;
  summary: string;
  description?: string;
  /** Required permission; null = any valid token (introspection, docs). */
  permission: Permission | null;
  params?: P;
  query?: Q;
  body?: B;
  /** Schema of `data` (for list operations: of one item). */
  response: z.ZodType;
  list?: boolean;
  successStatus?: number;
  handler: (input: OperationInput<z.output<P>, z.output<Q>, z.output<B>>) => Promise<OperationResult>;
}

/** Identity helper that keeps the schema types for the handler. */
export function defineOperation<P extends z.ZodType, Q extends z.ZodType, B extends z.ZodType>(
  operation: AdminApiOperation<P, Q, B>
): AdminApiOperation<P, Q, B> {
  return operation;
}

export type AnyOperation = AdminApiOperation<any, any, any>;
