/**
 * loginAction + "Bu cihazı hatırla": a trusted-device cookie may replace the
 * TOTP step only for the account it was issued to, only after the right
 * password, and never once revoked. Everything else still ends in the 2FA
 * challenge, exactly as before (Faz 0).
 */
import { hashSync } from "bcryptjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  type Row = Record<string, unknown> & { id: string; userId: string; secretHash: string; revokedAt: Date | null };
  const rows: Row[] = [];
  const cookieJar = new Map<string, string>();
  return {
    rows,
    cookieJar,
    users: new Map<string, Record<string, unknown>>(),
    signIn: vi.fn(async () => undefined),
    issueLoginToken: vi.fn(async () => "single-use-login-token"),
    recordLoginEvent: vi.fn(async () => null),
    userAgent: "",
    db: {
      trustedDevice: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const row = { ...data, id: `td-${rows.length + 1}`, revokedAt: null, lastUsedAt: null } as unknown as Row;
          rows.push(row);
          return { id: row.id };
        },
        findUnique: async ({ where }: { where: { secretHash: string } }) => rows.find((r) => r.secretHash === where.secretHash) ?? null,
        update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) =>
          Object.assign(rows.find((r) => r.id === where.id)!, data),
        updateMany: async ({ where, data }: { where: { userId: string }; data: Record<string, unknown> }) => {
          const hits = rows.filter((r) => r.userId === where.userId && !r.revokedAt);
          hits.forEach((r) => Object.assign(r, data));
          return { count: hits.length };
        },
      },
    },
  };
});

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (mocks.cookieJar.has(name) ? { name, value: mocks.cookieJar.get(name)! } : undefined),
    set: (name: string, value: string) => void mocks.cookieJar.set(name, value),
    delete: (name: string) => void mocks.cookieJar.delete(name),
  }),
  headers: async () => new Headers({ "user-agent": mocks.userAgent, "x-forwarded-for": "203.0.113.5" }),
}));
vi.mock("next-auth", () => ({ AuthError: class AuthError extends Error {} }));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/auth", () => ({ signIn: mocks.signIn, signOut: vi.fn(), auth: vi.fn() }));
vi.mock("@/lib/auth/email", () => ({
  findUserByEmail: async (email: string) => mocks.users.get(email.trim().toLowerCase()) ?? null,
  normalizeEmail: (email: string) => email.trim().toLowerCase(),
}));
vi.mock("@/lib/auth/two-factor-settings", () => ({
  createLoginTwoFactorChallenge: async (email: string, userId: string) =>
    mocks.users.get(email)?.twoFactorEnabled ? `challenge-for-${userId}` : null,
}));
vi.mock("@/lib/auth/login-token", () => ({ issueLoginToken: mocks.issueLoginToken }));
vi.mock("@/lib/auth/login-captcha", () => ({
  LOGIN_CAPTCHA_ACTION: "login",
  isLoginCaptchaRequired: async () => false,
  recordFailedLogin: async () => undefined,
  clearFailedLogins: async () => undefined,
  createLoginCaptchaProof: () => "proof",
}));
vi.mock("@/lib/security/login-events", () => ({ recordLoginEvent: mocks.recordLoginEvent }));
vi.mock("@/lib/auth/registration", () => ({ registerCustomerAccount: vi.fn() }));
vi.mock("@/lib/auth/email-verification", () => ({ isEmailVerified: vi.fn(), sendVerificationEmail: vi.fn() }));
vi.mock("@/lib/notifications/send", () => ({ sendNotification: vi.fn() }));
vi.mock("@/lib/events/emit", () => ({ emitEventAfterCommit: vi.fn() }));

import { loginAction } from "./auth";
import { createTrustedDevice, revokeAllTrustedDevices, trustedDeviceCookieName } from "@/lib/auth/trusted-device";

const CHROME_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
const PASSWORD = "Test12345!";
const HASH = hashSync(PASSWORD, 4);

function user(id: string, email: string, overrides: Record<string, unknown> = {}) {
  const row = { id, email, password: HASH, name: "Ada", surname: "L", role: "CUSTOMER", status: "ACTIVE", twoFactorEnabled: true, sessionVersion: 1, ...overrides };
  mocks.users.set(email, row);
  return row as typeof row & { sessionVersion: number };
}

function form(email: string, password = PASSWORD) {
  const data = new FormData();
  data.set("email", email);
  data.set("password", password);
  return data;
}

let alice: ReturnType<typeof user>;
let bob: ReturnType<typeof user>;

beforeEach(() => {
  process.env.AUTH_SECRET = "test-auth-secret";
  mocks.rows.length = 0;
  mocks.cookieJar.clear();
  mocks.users.clear();
  mocks.userAgent = CHROME_MAC;
  alice = user("user_alice", "alice@example.com");
  bob = user("user_bob", "bob@example.com");
});

afterEach(() => {
  delete process.env.AUTH_SECRET;
});

async function trust(target: { id: string; sessionVersion: number }) {
  const device = await createTrustedDevice(target, { userAgent: CHROME_MAC, ip: "203.0.113.5" });
  return device;
}

describe("loginAction with a trusted device", () => {
  it("skips the TOTP step for the device's own user (password still required)", async () => {
    const device = await trust(alice);
    mocks.cookieJar.set(device.cookieName, device.cookieValue);

    const result = await loginAction(form(alice.email));

    expect(result).toEqual({ success: true });
    expect(mocks.signIn).toHaveBeenCalledWith("credentials", {
      email: alice.email,
      loginToken: "single-use-login-token",
      redirect: false,
    });
    expect(mocks.recordLoginEvent).toHaveBeenCalledWith(expect.objectContaining({ userId: alice.id, success: true, method: "trusted_device" }));
  });

  it("never skips the password: wrong password + valid cookie fails", async () => {
    const device = await trust(alice);
    mocks.cookieJar.set(device.cookieName, device.cookieValue);

    const result = await loginAction(form(alice.email, "Wrong12345!"));

    expect(result.success).toBe(false);
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("a stolen cookie of another user does not skip 2FA", async () => {
    const bobs = await trust(bob);
    // Put bob's cookie under alice's cookie name (attacker copies it over).
    mocks.cookieJar.set(trustedDeviceCookieName(alice.id), bobs.cookieValue);

    const result = await loginAction(form(alice.email));

    expect(result).toMatchObject({ success: false, requires2FA: true, challengeToken: `challenge-for-${alice.id}` });
    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(mocks.issueLoginToken).not.toHaveBeenCalled();
    // The useless cookie is cleared.
    expect(mocks.cookieJar.has(trustedDeviceCookieName(alice.id))).toBe(false);
  });

  it("a revoked device does not skip 2FA", async () => {
    const device = await trust(alice);
    mocks.cookieJar.set(device.cookieName, device.cookieValue);
    await revokeAllTrustedDevices(alice.id, mocks.db as never);

    const result = await loginAction(form(alice.email));

    expect(result).toMatchObject({ success: false, requires2FA: true });
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("a device trusted before a password change (sessionVersion bump) does not skip 2FA", async () => {
    const device = await trust(alice);
    mocks.cookieJar.set(device.cookieName, device.cookieValue);
    alice.sessionVersion += 1;

    const result = await loginAction(form(alice.email));

    expect(result).toMatchObject({ success: false, requires2FA: true });
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("without a cookie the 2FA challenge is returned as before", async () => {
    const result = await loginAction(form(alice.email));
    expect(result).toMatchObject({ success: false, requires2FA: true });
    expect(mocks.signIn).not.toHaveBeenCalled();
  });
});
