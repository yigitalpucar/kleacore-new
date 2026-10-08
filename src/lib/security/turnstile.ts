import { createLogger } from "@/lib/logger";

/**
 * Cloudflare Turnstile server-side verification.
 *
 * Keys come from the environment (TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY)
 * and fall back to the admin settings (turnstile_site_key /
 * turnstile_secret_key, the secret stored encrypted). Behaviour when the keys
 * are missing:
 *   - production: fail closed — every protected form is rejected and an
 *     error is logged, so a misconfigured deploy is loud, not silently open;
 *   - anywhere else: bypass (verification succeeds) with a warning, so local
 *     development and tests work without Cloudflare. Locally prefer the
 *     official always-pass test keys below.
 */

const log = createLogger("security.turnstile");

export const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
export const TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js";
/** Form field the widget writes its token into. */
export const TURNSTILE_RESPONSE_FIELD = "cf-turnstile-response";
export const TURNSTILE_TIMEOUT_MS = 5000;

/**
 * Cloudflare's official test keys (https://developers.cloudflare.com/turnstile/troubleshooting/testing/).
 * Never valid on a real domain; use them in .env for local development.
 */
export const TURNSTILE_TEST_KEYS = {
  siteKeyAlwaysPasses: "1x00000000000000000000AA",
  siteKeyAlwaysBlocks: "2x00000000000000000000AB",
  siteKeyForcesInteractive: "3x00000000000000000000FF",
  secretAlwaysPasses: "1x0000000000000000000000000000000AA",
  secretAlwaysFails: "2x0000000000000000000000000000000AA",
  secretTokenSpent: "3x0000000000000000000000000000000AA",
} as const;

export interface TurnstileKeys {
  siteKey: string | null;
  secretKey: string | null;
}

export type TurnstileFailureReason =
  | "missing-token"
  | "invalid-token"
  | "action-mismatch"
  | "timeout"
  | "network-error"
  | "misconfigured";

export type TurnstileVerifyResult =
  | { success: true; bypassed: boolean }
  | { success: false; reason: TurnstileFailureReason; errorCodes: string[] };

export interface VerifyTurnstileOptions {
  remoteIp?: string | null;
  /** Expected widget `action`; a token minted for another form is rejected. */
  action?: string;
  timeoutMs?: number;
  /** Injected in tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /** Injected in tests; defaults to {@link getTurnstileKeys}. */
  keys?: TurnstileKeys;
}

/** User-facing message for any Turnstile failure. */
export const TURNSTILE_ERROR_MESSAGE =
  "Güvenlik doğrulaması tamamlanamadı. Lütfen doğrulamayı yenileyip tekrar deneyin.";

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function readSetting(key: string) {
  try {
    const { getSettingByKey } = await import("@/lib/dal/settings");
    return clean((await getSettingByKey(key))?.value);
  } catch (error) {
    log.warn("Turnstile setting could not be read", { key, error: String(error) });
    return null;
  }
}

export async function getTurnstileKeys(): Promise<TurnstileKeys> {
  const envSite = clean(process.env.TURNSTILE_SITE_KEY);
  const envSecret = clean(process.env.TURNSTILE_SECRET_KEY);
  if (envSite && envSecret) return { siteKey: envSite, secretKey: envSecret };

  return {
    siteKey: envSite ?? (await readSetting("turnstile_site_key")),
    secretKey: envSecret ?? (await readSetting("turnstile_secret_key")),
  };
}

/** Public site key for the widget, or null when Turnstile is not configured. */
export async function getTurnstileSiteKey() {
  const keys = await getTurnstileKeys();
  return keys.siteKey && keys.secretKey ? keys.siteKey : null;
}

function isProduction() {
  return process.env.NODE_ENV === "production";
}

export async function verifyTurnstileToken(
  token: string | null | undefined,
  options: VerifyTurnstileOptions = {}
): Promise<TurnstileVerifyResult> {
  const keys = options.keys ?? (await getTurnstileKeys());

  if (!keys.secretKey || !keys.siteKey) {
    if (isProduction()) {
      log.error("Turnstile keys are not configured; rejecting request (fail closed)", {
        action: options.action,
      });
      return { success: false, reason: "misconfigured", errorCodes: [] };
    }
    log.warn("Turnstile keys are not configured; verification bypassed (non-production only)", {
      action: options.action,
    });
    return { success: true, bypassed: true };
  }

  const response = typeof token === "string" ? token.trim() : "";
  // Cloudflare tokens are at most 2048 characters.
  if (!response || response.length > 2048) {
    return { success: false, reason: "missing-token", errorCodes: [] };
  }

  const body = new URLSearchParams({ secret: keys.secretKey, response });
  if (options.remoteIp) body.set("remoteip", options.remoteIp);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? TURNSTILE_TIMEOUT_MS);
  const fetchImpl = options.fetchImpl ?? fetch;

  let payload: {
    success?: boolean;
    action?: string;
    hostname?: string;
    "error-codes"?: string[];
  };
  try {
    const res = await fetchImpl(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body,
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      log.warn("Turnstile siteverify returned HTTP error", { status: res.status });
      return { success: false, reason: "network-error", errorCodes: [`http-${res.status}`] };
    }
    payload = await res.json();
  } catch (error) {
    const aborted = controller.signal.aborted;
    log.warn("Turnstile siteverify request failed", { aborted, error: String(error) });
    return { success: false, reason: aborted ? "timeout" : "network-error", errorCodes: [] };
  } finally {
    clearTimeout(timeout);
  }

  const errorCodes = Array.isArray(payload["error-codes"]) ? payload["error-codes"] : [];
  if (payload.success !== true) {
    return { success: false, reason: "invalid-token", errorCodes };
  }

  // Test keys report action "" — only enforce the action for real tokens.
  if (options.action && payload.action && payload.action !== options.action) {
    return { success: false, reason: "action-mismatch", errorCodes };
  }

  return { success: true, bypassed: false };
}

/** Reads the widget token from a submitted form. */
export function readTurnstileToken(formData: FormData) {
  const value = formData.get(TURNSTILE_RESPONSE_FIELD);
  return typeof value === "string" ? value : null;
}
