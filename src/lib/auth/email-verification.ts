import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";

/**
 * E-mail verification for self-service sign-ups.
 *
 * The link carries 32 random bytes; only their sha256 is stored, so a database
 * leak does not reveal usable links (same scheme as password reset). Tokens
 * expire after {@link EMAIL_VERIFICATION_TTL_HOURS} and are single-use.
 * Unverified customers can log in but cannot place orders or pay
 * ({@link getPurchaseBlock}).
 */

const log = createLogger("auth.email-verification");

export const EMAIL_VERIFICATION_TTL_HOURS = 24;
export const EMAIL_NOT_VERIFIED_CODE = "EMAIL_NOT_VERIFIED" as const;
export const EMAIL_NOT_VERIFIED_MESSAGE =
  "Sipariş verebilmek ve ödeme yapabilmek için önce e-posta adresinizi doğrulamanız gerekiyor.";

type Client = Prisma.TransactionClient | typeof db;

export function hashVerificationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getAppBaseUrl() {
  return (
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

export function buildVerifyUrl(token: string) {
  return `${getAppBaseUrl()}/musteri/dogrula?token=${encodeURIComponent(token)}`;
}

/**
 * Creates a fresh token for the user, invalidating earlier unused ones, and
 * returns the raw token (only ever sent in the e-mail).
 */
export async function createEmailVerificationToken(
  userId: string,
  { client = db, now = new Date() }: { client?: Client; now?: Date } = {}
) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(now.getTime() + EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000);

  await client.emailVerificationToken.deleteMany({ where: { userId, usedAt: null } });
  await client.emailVerificationToken.create({
    data: { userId, tokenHash: hashVerificationToken(token), expiresAt },
  });

  return { token, expiresAt };
}

/**
 * Issues a token and queues the "auth.verify-email" notification. Never
 * throws: a failed send must not fail the sign-up (the user can resend).
 */
export async function sendVerificationEmail(userId: string) {
  try {
    const { token } = await createEmailVerificationToken(userId);
    const verifyUrl = buildVerifyUrl(token);
    if (process.env.NODE_ENV !== "production") {
      log.info("Verification link (development only)", { userId, verifyUrl });
    }
    const { sendNotification } = await import("@/lib/notifications/send");
    await sendNotification({
      userId,
      template: "auth.verify-email",
      data: { verifyUrl, expiresInHours: String(EMAIL_VERIFICATION_TTL_HOURS) },
    });
    return { sent: true as const };
  } catch (error) {
    log.error("Verification e-mail could not be queued", { userId, error: String(error) });
    return { sent: false as const };
  }
}

export type ConsumeVerificationResult =
  | { ok: true; alreadyVerified: boolean }
  | { ok: false; reason: "invalid" | "expired" | "used" };

/**
 * Validates and consumes a verification token. Consuming is atomic
 * (`usedAt IS NULL` guard), so two parallel clicks cannot both succeed. A link
 * that was already used for an account that is verified reports success with
 * `alreadyVerified` (mail scanners often open links before the user does).
 */
export async function consumeEmailVerificationToken(
  rawToken: string,
  { now = new Date() }: { now?: Date } = {}
): Promise<ConsumeVerificationResult> {
  const token = rawToken.trim();
  if (!/^[a-f0-9]{64}$/.test(token)) return { ok: false, reason: "invalid" };

  const record = await db.emailVerificationToken.findUnique({
    where: { tokenHash: hashVerificationToken(token) },
    include: { user: { select: { id: true, emailVerifiedAt: true } } },
  });
  if (!record) return { ok: false, reason: "invalid" };

  if (record.usedAt) {
    return record.user.emailVerifiedAt
      ? { ok: true, alreadyVerified: true }
      : { ok: false, reason: "used" };
  }
  if (record.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" };

  return db.$transaction(async (tx) => {
    const claimed = await tx.emailVerificationToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) return { ok: false as const, reason: "used" as const };

    await tx.user.updateMany({
      where: { id: record.userId, emailVerifiedAt: null },
      data: { emailVerifiedAt: now },
    });
    await tx.emailVerificationToken.deleteMany({
      where: { userId: record.userId, usedAt: null },
    });
    return { ok: true as const, alreadyVerified: Boolean(record.user.emailVerifiedAt) };
  });
}

export async function isEmailVerified(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { emailVerifiedAt: true },
  });
  return Boolean(user?.emailVerifiedAt);
}

/**
 * Guard for every order/payment entry point: returns the error result to send
 * back, or null when the user may proceed.
 */
export async function getPurchaseBlock(userId: string) {
  if (await isEmailVerified(userId)) return null;
  return {
    success: false as const,
    error: EMAIL_NOT_VERIFIED_MESSAGE,
    code: EMAIL_NOT_VERIFIED_CODE,
  };
}
