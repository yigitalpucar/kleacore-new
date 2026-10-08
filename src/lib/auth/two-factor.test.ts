import { Secret, TOTP } from "otpauth";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildLoginToken,
  buildTwoFactorChallenge,
  createTotpSecret,
  matchTotpStep,
  decryptBackupCodes,
  encryptBackupCodes,
  encryptTotpSecret,
  generateBackupCodes,
  verifyBackupCode,
  verifyLoginToken,
  verifyTotpCode,
  verifyTwoFactorChallengeToken,
} from "./two-factor";

describe("two-factor", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-auth-secret";
    process.env.ENCRYPTION_KEY = "test-encryption-key";
  });

  afterEach(() => {
    delete process.env.AUTH_SECRET;
    delete process.env.ENCRYPTION_KEY;
  });

  it("creates and verifies login challenge tokens", () => {
    const token = buildTwoFactorChallenge("user-1", "user@example.com");
    const payload = verifyTwoFactorChallengeToken(token);

    expect(payload).toMatchObject({
      userId: "user-1",
      email: "user@example.com",
      purpose: "2fa_pending",
    });
  });

  it("rejects tampered challenge tokens", () => {
    const token = buildTwoFactorChallenge("user-1", "user@example.com");
    const tampered = `${token}x`;
    expect(verifyTwoFactorChallengeToken(tampered)).toBeNull();
  });

  it("verifies TOTP codes for a generated secret", () => {
    const secret = createTotpSecret();
    const email = "user@example.com";
    const totp = new TOTP({
      issuer: "KLEACORE",
      label: email,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(secret),
    });

    const code = totp.generate();
    expect(verifyTotpCode(secret, email, code)).toBe(true);
    expect(verifyTotpCode(secret, email, "000000")).toBe(false);
  });

  it("encrypts and consumes backup codes", () => {
    const codes = generateBackupCodes(3);
    const encrypted = encryptBackupCodes(codes);

    expect(decryptBackupCodes(encrypted)).toHaveLength(3);

    const firstAttempt = verifyBackupCode(encrypted, codes[0]);
    expect(firstAttempt.valid).toBe(true);
    expect(firstAttempt.remainingCodes).toHaveLength(2);

    const secondAttempt = verifyBackupCode(
      encryptBackupCodes(codes.slice(1)),
      codes[0]
    );
    expect(secondAttempt.valid).toBe(false);
  });

  it("encrypts TOTP secrets at rest", () => {
    const secret = createTotpSecret();
    const encrypted = encryptTotpSecret(secret);

    expect(encrypted).toContain("enc:v1:");
    expect(encrypted).not.toBe(secret);
  });

  it("keeps pending 2FA challenges and login tokens apart", () => {
    const pending = buildTwoFactorChallenge("user-1", "user@example.com");
    const login = buildLoginToken("user-1", "user@example.com", "nonce-1");

    // The token returned after the password step must never log anyone in.
    expect(verifyLoginToken(pending)).toBeNull();
    expect(verifyTwoFactorChallengeToken(login)).toBeNull();
    expect(verifyLoginToken(login)).toMatchObject({
      userId: "user-1",
      email: "user@example.com",
      nonce: "nonce-1",
      purpose: "login",
    });
  });

  it("rejects expired login tokens", () => {
    const realNow = Date.now;
    const login = buildLoginToken("user-1", "user@example.com", "nonce-1");
    Date.now = () => realNow() + 3 * 60 * 1000;
    try {
      expect(verifyLoginToken(login)).toBeNull();
    } finally {
      Date.now = realNow;
    }
  });

  it("returns the absolute TOTP step so replays can be detected", () => {
    const secret = createTotpSecret();
    const email = "user@example.com";
    const totp = new TOTP({
      issuer: "KLEACORE",
      label: email,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(secret),
    });
    const timestamp = 1_700_000_000_000;
    const step = Math.floor(timestamp / 1000 / 30);

    expect(matchTotpStep(secret, email, totp.generate({ timestamp }), timestamp)).toBe(step);
    // Previous window is still accepted, but reports its own (older) step.
    expect(
      matchTotpStep(secret, email, totp.generate({ timestamp: timestamp - 30_000 }), timestamp)
    ).toBe(step - 1);
    expect(matchTotpStep(secret, email, "abc", timestamp)).toBeNull();
  });
});
