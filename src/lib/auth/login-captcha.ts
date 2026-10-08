import { createHmac, timingSafeEqual } from "node:crypto";
import { normalizeEmail } from "@/lib/auth/email";
import {
  checkRateLimit,
  normalizeRateLimitKey,
  peekRateLimit,
  resetRateLimit,
} from "@/lib/rate-limit";
import { verifyTurnstileToken } from "@/lib/security/turnstile";

/**
 * Turnstile on login, but only after repeated failures: the first
 * {@link getLoginCaptchaThreshold} wrong passwords (per e-mail or per IP,
 * within 15 minutes) need no captcha, after that every password attempt must
 * carry a valid Turnstile token. Counters live in the shared RateLimitBucket
 * table (keys `login-failed:*`). A correct password clears the e-mail counter.
 *
 * Enforced in both `loginAction` and the credentials provider (which is
 * reachable directly via POST /api/auth/callback/credentials). Because a
 * Turnstile token is single-use, `loginAction` hands the provider a short-lived
 * HMAC proof that it already verified the captcha for this e-mail.
 */

export const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_THRESHOLD = 3;
const PROOF_TTL_MS = 2 * 60 * 1000;
export const LOGIN_CAPTCHA_ACTION = "login";

export function getLoginCaptchaThreshold() {
  const parsed = Number.parseInt(process.env.LOGIN_CAPTCHA_AFTER_FAILURES ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_THRESHOLD;
}

function emailKey(email: string) {
  return `login-failed:email:${normalizeRateLimitKey(normalizeEmail(email))}`;
}

function ipKey(ip: string) {
  return `login-failed:ip:${normalizeRateLimitKey(ip)}`;
}

export async function isLoginCaptchaRequired(email: string, ip: string | null) {
  const threshold = getLoginCaptchaThreshold();
  if ((await peekRateLimit(emailKey(email))) >= threshold) return true;
  return ip ? (await peekRateLimit(ipKey(ip))) >= threshold : false;
}

export async function recordFailedLogin(email: string, ip: string | null) {
  // The limit is never reached; checkRateLimit is only used as a windowed counter.
  const options = { limit: Number.MAX_SAFE_INTEGER, windowMs: LOGIN_FAILURE_WINDOW_MS };
  await checkRateLimit({ key: emailKey(email), ...options });
  if (ip) await checkRateLimit({ key: ipKey(ip), ...options });
}

export async function clearFailedLogins(email: string) {
  await resetRateLimit(emailKey(email));
}

function proofSecret() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required");
  return secret;
}

function sign(email: string, expiresAt: number) {
  return createHmac("sha256", proofSecret())
    .update(`login-captcha:${normalizeEmail(email)}:${expiresAt}`)
    .digest("base64url");
}

/** Server-internal proof that the captcha for `email` was verified just now. */
export function createLoginCaptchaProof(email: string, now = Date.now()) {
  const expiresAt = now + PROOF_TTL_MS;
  return `${expiresAt}.${sign(email, expiresAt)}`;
}

export function verifyLoginCaptchaProof(proof: string, email: string, now = Date.now()) {
  const [expiresRaw, signature] = proof.split(".");
  const expiresAt = Number(expiresRaw);
  if (!signature || !Number.isFinite(expiresAt) || expiresAt <= now) return false;

  const expected = Buffer.from(sign(email, expiresAt));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * Passes when no captcha is required, or when the request carries a valid
 * proof or Turnstile token.
 */
export async function checkLoginCaptcha(input: {
  email: string;
  ip: string | null;
  turnstileToken?: string | null;
  captchaProof?: string | null;
}) {
  if (!(await isLoginCaptchaRequired(input.email, input.ip))) return true;
  if (input.captchaProof && verifyLoginCaptchaProof(input.captchaProof, input.email)) return true;

  // Without a token this still bypasses when Turnstile is unconfigured outside
  // production, and fails (missing-token / misconfigured) otherwise.
  const result = await verifyTurnstileToken(input.turnstileToken, {
    remoteIp: input.ip,
    action: LOGIN_CAPTCHA_ACTION,
  });
  return result.success;
}
