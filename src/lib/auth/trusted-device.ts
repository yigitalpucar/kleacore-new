import { createHash, createHmac, randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { timingSafeStringEqual } from "@/lib/secrets/compare";
import { deviceFingerprint } from "@/lib/security/device";

/**
 * "Bu cihazı 30 gün hatırla" on the 2FA step.
 *
 * The browser gets an httpOnly cookie (one per account, name derived from the
 * user id) holding an HMAC-signed payload { uid, did, sec, exp }. It only
 * replaces the TOTP step inside `loginAction`, i.e. AFTER the password (and
 * captcha policy) was checked; the credentials provider never sees it, so the
 * Faz 0 guarantees (password alone never signs a 2FA user in; only a
 * single-use loginToken does) are unchanged.
 *
 * A cookie skips 2FA only when ALL of these hold:
 *   - the signature is valid (AUTH_SECRET, own domain prefix — a 2FA
 *     challenge or login token can never be read as one, and vice versa);
 *   - payload user id = the user who just entered the right password;
 *   - a TrustedDevice row exists for sha256(secret) with the same id and user,
 *     not revoked and not expired;
 *   - the row's sessionVersion = the user's current one (a password change,
 *     reset or "diğer oturumları kapat" revokes every device);
 *   - the browser family (UA family) matches the one that was trusted.
 */

export const TRUSTED_DEVICE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const COOKIE_PREFIX = "kc_td_";
const SIGNING_DOMAIN = "kleacore:trusted-device:v1:";

interface TrustedDevicePayload {
  purpose: "trusted_device";
  uid: string;
  did: string;
  sec: string;
  exp: number;
}

function signingSecret() {
  const secret =
    process.env.AUTH_SECRET?.trim() || process.env.ENCRYPTION_KEY?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) throw new Error("AUTH_SECRET is required for trusted devices");
  return secret;
}

function sign(encoded: string) {
  return createHmac("sha256", signingSecret()).update(`${SIGNING_DOMAIN}${encoded}`).digest("base64url");
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/** Cookie name for this account (several accounts may be trusted on one browser). */
export function trustedDeviceCookieName(userId: string) {
  return `${COOKIE_PREFIX}${sha256(`td-cookie:${userId}`).slice(0, 16)}`;
}

export function encodeTrustedDeviceCookie(payload: Omit<TrustedDevicePayload, "purpose">) {
  const encoded = Buffer.from(JSON.stringify({ purpose: "trusted_device", ...payload })).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function decodeTrustedDeviceCookie(value: string | null | undefined): TrustedDevicePayload | null {
  if (!value || value.length > 1024) return null;
  const [encoded, signature, extra] = value.split(".");
  if (!encoded || !signature || extra !== undefined) return null;
  if (!timingSafeStringEqual(signature, sign(encoded))) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Record<string, unknown>;
    if (
      payload?.purpose !== "trusted_device" ||
      typeof payload.uid !== "string" ||
      typeof payload.did !== "string" ||
      typeof payload.sec !== "string" ||
      typeof payload.exp !== "number" ||
      !payload.uid ||
      !payload.did ||
      payload.sec.length < 32
    ) {
      return null;
    }
    return payload as unknown as TrustedDevicePayload;
  } catch {
    return null;
  }
}

export interface DeviceContext {
  userAgent: string | null;
  ip: string | null;
  country?: string | null;
}

/** Stores a trusted device and returns the cookie to set. Call only right after a verified second factor. */
export async function createTrustedDevice(
  user: { id: string; sessionVersion: number },
  ctx: DeviceContext,
  now = new Date()
) {
  const secret = randomBytes(32).toString("base64url");
  const fp = deviceFingerprint({ userAgent: ctx.userAgent, ip: ctx.ip, country: ctx.country });
  const expiresAt = new Date(now.getTime() + TRUSTED_DEVICE_TTL_MS);
  const row = await db.trustedDevice.create({
    data: {
      userId: user.id,
      secretHash: sha256(secret),
      deviceHash: fp.browserHash,
      label: fp.uaFamily,
      ipAddress: ctx.ip?.slice(0, 64) ?? null,
      sessionVersion: user.sessionVersion,
      expiresAt,
      createdAt: now,
    },
    select: { id: true },
  });
  return {
    deviceId: row.id,
    cookieName: trustedDeviceCookieName(user.id),
    cookieValue: encodeTrustedDeviceCookie({ uid: user.id, did: row.id, sec: secret, exp: expiresAt.getTime() }),
    expiresAt,
  };
}

export type TrustedDeviceCheck =
  | { ok: true; deviceId: string }
  | {
      ok: false;
      reason: "missing" | "invalid" | "other_user" | "expired" | "unknown" | "revoked" | "session_changed" | "browser_changed";
    };

/**
 * Whether this cookie lets `user` (who has just proven the password) skip
 * the TOTP step. Marks the device as used when it does.
 */
export async function checkTrustedDevice(
  user: { id: string; sessionVersion: number },
  cookieValue: string | null | undefined,
  ctx: Pick<DeviceContext, "userAgent">,
  now = new Date()
): Promise<TrustedDeviceCheck> {
  if (!cookieValue) return { ok: false, reason: "missing" };
  const payload = decodeTrustedDeviceCookie(cookieValue);
  if (!payload) return { ok: false, reason: "invalid" };
  if (payload.uid !== user.id) return { ok: false, reason: "other_user" };
  if (payload.exp <= now.getTime()) return { ok: false, reason: "expired" };

  const row = await db.trustedDevice.findUnique({
    where: { secretHash: sha256(payload.sec) },
    select: { id: true, userId: true, deviceHash: true, sessionVersion: true, expiresAt: true, revokedAt: true },
  });
  if (!row || row.id !== payload.did || row.userId !== user.id) return { ok: false, reason: "unknown" };
  if (row.revokedAt) return { ok: false, reason: "revoked" };
  if (row.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" };
  if (row.sessionVersion !== user.sessionVersion) return { ok: false, reason: "session_changed" };

  const browserHash = deviceFingerprint({ userAgent: ctx.userAgent, ip: null }).browserHash;
  if (!timingSafeStringEqual(row.deviceHash, browserHash)) return { ok: false, reason: "browser_changed" };

  await db.trustedDevice.update({ where: { id: row.id }, data: { lastUsedAt: now } });
  return { ok: true, deviceId: row.id };
}

/** Devices still able to skip 2FA (for the "Güvenlik" tab). */
export async function listTrustedDevices(user: { id: string; sessionVersion: number }, now = new Date()) {
  return db.trustedDevice.findMany({
    where: { userId: user.id, revokedAt: null, expiresAt: { gt: now }, sessionVersion: user.sessionVersion },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, ipAddress: true, createdAt: true, lastUsedAt: true, expiresAt: true },
  });
}

export async function revokeTrustedDevice(userId: string, deviceId: string, now = new Date()) {
  const { count } = await db.trustedDevice.updateMany({
    where: { id: deviceId, userId, revokedAt: null },
    data: { revokedAt: now },
  });
  return count === 1;
}

export async function revokeAllTrustedDevices(
  userId: string,
  client: Prisma.TransactionClient | typeof db = db,
  now = new Date()
) {
  const { count } = await client.trustedDevice.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: now },
  });
  return count;
}
