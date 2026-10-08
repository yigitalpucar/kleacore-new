import { createHash, timingSafeEqual } from "crypto";

/**
 * Constant-time string comparison for secrets, signatures and HMACs.
 * Both sides are hashed first so neither the content nor the length of the
 * expected value leaks through timing.
 */
export function timingSafeStringEqual(
  a: string | null | undefined,
  b: string | null | undefined
) {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }

  const aDigest = createHash("sha256").update(a, "utf8").digest();
  const bDigest = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(aDigest, bDigest);
}
