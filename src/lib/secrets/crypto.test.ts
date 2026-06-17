import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  isEncryptedValue,
  persistSettingValue,
  resolveSettingValue,
} from "./crypto";

describe("settings crypto", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = "test-encryption-key";
  });

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  it("encrypts and decrypts secret values", () => {
    const encrypted = encryptSecret("super-secret");
    expect(isEncryptedValue(encrypted)).toBe(true);
    expect(decryptSecret(encrypted)).toBe("super-secret");
  });

  it("encrypts only configured secret setting keys", () => {
    const encrypted = persistSettingValue("smtp_password", "smtp-pass");
    const plain = persistSettingValue("company_name", "KLEACORE");

    expect(isEncryptedValue(encrypted)).toBe(true);
    expect(plain).toBe("KLEACORE");
    expect(resolveSettingValue("smtp_password", encrypted)).toBe("smtp-pass");
  });
});