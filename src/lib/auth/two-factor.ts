import { createHash, createHmac, randomBytes } from "crypto";
import { TOTP, Secret } from "otpauth";
import QRCode from "qrcode";
import { timingSafeStringEqual } from "@/lib/secrets/compare";
import { decryptSecret, encryptSecret } from "@/lib/secrets/crypto";

const ISSUER = "KLEACORE";
const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_LENGTH = 8;
const TOTP_PERIOD = 30;
const TOTP_DIGITS = 6;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const LOGIN_TOKEN_TTL_MS = 2 * 60 * 1000;

/**
 * Issued after the password step for 2FA users. Only accepted by the TOTP
 * verification step — never by the credentials provider.
 */
export type TwoFactorChallengePayload = {
  userId: string;
  email: string;
  exp: number;
  purpose: "2fa_pending";
};

/**
 * Issued server-side after a completed second factor (or a password change).
 * The only token the credentials provider accepts in place of a password;
 * single-use via the nonce whose hash is stored on the user row.
 */
export type LoginTokenPayload = {
  userId: string;
  email: string;
  nonce: string;
  exp: number;
  purpose: "login";
};

function getSigningSecret() {
  const secret =
    process.env.AUTH_SECRET?.trim() ||
    process.env.ENCRYPTION_KEY?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim();

  if (!secret) {
    throw new Error("AUTH_SECRET is required for two-factor authentication");
  }

  return secret;
}

function signPayload(payload: string) {
  return createHmac("sha256", getSigningSecret()).update(payload).digest("base64url");
}

function signToken(payload: object) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signPayload(encoded);
  return `${encoded}.${signature}`;
}

function readSignedToken(token: string): Record<string, unknown> | null {
  const [encoded, signature, extra] = token.split(".");

  if (!encoded || !signature || extra !== undefined) {
    return null;
  }

  if (!timingSafeStringEqual(signature, signPayload(encoded))) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as unknown;
    if (!payload || typeof payload !== "object") {
      return null;
    }

    const record = payload as Record<string, unknown>;
    if (
      typeof record.userId !== "string" ||
      !record.userId ||
      typeof record.email !== "string" ||
      !record.email ||
      typeof record.exp !== "number" ||
      record.exp < Date.now()
    ) {
      return null;
    }

    return record;
  } catch {
    return null;
  }
}

export function createTwoFactorChallengeToken(payload: TwoFactorChallengePayload) {
  return signToken(payload);
}

export function verifyTwoFactorChallengeToken(token: string): TwoFactorChallengePayload | null {
  const payload = readSignedToken(token);
  if (!payload || payload.purpose !== "2fa_pending") {
    return null;
  }

  return payload as TwoFactorChallengePayload;
}

export function buildTwoFactorChallenge(userId: string, email: string) {
  return createTwoFactorChallengeToken({
    userId,
    email,
    exp: Date.now() + CHALLENGE_TTL_MS,
    purpose: "2fa_pending",
  });
}

export function createLoginNonce() {
  return randomBytes(32).toString("base64url");
}

export function hashLoginNonce(nonce: string) {
  return createHash("sha256").update(nonce).digest("hex");
}

export function buildLoginToken(userId: string, email: string, nonce: string) {
  const payload: LoginTokenPayload = {
    userId,
    email,
    nonce,
    exp: Date.now() + LOGIN_TOKEN_TTL_MS,
    purpose: "login",
  };
  return signToken(payload);
}

export function verifyLoginToken(token: string): LoginTokenPayload | null {
  const payload = readSignedToken(token);
  if (!payload || payload.purpose !== "login" || typeof payload.nonce !== "string" || !payload.nonce) {
    return null;
  }

  return payload as LoginTokenPayload;
}

export function createTotpSecret() {
  const secret = new Secret({ size: 20 });
  return secret.base32;
}

export function createTotpInstance(secret: string, email: string) {
  return new TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: "SHA1",
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret: Secret.fromBase32(secret),
  });
}

export function generateTotpUri(secret: string, email: string) {
  const totp = createTotpInstance(secret, email);
  return totp.toString();
}

export async function generateTotpQrDataUrl(secret: string, email: string) {
  const uri = generateTotpUri(secret, email);
  return QRCode.toDataURL(uri, {
    margin: 1,
    width: 220,
    errorCorrectionLevel: "M",
  });
}

/**
 * Returns the absolute TOTP time step the code belongs to (so callers can
 * reject replays of an already-used step), or null when the code is invalid.
 */
export function matchTotpStep(
  secret: string,
  email: string,
  code: string,
  timestamp = Date.now()
): number | null {
  const normalized = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalized)) {
    return null;
  }

  const totp = createTotpInstance(secret, email);
  const delta = totp.validate({ token: normalized, window: 1, timestamp });
  if (delta === null) {
    return null;
  }

  return totp.counter({ timestamp }) + delta;
}

export function verifyTotpCode(secret: string, email: string, code: string) {
  return matchTotpStep(secret, email, code) !== null;
}

export function generateBackupCodes(count = BACKUP_CODE_COUNT) {
  const codes: string[] = [];

  for (let index = 0; index < count; index += 1) {
    const raw = randomBytes(BACKUP_CODE_LENGTH)
      .toString("hex")
      .slice(0, BACKUP_CODE_LENGTH)
      .toUpperCase();
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4)}`);
  }

  return codes;
}

export function hashBackupCode(code: string) {
  const normalized = code.replace(/[\s-]/g, "").toUpperCase();
  return createHmac("sha256", getSigningSecret())
    .update(normalized)
    .digest("hex");
}

export function encryptBackupCodes(codes: string[]) {
  const hashedCodes = codes.map((code) => hashBackupCode(code));
  return encryptSecret(JSON.stringify(hashedCodes));
}

export function decryptBackupCodes(value: string | null | undefined) {
  if (!value) {
    return [] as string[];
  }

  try {
    const decrypted = decryptSecret(value);
    const parsed = JSON.parse(decrypted) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function encryptTotpSecret(secret: string) {
  return encryptSecret(secret);
}

export function decryptTotpSecret(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return decryptSecret(value);
}

export function verifyBackupCode(
  storedEncryptedCodes: string | null | undefined,
  code: string
) {
  const hashedCodes = decryptBackupCodes(storedEncryptedCodes);
  if (hashedCodes.length === 0) {
    return { valid: false, remainingCodes: hashedCodes };
  }

  const hashedInput = hashBackupCode(code);
  const matchIndex = hashedCodes.findIndex((stored) => timingSafeStringEqual(stored, hashedInput));

  if (matchIndex === -1) {
    return { valid: false, remainingCodes: hashedCodes };
  }

  const remainingCodes = hashedCodes.filter((_, index) => index !== matchIndex);
  return { valid: true, remainingCodes };
}

export function serializeBackupCodes(codes: string[]) {
  return encryptBackupCodes(codes);
}