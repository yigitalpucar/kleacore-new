import { compare } from "bcryptjs";
import { findUserByEmail, normalizeEmail } from "@/lib/auth/email";
import { consumeLoginToken } from "@/lib/auth/login-token";
import {
  checkLoginCaptcha,
  clearFailedLogins,
  recordFailedLogin,
} from "@/lib/auth/login-captcha";
import type { AppRole } from "@/lib/auth/permissions";
import { userRequiresTwoFactor } from "@/lib/auth/two-factor-settings";
import { db } from "@/lib/db";
import { checkRateLimit, normalizeRateLimitKey } from "@/lib/rate-limit";

const WINDOW_MS = 15 * 60 * 1000;
const EMAIL_LIMIT = 10;
const IP_LIMIT = 40;

export type AuthorizedUser = {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  sessionVersion: number;
};

function readCredential(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function getClientIp(request?: Request | null) {
  const headers = request?.headers;
  if (!headers) return null;

  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || null;
}

async function isRateLimited(email: string, ip: string | null) {
  const byEmail = await checkRateLimit({
    key: `auth-credentials:email:${normalizeRateLimitKey(email)}`,
    limit: EMAIL_LIMIT,
    windowMs: WINDOW_MS,
  });
  if (!byEmail.allowed) return true;

  if (ip) {
    const byIp = await checkRateLimit({
      key: `auth-credentials:ip:${normalizeRateLimitKey(ip)}`,
      limit: IP_LIMIT,
      windowMs: WINDOW_MS,
    });
    if (!byIp.allowed) return true;
  }

  return false;
}

async function completeLogin(user: {
  id: string;
  email: string;
  name: string;
  surname: string;
  role: AppRole;
  sessionVersion: number;
}): Promise<AuthorizedUser> {
  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    id: user.id,
    email: user.email,
    name: `${user.name} ${user.surname}`.trim(),
    role: user.role,
    sessionVersion: user.sessionVersion,
  };
}

/**
 * Credentials provider `authorize`. This is reachable directly via
 * POST /api/auth/callback/credentials, so it must enforce everything itself:
 * rate limits, account status and the second factor.
 *
 * Accepts either email + password (only for users without 2FA) or email +
 * a single-use `loginToken` issued after the second factor was verified.
 * After repeated failures a password attempt also needs `turnstileToken`
 * (or the `captchaProof` loginAction passes after verifying it).
 */
export async function authorizeCredentials(
  credentials: Partial<Record<string, unknown>> | undefined,
  request?: Request | null
): Promise<AuthorizedUser | null> {
  const email = normalizeEmail(readCredential(credentials?.email));
  if (!email) return null;

  const ip = getClientIp(request);
  if (await isRateLimited(email, ip)) {
    return null;
  }

  const loginToken = readCredential(credentials?.loginToken);
  if (loginToken) {
    // Issued only after password + second factor were verified: no captcha.
    const user = await findUserByEmail(email);
    if (!user || user.status !== "ACTIVE") return null;
    if (!(await consumeLoginToken(loginToken, user))) return null;
    return completeLogin(user);
  }

  const password = readCredential(credentials?.password);
  if (!password) return null;

  const captchaPassed = await checkLoginCaptcha({
    email,
    ip,
    turnstileToken: readCredential(credentials?.turnstileToken) || null,
    captchaProof: readCredential(credentials?.captchaProof) || null,
  });
  if (!captchaPassed) return null;

  const user = await findUserByEmail(email);
  if (!user || user.status !== "ACTIVE") {
    await recordFailedLogin(email, ip);
    return null;
  }

  const isValid = await compare(password, user.password);
  if (!isValid) {
    await recordFailedLogin(email, ip);
    return null;
  }
  await clearFailedLogins(email);

  if (await userRequiresTwoFactor(user)) {
    return null;
  }

  return completeLogin(user);
}
