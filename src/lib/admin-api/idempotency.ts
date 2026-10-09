/**
 * `Idempotency-Key` for admin API POSTs (Stripe-style). The first request's
 * response (2xx/4xx) is stored for 24 h per token + key and replayed for a
 * retry with the same method, path and body (`Idempotent-Replayed: true`).
 * The same key with a different request → 422; while the first request is
 * still running → 409. 5xx answers are not stored, so the client may retry.
 */
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError } from "./errors";

export const IDEMPOTENCY_HEADER = "idempotency-key";
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const KEY_PATTERN = /^[\x21-\x7e]{1,255}$/;

export function requestFingerprint(method: string, path: string, body: string) {
  return createHash("sha256").update(`${method}\n${path}\n${body}`).digest("hex");
}

export type IdempotencyStart =
  | { kind: "new"; recordId: string }
  | { kind: "replay"; status: number; body: unknown };

export async function beginIdempotentRequest(input: {
  tokenId: string;
  key: string;
  method: string;
  path: string;
  body: string;
}): Promise<IdempotencyStart> {
  if (!KEY_PATTERN.test(input.key)) {
    throw new ApiError(400, "idempotency_key_invalid", "Idempotency-Key 1–255 görünür ASCII karakter olmalı");
  }
  const requestHash = requestFingerprint(input.method, input.path, input.body);
  const now = new Date();

  // Expired keys of this token are free again.
  await db.adminApiIdempotencyKey.deleteMany({ where: { tokenId: input.tokenId, expiresAt: { lte: now } } });

  try {
    const record = await db.adminApiIdempotencyKey.create({
      data: {
        tokenId: input.tokenId,
        key: input.key,
        method: input.method,
        path: input.path,
        requestHash,
        expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
      },
      select: { id: true },
    });
    return { kind: "new", recordId: record.id };
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
  }

  const existing = await db.adminApiIdempotencyKey.findUnique({
    where: { tokenId_key: { tokenId: input.tokenId, key: input.key } },
  });
  if (!existing) {
    // Released (5xx) between our insert and this read: let the client retry.
    throw new ApiError(409, "idempotency_key_in_use", "Bu Idempotency-Key ile bir istek hâlâ işleniyor; tekrar deneyin");
  }
  if (existing.requestHash !== requestHash) {
    throw new ApiError(
      422,
      "idempotency_key_reused",
      "Bu Idempotency-Key farklı bir istekle (yöntem, yol veya gövde) kullanılmış"
    );
  }
  if (existing.completedAt === null || existing.responseStatus === null) {
    throw new ApiError(409, "idempotency_key_in_use", "Bu Idempotency-Key ile bir istek hâlâ işleniyor; tekrar deneyin");
  }
  return { kind: "replay", status: existing.responseStatus, body: existing.responseBody };
}

export async function completeIdempotentRequest(recordId: string, status: number, body: unknown) {
  await db.adminApiIdempotencyKey.update({
    where: { id: recordId },
    data: { responseStatus: status, responseBody: body as Prisma.InputJsonValue, completedAt: new Date() },
  });
}

/** Server error: forget the key so a retry runs the request again. */
export async function releaseIdempotentRequest(recordId: string) {
  await db.adminApiIdempotencyKey.deleteMany({ where: { id: recordId, completedAt: null } });
}
