import { createHash, randomBytes, timingSafeEqual } from "crypto";

export const API_KEY_PREFIX_LENGTH = 16;

export function generateApiKeyValue() {
  const randomPart = randomBytes(24).toString("hex");
  return `kc_live_${randomPart}`;
}

export function getApiKeyPrefix(key: string) {
  return key.slice(0, API_KEY_PREFIX_LENGTH);
}

export function hashApiKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export function verifyApiKeyHash(key: string, storedHash: string) {
  const computed = hashApiKey(key);
  const computedBuffer = Buffer.from(computed, "hex");
  const storedBuffer = Buffer.from(storedHash, "hex");

  if (computedBuffer.length !== storedBuffer.length) {
    return false;
  }

  return timingSafeEqual(computedBuffer, storedBuffer);
}

export function maskApiKeyPrefix(prefix: string) {
  if (prefix.length <= 8) {
    return "****";
  }

  return `${prefix}****`;
}