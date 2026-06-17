import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";
import { isSecretSettingKey } from "@/lib/secrets/setting-keys";

const ENCRYPTED_PREFIX = "enc:v1:";
const ALGORITHM = "aes-256-gcm";

function getEncryptionKey() {
  const secret =
    process.env.ENCRYPTION_KEY?.trim() || process.env.AUTH_SECRET?.trim();

  if (!secret) {
    throw new Error("ENCRYPTION_KEY or AUTH_SECRET is required");
  }

  return createHash("sha256").update(secret).digest();
}

export function isEncryptedValue(value: string) {
  return value.startsWith(ENCRYPTED_PREFIX);
}

export function encryptSecret(plaintext: string) {
  if (!plaintext || isEncryptedValue(plaintext)) {
    return plaintext;
  }

  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTED_PREFIX}${iv.toString("base64url")}:${authTag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptSecret(value: string) {
  if (!value || !isEncryptedValue(value)) {
    return value;
  }

  const payload = value.slice(ENCRYPTED_PREFIX.length);
  const [ivPart, authTagPart, ciphertextPart] = payload.split(":");

  if (!ivPart || !authTagPart || !ciphertextPart) {
    return value;
  }

  try {
    const key = getEncryptionKey();
    const decipher = createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(ivPart, "base64url")
    );
    decipher.setAuthTag(Buffer.from(authTagPart, "base64url"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(ciphertextPart, "base64url")),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch {
    return "";
  }
}

export function resolveSettingValue(key: string, value: string) {
  if (!value || !isSecretSettingKey(key)) {
    return value;
  }

  return decryptSecret(value);
}

export function persistSettingValue(key: string, value: string) {
  if (!value || !isSecretSettingKey(key)) {
    return value;
  }

  return encryptSecret(value);
}