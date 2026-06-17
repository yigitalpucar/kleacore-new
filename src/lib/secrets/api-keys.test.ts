import { describe, expect, it } from "vitest";
import {
  generateApiKeyValue,
  getApiKeyPrefix,
  hashApiKey,
  verifyApiKeyHash,
} from "./api-keys";

describe("api key hashing", () => {
  it("generates keys with stable prefix and verifiable hash", () => {
    const key = generateApiKeyValue();

    expect(key.startsWith("kc_live_")).toBe(true);
    expect(getApiKeyPrefix(key)).toBe(key.slice(0, 16));
    expect(verifyApiKeyHash(key, hashApiKey(key))).toBe(true);
    expect(verifyApiKeyHash("kc_live_wrong", hashApiKey(key))).toBe(false);
  });
});