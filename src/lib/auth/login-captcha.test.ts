import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ verifyTurnstileToken: vi.fn() }));

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/security/turnstile", () => ({ verifyTurnstileToken: mocks.verifyTurnstileToken }));

import {
  checkLoginCaptcha,
  clearFailedLogins,
  createLoginCaptchaProof,
  getLoginCaptchaThreshold,
  isLoginCaptchaRequired,
  recordFailedLogin,
  verifyLoginCaptchaProof,
} from "./login-captcha";

let counter = 0;
function freshEmail() {
  counter += 1;
  return `captcha${counter}@example.com`;
}

describe("login captcha after failed attempts", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-auth-secret";
  });

  afterEach(() => {
    delete process.env.AUTH_SECRET;
    vi.unstubAllEnvs();
  });

  it("defaults to 3 failures and is configurable", () => {
    expect(getLoginCaptchaThreshold()).toBe(3);
    vi.stubEnv("LOGIN_CAPTCHA_AFTER_FAILURES", "5");
    expect(getLoginCaptchaThreshold()).toBe(5);
    vi.stubEnv("LOGIN_CAPTCHA_AFTER_FAILURES", "nonsense");
    expect(getLoginCaptchaThreshold()).toBe(3);
  });

  it("requires the captcha once an e-mail reaches the threshold and clears on success", async () => {
    const email = freshEmail();
    for (let i = 0; i < 2; i += 1) await recordFailedLogin(email, null);
    expect(await isLoginCaptchaRequired(email, null)).toBe(false);

    await recordFailedLogin(email.toUpperCase(), null);
    expect(await isLoginCaptchaRequired(email, null)).toBe(true);

    await clearFailedLogins(email);
    expect(await isLoginCaptchaRequired(email, null)).toBe(false);
  });

  it("counts failures per IP across e-mails (password spraying)", async () => {
    const ip = "198.51.100.23";
    for (let i = 0; i < 3; i += 1) await recordFailedLogin(freshEmail(), ip);

    expect(await isLoginCaptchaRequired(freshEmail(), ip)).toBe(true);
    expect(await isLoginCaptchaRequired(freshEmail(), "198.51.100.24")).toBe(false);
  });

  it("passes without Turnstile below the threshold", async () => {
    await expect(checkLoginCaptcha({ email: freshEmail(), ip: null })).resolves.toBe(true);
    expect(mocks.verifyTurnstileToken).not.toHaveBeenCalled();
  });

  it("verifies the Turnstile token above the threshold", async () => {
    const email = freshEmail();
    for (let i = 0; i < 3; i += 1) await recordFailedLogin(email, null);

    mocks.verifyTurnstileToken.mockResolvedValueOnce({ success: false, reason: "missing-token", errorCodes: [] });
    await expect(checkLoginCaptcha({ email, ip: null })).resolves.toBe(false);

    mocks.verifyTurnstileToken.mockResolvedValueOnce({ success: true, bypassed: false });
    await expect(checkLoginCaptcha({ email, ip: null, turnstileToken: "tok" })).resolves.toBe(true);
    expect(mocks.verifyTurnstileToken).toHaveBeenLastCalledWith("tok", { remoteIp: null, action: "login" });
  });

  it("accepts the server-side proof instead of a second Turnstile check", async () => {
    const email = freshEmail();
    for (let i = 0; i < 3; i += 1) await recordFailedLogin(email, null);

    const proof = createLoginCaptchaProof(email);
    await expect(checkLoginCaptcha({ email, ip: null, captchaProof: proof })).resolves.toBe(true);
    expect(mocks.verifyTurnstileToken).not.toHaveBeenCalled();
  });
});

describe("login captcha proof", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-auth-secret";
  });

  afterEach(() => {
    delete process.env.AUTH_SECRET;
  });

  it("is bound to the e-mail and expires after two minutes", () => {
    const now = Date.UTC(2026, 9, 8, 12);
    const proof = createLoginCaptchaProof("Ada@Example.com", now);

    expect(verifyLoginCaptchaProof(proof, "ada@example.com", now + 1000)).toBe(true);
    expect(verifyLoginCaptchaProof(proof, "eve@example.com", now + 1000)).toBe(false);
    expect(verifyLoginCaptchaProof(proof, "ada@example.com", now + 2 * 60 * 1000 + 1)).toBe(false);
  });

  it("rejects forged or malformed proofs", () => {
    const now = Date.now();
    const [expires] = createLoginCaptchaProof("ada@example.com", now).split(".");

    expect(verifyLoginCaptchaProof(`${expires}.forged`, "ada@example.com", now)).toBe(false);
    expect(verifyLoginCaptchaProof("garbage", "ada@example.com", now)).toBe(false);
    expect(verifyLoginCaptchaProof(`${Number(expires) + 60000}.x`, "ada@example.com", now)).toBe(false);
  });
});
