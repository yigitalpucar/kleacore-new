import { randomUUID } from "node:crypto";

/**
 * Storage keys are generated here and only here: `<prefix>/<yyyy>/<mm>/<uuid>`,
 * lowercase [a-z0-9-] segments. Drivers refuse anything else, so a key can
 * never contain "..", a leading "/", a backslash or a user-supplied name.
 */
const KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*){1,6}$/;

export class InvalidStorageKeyError extends Error {
  constructor(key: string) {
    super(`Invalid storage key: ${JSON.stringify(key).slice(0, 80)}`);
    this.name = "InvalidStorageKeyError";
  }
}

export function isValidStorageKey(key: unknown): key is string {
  return typeof key === "string" && key.length <= 200 && KEY_PATTERN.test(key);
}

export function assertValidStorageKey(key: unknown): asserts key is string {
  if (!isValidStorageKey(key)) throw new InvalidStorageKeyError(String(key));
}

export function generateStorageKey(prefix: string, now = new Date()): string {
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const key = `${prefix}/${yyyy}/${mm}/${randomUUID()}`;
  assertValidStorageKey(key);
  return key;
}
