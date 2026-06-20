import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { TOTP, Secret } from "otpauth";
import QRCode from "qrcode";
import { decryptSecret, encryptSecret } from "@/lib/secrets/crypto";

const ISSUER = "KLEACORE";
const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_LENGTH = 8;
const TOTP_PERIOD = 30;
const TOTP_DIGITS = 6;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export type TwoFactorChallengePayload = {
  userId: string;
  email: string;
  exp: number;
  purpose: "2fa_login";
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

function safeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}

export function createTwoFactorChallengeToken(payload: TwoFactorChallengePayload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signPayload(encoded);
  return `${encoded}.${signature}`;
}

export function verifyTwoFactorChallengeToken(token: string): TwoFactorChallengePayload | null {
  const [encoded, signature] = token.split(".");

  if (!encoded || !signature) {
    return null;
  }

  const expectedSignature = signPayload(encoded);
  if (!safeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as TwoFactorChallengePayload;

    if (
      payload.purpose !== "2fa_login" ||
      !payload.userId ||
      !payload.email ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }

    if (payload.exp < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function buildTwoFactorChallenge(userId: string, email: string) {
  return createTwoFactorChallengeToken({
    userId,
    email,
    exp: Date.now() + CHALLENGE_TTL_MS,
    purpose: "2fa_login",
  });
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

export function verifyTotpCode(secret: string, email: string, code: string) {
  const normalized = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalized)) {
    return false;
  }

  const totp = createTotpInstance(secret, email);
  const delta = totp.validate({ token: normalized, window: 1 });
  return delta !== null;
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
  const matchIndex = hashedCodes.findIndex((stored) => stored === hashedInput);

  if (matchIndex === -1) {
    return { valid: false, remainingCodes: hashedCodes };
  }

  const remainingCodes = hashedCodes.filter((_, index) => index !== matchIndex);
  return { valid: true, remainingCodes };
}

export function serializeBackupCodes(codes: string[]) {
  return encryptBackupCodes(codes);
}