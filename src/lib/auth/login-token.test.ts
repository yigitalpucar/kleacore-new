import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: { user: { update: vi.fn(), updateMany: vi.fn() } },
}));

vi.mock("@/lib/db", () => ({ db: mocks.db }));

import { consumeLoginToken, consumeTotpStep, issueLoginToken } from "./login-token";
import { hashLoginNonce, verifyLoginToken } from "./two-factor";

describe("login tokens", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-auth-secret";
  });

  afterEach(() => {
    delete process.env.AUTH_SECRET;
  });

  it("stores only the nonce hash and burns it on use", async () => {
    const user = { id: "u1", email: "u1@example.com" };
    const token = await issueLoginToken(user);
    const payload = verifyLoginToken(token)!;

    expect(mocks.db.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { loginTokenNonceHash: hashLoginNonce(payload.nonce) },
    });

    mocks.db.user.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    expect(await consumeLoginToken(token, user)).toBe(true);
    expect(await consumeLoginToken(token, user)).toBe(false);
  });

  it("rejects tokens for a different email", async () => {
    const token = await issueLoginToken({ id: "u1", email: "u1@example.com" });
    expect(await consumeLoginToken(token, { id: "u1", email: "other@example.com" })).toBe(false);
    expect(mocks.db.user.updateMany).not.toHaveBeenCalled();
  });
});

describe("consumeTotpStep", () => {
  it("only accepts a step newer than the last used one", async () => {
    mocks.db.user.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    expect(await consumeTotpStep("u1", 100)).toBe(true);
    expect(mocks.db.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: "u1",
        OR: [{ twoFactorLastUsedStep: null }, { twoFactorLastUsedStep: { lt: 100 } }],
      },
      data: { twoFactorLastUsedStep: 100 },
    });
    // Same code replayed inside its window.
    expect(await consumeTotpStep("u1", 100)).toBe(false);
  });
});
