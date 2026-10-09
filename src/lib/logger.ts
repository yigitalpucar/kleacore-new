/**
 * Minimal structured logger: one JSON object per line on stdout/stderr so
 * Dokploy/Docker logs stay greppable (`docker logs app | grep '"level":"error"'`).
 */
type Level = "info" | "warn" | "error";
type Context = Record<string, unknown>;

const REDACTED = "[REDACTED]";

// Context keys whose values never belong in logs (card data, secrets, and the
// gateway tokens of stored cards — utoken/ctoken/cardToken charge a card).
// Faz 4: any "...token" (admin API / login / KVKK export download / e-mail
// verification / unsubscribe tokens), trusted-device cookies and KYC
// document storage keys.
const SENSITIVE_KEY =
  /(card.?number|^pan$|cvv|cvc|cvv2|security.?code|card.?expire|expiry|password|passwd|secret|hashdata|authorization|^md$|^cookie$|utoken|ctoken|card.?token|card.?user.?key|gateway.?customer.?ref|token$|trusted.?device.?cookie|unsubscribe.?(url|link)|download.?url)/i;

// cPanel/WHM single sign-on URLs: the cpsess token and the session parameter
// are a live login (create_user_session); never let one reach the logs.
const PANEL_SESSION = /(\/cpsess)\d+|([?&]session=)[^&\s"']+/gi;

// Admin API tokens and customer API keys (kc_admin_… / kc_live_…): the prefix stays for debugging.
const API_SECRET = /\b(kc_(?:admin|live)_)[A-Za-z0-9_-]{8,}/g;

// 12-19 digits, optionally grouped by spaces/dashes: candidate card numbers.
const CARD_CANDIDATE = /\b\d(?:[ -]?\d){11,18}\b/g;

function luhn(digits: string) {
  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = digits.charCodeAt(index) - 48;
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

/** Masks anything that looks like a card number (Luhn-valid 12-19 digits) or a panel session token. */
export function redactText(value: string) {
  return value
    .replace(PANEL_SESSION, (_match, cpsess, session) => `${cpsess ?? session}${REDACTED}`)
    .replace(API_SECRET, (_match, prefix) => `${prefix}${REDACTED}`)
    .replace(CARD_CANDIDATE, (match) => {
      const digits = match.replace(/\D/g, "");
      return digits.length >= 12 && luhn(digits) ? `[KART ****${digits.slice(-4)}]` : match;
    });
}

/** Sensitive keys lose their value; flags like `secretConfigured: true` stay. */
function isSensitive(key: string, value: unknown) {
  return SENSITIVE_KEY.test(key) && (typeof value === "string" || typeof value === "number");
}

function redactValue(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return redactText(value);
  if (depth > 6 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => redactValue(item, depth + 1));
  if (value instanceof Error) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      isSensitive(key, item) ? REDACTED : redactValue(item, depth + 1),
    ])
  );
}

function serializeError(err: unknown) {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: redactText(err.message),
      stack: err.stack ? redactText(err.stack) : undefined,
    };
  }
  return { message: redactText(String(err)) };
}

function write(level: Level, scope: string, message: string, context?: Context) {
  const entry: Record<string, unknown> = {
    time: new Date().toISOString(),
    level,
    scope,
    message: redactText(message),
  };
  if (context) {
    for (const [key, value] of Object.entries(context)) {
      entry[key] =
        key === "error" || key === "err"
          ? serializeError(value)
          : isSensitive(key, value)
            ? REDACTED
            : redactValue(value);
    }
  }

  let line: string;
  try {
    line = JSON.stringify(entry);
  } catch {
    line = JSON.stringify({ time: entry.time, level, scope, message });
  }

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function createLogger(scope: string) {
  return {
    info: (message: string, context?: Context) => write("info", scope, message, context),
    warn: (message: string, context?: Context) => write("warn", scope, message, context),
    error: (message: string, context?: Context) => write("error", scope, message, context),
  };
}

export type Logger = ReturnType<typeof createLogger>;
