import { createHash, randomBytes } from "node:crypto";
import type { DataRequestStatus, DataRequestType, Prisma } from "@prisma/client";
import { findUserByEmail, normalizeEmail } from "@/lib/auth/email";
import { db } from "@/lib/db";
import { emitEvent } from "@/lib/events/emit";
import { getAppBaseUrl } from "@/lib/stripe";
import { generateDataRequestNumber } from "@/lib/utils/number-generators";
import { canTransition, computeDueAt, isOpenDataRequestStatus } from "./labels";

/**
 * KVKK data-subject request lifecycle (roadmap Faz 4):
 *
 *   panel (signed in)  ──────────────────────────────► RECEIVED ─► IN_PROGRESS ─► COMPLETED / REJECTED
 *   public form ─► PENDING_VERIFICATION ─(e-mail link)─┘
 *                         └─ link expired / withdrawn ─► CANCELLED
 *
 * The statutory 30 days (KVKK m.13) run from RECEIVED (`receivedAt`/`dueAt`).
 * Every result goes to the requester through `privacy.request_completed`.
 */

export const VERIFICATION_TTL_MS = 48 * 60 * 60 * 1000;
export const EXPORT_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function createRandomToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string) {
  return sha256(`kvkk:${token}`);
}

export function buildVerifyUrl(token: string) {
  return `${getAppBaseUrl()}/yasal/kvkk-basvuru/dogrula?token=${encodeURIComponent(token)}`;
}

export function buildExportDownloadUrl(token: string) {
  return `${getAppBaseUrl()}/yasal/kvkk-basvuru/indir?token=${encodeURIComponent(token)}`;
}

export class DataRequestError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "DataRequestError";
  }
}

export interface NewDataRequestInput {
  type: DataRequestType;
  email: string;
  name: string;
  phone?: string | null;
  details: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

function requestedEvent(request: {
  id: string;
  requestNumber: string;
  type: DataRequestType;
  userId: string | null;
  email: string;
  name: string;
  dueAt: Date;
  source: string;
}) {
  return {
    requestId: request.id,
    requestNumber: request.requestNumber,
    type: request.type,
    userId: request.userId,
    email: request.email,
    name: request.name,
    dueAt: request.dueAt,
    source: request.source === "panel" ? ("panel" as const) : ("form" as const),
  };
}

/** Signed-in customer: identity is the session, the deadline starts now. */
export async function createPanelDataRequest(
  userId: string,
  input: Omit<NewDataRequestInput, "email" | "name">,
  now = new Date()
) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, surname: true } });
  if (!user) throw new DataRequestError("NO_USER", "Hesap bulunamadı");

  const requestNumber = await generateDataRequestNumber();
  const dueAt = computeDueAt(now);
  return db.$transaction(async (tx) => {
    const request = await tx.dataRequest.create({
      data: {
        requestNumber,
        type: input.type,
        status: "RECEIVED",
        userId: user.id,
        email: user.email,
        name: `${user.name} ${user.surname}`.trim(),
        phone: input.phone ?? null,
        details: input.details,
        source: "panel",
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent?.slice(0, 512) ?? null,
        verifiedAt: now,
        receivedAt: now,
        dueAt,
        createdAt: now,
      },
    });
    await emitEvent(tx, "privacy.request_received", requestedEvent({ ...request, dueAt }), { actorId: user.id });
    return request;
  });
}

/**
 * Public form: stored as PENDING_VERIFICATION with a single-use e-mail link
 * (only its hash is kept). Returns the raw token for the verification mail.
 */
export async function createPublicDataRequest(input: NewDataRequestInput, now = new Date()) {
  const token = createRandomToken();
  const request = await db.dataRequest.create({
    data: {
      requestNumber: await generateDataRequestNumber(),
      type: input.type,
      status: "PENDING_VERIFICATION",
      email: normalizeEmail(input.email),
      name: input.name.trim(),
      phone: input.phone?.trim() || null,
      details: input.details,
      source: "form",
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent?.slice(0, 512) ?? null,
      verificationTokenHash: hashToken(token),
      verificationExpiresAt: new Date(now.getTime() + VERIFICATION_TTL_MS),
      createdAt: now,
    },
  });
  return { request, token };
}

export type ConfirmResult =
  | { ok: true; requestNumber: string; dueAt: Date }
  | { ok: false; reason: "invalid" | "expired" | "already_confirmed"; requestNumber?: string };

/**
 * Confirms the e-mail link: the request becomes RECEIVED (deadline starts)
 * and is linked to the account with that e-mail address, if any. The status
 * condition makes a double click / replay a no-op.
 */
export async function confirmDataRequest(token: string, now = new Date()): Promise<ConfirmResult> {
  if (!token || token.length > 200) return { ok: false, reason: "invalid" };
  const request = await db.dataRequest.findUnique({ where: { verificationTokenHash: hashToken(token) } });
  if (!request) return { ok: false, reason: "invalid" };
  if (request.status !== "PENDING_VERIFICATION") {
    return { ok: false, reason: "already_confirmed", requestNumber: request.requestNumber };
  }
  if (!request.verificationExpiresAt || request.verificationExpiresAt.getTime() <= now.getTime()) {
    await db.dataRequest.updateMany({
      where: { id: request.id, status: "PENDING_VERIFICATION" },
      data: { status: "CANCELLED", verificationTokenHash: null },
    });
    return { ok: false, reason: "expired", requestNumber: request.requestNumber };
  }

  const account = request.userId ? null : await findUserByEmail(request.email);
  const userId = request.userId ?? account?.id ?? null;
  const dueAt = computeDueAt(now);

  const confirmed = await db.$transaction(async (tx) => {
    const { count } = await tx.dataRequest.updateMany({
      where: { id: request.id, status: "PENDING_VERIFICATION" },
      data: {
        status: "RECEIVED",
        userId,
        verifiedAt: now,
        receivedAt: now,
        dueAt,
        verificationTokenHash: null,
      },
    });
    if (count !== 1) return false;
    await emitEvent(tx, "privacy.request_received", requestedEvent({ ...request, userId, dueAt }));
    return true;
  });

  return confirmed
    ? { ok: true, requestNumber: request.requestNumber, dueAt }
    : { ok: false, reason: "already_confirmed", requestNumber: request.requestNumber };
}

interface Actor {
  id: string;
  name: string;
}

export async function addDataRequestNote(requestId: string, actor: Actor, body: string) {
  const text = body.trim();
  if (!text) throw new DataRequestError("EMPTY_NOTE", "Not boş olamaz");
  return db.dataRequestNote.create({
    data: { requestId, authorId: actor.id, authorName: actor.name, body: text.slice(0, 5000) },
  });
}

/** Manual status change (RECEIVED ⇄ IN_PROGRESS, withdrawing an unverified request). */
export async function setDataRequestStatus(requestId: string, to: DataRequestStatus, actor: Actor) {
  if (to === "COMPLETED" || to === "REJECTED") {
    throw new DataRequestError("USE_RESPOND", "Sonuçlandırma yanıt formuyla yapılır");
  }
  const request = await db.dataRequest.findUnique({ where: { id: requestId }, select: { status: true } });
  if (!request) throw new DataRequestError("NOT_FOUND", "Başvuru bulunamadı");
  if (!canTransition(request.status, to)) {
    throw new DataRequestError("BAD_TRANSITION", "Bu durum değişikliğine izin verilmiyor");
  }
  const { count } = await db.dataRequest.updateMany({
    where: { id: requestId, status: request.status },
    data: {
      status: to,
      handledById: actor.id,
      ...(to === "CANCELLED" ? { verificationTokenHash: null } : {}),
    },
  });
  if (count !== 1) throw new DataRequestError("CONFLICT", "Başvuru bu arada değişti; sayfayı yenileyin");
}

export interface RespondInput {
  outcome: "COMPLETED" | "REJECTED";
  responseText: string;
}

/**
 * Closes an open request and sends the response (privacy.request_completed).
 * EXPORT + COMPLETED needs a generated, not yet downloaded export: a fresh
 * one-time download token (7 days) goes into the mail. ERASURE + COMPLETED
 * for a known account needs the reviewed anonymisation to have been applied.
 */
export async function respondToDataRequest(requestId: string, input: RespondInput, actor: Actor, now = new Date()) {
  const responseText = input.responseText.trim();
  if (responseText.length < 10) throw new DataRequestError("SHORT_RESPONSE", "Yanıt metni çok kısa");

  const request = await db.dataRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new DataRequestError("NOT_FOUND", "Başvuru bulunamadı");
  if (!isOpenDataRequestStatus(request.status)) {
    throw new DataRequestError("NOT_OPEN", "Başvuru açık değil");
  }

  let downloadToken: string | null = null;
  const data: Prisma.DataRequestUpdateManyMutationInput = {
    status: input.outcome,
    responseText,
    respondedAt: now,
    completedAt: now,
    handledById: actor.id,
  };

  if (input.outcome === "COMPLETED" && request.type === "EXPORT") {
    if (!request.exportStorageKey || request.exportDownloadedAt) {
      throw new DataRequestError("NO_EXPORT", "Önce veri kopyasını hazırlayın");
    }
    downloadToken = createRandomToken();
    data.exportTokenHash = hashToken(downloadToken);
    data.exportExpiresAt = new Date(now.getTime() + EXPORT_LINK_TTL_MS);
  }
  if (input.outcome === "COMPLETED" && request.type === "ERASURE" && request.userId && !request.anonymizedAt) {
    throw new DataRequestError("NOT_ANONYMIZED", "Önce anonimleştirmeyi önizleyip uygulayın");
  }

  await db.$transaction(async (tx) => {
    const { count } = await tx.dataRequest.updateMany({
      where: { id: requestId, status: request.status },
      data,
    });
    if (count !== 1) throw new DataRequestError("CONFLICT", "Başvuru bu arada değişti; sayfayı yenileyin");
    await emitEvent(
      tx,
      "privacy.request_completed",
      {
        requestId: request.id,
        requestNumber: request.requestNumber,
        type: request.type,
        userId: request.userId,
        email: request.email,
        name: request.name,
        outcome: input.outcome,
        responseText,
        ...(downloadToken
          ? { downloadUrl: buildExportDownloadUrl(downloadToken), downloadExpiresAt: data.exportExpiresAt as Date }
          : {}),
      },
      { actorId: actor.id }
    );
  });
}

/** Unverified public requests older than the link lifetime → CANCELLED. */
export async function cancelExpiredVerifications(now = new Date()) {
  const { count } = await db.dataRequest.updateMany({
    where: { status: "PENDING_VERIFICATION", verificationExpiresAt: { lte: now } },
    data: { status: "CANCELLED", verificationTokenHash: null },
  });
  return count;
}
