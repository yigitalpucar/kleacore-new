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
import { clientIpFromHeaders, getRequestMeta, requestMetaFromHeaders, type RequestMeta } from "@/lib/request-meta";
import { recordLoginEvent, type LoginFailureReason } from "@/lib/security/login-events";

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
  return clientIpFromHeaders(request?.headers);
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

/** IP / UA / country of the sign-in request (the provider's Request, else next/headers). */
async function loginRequestMeta(request?: Request | null): Promise<RequestMeta> {
  if (request?.headers && (clientIpFromHeaders(request.headers) || request.headers.get("user-agent"))) {
    return requestMetaFromHeaders(request.headers);
  }
  return getRequestMeta();
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

  // Password attempts are audited here (also direct POSTs to the callback
  // route); token logins are recorded by the code that issued the token,
  // which knows how the second factor was satisfied.
  const audit = async (userId: string, reason?: LoginFailureReason, sessionVersion?: number) => {
    const meta = await loginRequestMeta(request);
    await recordLoginEvent({
      userId,
      email,
      success: !reason,
      reason,
      method: "password",
      ip: meta.ip ?? ip,
      userAgent: meta.userAgent,
      country: meta.country,
      sessionVersion,
    });
  };

  const user = await findUserByEmail(email);
  if (!user || user.status !== "ACTIVE") {
    await recordFailedLogin(email, ip);
    // Unknown addresses are not stored (no account to protect).
    if (user) await audit(user.id, "inactive");
    return null;
  }

  const isValid = await compare(password, user.password);
  if (!isValid) {
    await recordFailedLogin(email, ip);
    await audit(user.id, "bad_password");
    return null;
  }
  await clearFailedLogins(email);

  if (await userRequiresTwoFactor(user)) {
    await audit(user.id, "2fa_required");
    return null;
  }

  const authorized = await completeLogin(user);
  await audit(user.id, undefined, user.sessionVersion);
  return authorized;
}
