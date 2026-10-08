import { hashSync } from "bcryptjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    user: {
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
  isTwoFactorGloballyEnabled: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/auth/two-factor-settings", () => ({
  userRequiresTwoFactor: async (user: { twoFactorEnabled: boolean }) =>
    user.twoFactorEnabled && (await mocks.isTwoFactorGloballyEnabled()),
}));

import { authorizeCredentials } from "./credentials";
import { buildLoginToken, buildTwoFactorChallenge, hashLoginNonce } from "./two-factor";

const PASSWORD = "Test12345!";
const PASSWORD_HASH = hashSync(PASSWORD, 4);
let emailCounter = 0;

function makeUser(overrides: Record<string, unknown> = {}) {
  emailCounter += 1;
  return {
    id: `user_${emailCounter}`,
    email: `user${emailCounter}@example.com`,
    password: PASSWORD_HASH,
    name: "Ada",
    surname: "Lovelace",
    role: "CUSTOMER",
    status: "ACTIVE",
    twoFactorEnabled: false,
    sessionVersion: 3,
    ...overrides,
  };
}

function ipRequest(ip: string) {
  return new Request("http://localhost/api/auth/callback/credentials", {
    headers: { "x-forwarded-for": `${ip}, 10.0.0.1` },
  });
}

describe("authorizeCredentials", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-auth-secret";
    mocks.isTwoFactorGloballyEnabled.mockResolvedValue(true);
    mocks.db.user.update.mockResolvedValue({});
  });

  afterEach(() => {
    delete process.env.AUTH_SECRET;
  });

  it("logs a user without 2FA in with email + password", async () => {
    const user = makeUser();
    mocks.db.user.findFirst.mockResolvedValue(user);

    const result = await authorizeCredentials({ email: user.email, password: PASSWORD });

    expect(result).toEqual({
      id: user.id,
      email: user.email,
      name: "Ada Lovelace",
      role: "CUSTOMER",
      sessionVersion: 3,
    });
  });

  it("looks emails up trimmed and case-insensitively", async () => {
    const user = makeUser();
    mocks.db.user.findFirst.mockResolvedValue(user);

    await authorizeCredentials({ email: `  ${user.email.toUpperCase()} `, password: PASSWORD });

    expect(mocks.db.user.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: user.email, mode: "insensitive" } },
    });
  });

  it("rejects password-only login for a 2FA user (direct callback bypass)", async () => {
    const user = makeUser({ twoFactorEnabled: true });
    mocks.db.user.findFirst.mockResolvedValue(user);

    expect(await authorizeCredentials({ email: user.email, password: PASSWORD })).toBeNull();
    expect(mocks.db.user.update).not.toHaveBeenCalled();
  });

  it("allows password login for a 2FA user when 2FA is disabled globally", async () => {
    const user = makeUser({ twoFactorEnabled: true });
    mocks.db.user.findFirst.mockResolvedValue(user);
    mocks.isTwoFactorGloballyEnabled.mockResolvedValue(false);

    expect(await authorizeCredentials({ email: user.email, password: PASSWORD })).not.toBeNull();
  });

  it("does not accept the pending 2FA challenge token as a login token", async () => {
    const user = makeUser({ twoFactorEnabled: true });
    mocks.db.user.findFirst.mockResolvedValue(user);

    const pending = buildTwoFactorChallenge(user.id, user.email);
    expect(await authorizeCredentials({ email: user.email, loginToken: pending })).toBeNull();
    expect(mocks.db.user.updateMany).not.toHaveBeenCalled();
  });

  it("accepts a verified login token exactly once", async () => {
    const user = makeUser({ twoFactorEnabled: true });
    mocks.db.user.findFirst.mockResolvedValue(user);
    const token = buildLoginToken(user.id, user.email, "nonce-abc");

    mocks.db.user.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    expect(await authorizeCredentials({ email: user.email, loginToken: token })).not.toBeNull();
    expect(mocks.db.user.updateMany).toHaveBeenCalledWith({
      where: { id: user.id, loginTokenNonceHash: hashLoginNonce("nonce-abc") },
      data: { loginTokenNonceHash: null },
    });
    expect(await authorizeCredentials({ email: user.email, loginToken: token })).toBeNull();
  });

  it("rejects a login token minted for another user", async () => {
    const user = makeUser();
    mocks.db.user.findFirst.mockResolvedValue(user);
    const token = buildLoginToken("someone_else", user.email, "nonce");

    expect(await authorizeCredentials({ email: user.email, loginToken: token })).toBeNull();
  });

  it("rejects inactive users", async () => {
    const user = makeUser({ status: "SUSPENDED" });
    mocks.db.user.findFirst.mockResolvedValue(user);

    expect(await authorizeCredentials({ email: user.email, password: PASSWORD })).toBeNull();
  });

  it("rate limits attempts per email", async () => {
    const user = makeUser();
    mocks.db.user.findFirst.mockResolvedValue(user);

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await authorizeCredentials({ email: user.email, password: "wrong" });
    }

    // Even the correct password is refused once the bucket is exhausted.
    expect(await authorizeCredentials({ email: user.email, password: PASSWORD })).toBeNull();
    expect(mocks.db.user.findFirst).toHaveBeenCalledTimes(10);
  });

  it("rate limits attempts per client IP across emails", async () => {
    const request = ipRequest("203.0.113.7");
    mocks.db.user.findFirst.mockResolvedValue(null);

    for (let attempt = 0; attempt < 40; attempt += 1) {
      await authorizeCredentials({ email: `spray${attempt}@example.com`, password: "x" }, request);
    }

    const user = makeUser();
    mocks.db.user.findFirst.mockResolvedValue(user);
    expect(
      await authorizeCredentials({ email: user.email, password: PASSWORD }, request)
    ).toBeNull();
    expect(
      await authorizeCredentials({ email: user.email, password: PASSWORD }, ipRequest("203.0.113.8"))
    ).not.toBeNull();
  });
});
