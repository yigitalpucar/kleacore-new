import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tokens = {
    deleteMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  };
  const users = { findUnique: vi.fn(), updateMany: vi.fn() };
  const db = {
    emailVerificationToken: tokens,
    user: users,
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(db)),
  };
  return { db, tokens, users, sendNotification: vi.fn() };
});

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/notifications/send", () => ({ sendNotification: mocks.sendNotification }));

import {
  EMAIL_NOT_VERIFIED_CODE,
  EMAIL_VERIFICATION_TTL_HOURS,
  consumeEmailVerificationToken,
  createEmailVerificationToken,
  getPurchaseBlock,
  hashVerificationToken,
  sendVerificationEmail,
} from "./email-verification";

const NOW = new Date("2026-10-08T12:00:00.000Z");
const TOKEN = "a".repeat(64);

function storedToken(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt_1",
    userId: "user_1",
    tokenHash: hashVerificationToken(TOKEN),
    expiresAt: new Date(NOW.getTime() + 60 * 60 * 1000),
    usedAt: null,
    user: { id: "user_1", emailVerifiedAt: null },
    ...overrides,
  };
}

describe("createEmailVerificationToken", () => {
  it("stores only the sha256 of a random token, replaces unused ones and expires in 24h", async () => {
    const { token, expiresAt } = await createEmailVerificationToken("user_1", { now: NOW });

    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(mocks.tokens.deleteMany).toHaveBeenCalledWith({ where: { userId: "user_1", usedAt: null } });
    const data = mocks.tokens.create.mock.calls[0][0].data;
    expect(data.tokenHash).toBe(hashVerificationToken(token));
    expect(data.tokenHash).not.toBe(token);
    expect(expiresAt.getTime() - NOW.getTime()).toBe(EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000);
  });
});

describe("sendVerificationEmail", () => {
  it("queues the auth.verify-email notification with the verify URL", async () => {
    mocks.sendNotification.mockResolvedValueOnce({ ok: true, logIds: ["log-1"], deduplicated: false });
    await expect(sendVerificationEmail("user_1")).resolves.toEqual({ sent: true });

    expect(mocks.sendNotification).toHaveBeenCalledWith({
      userId: "user_1",
      template: "auth.verify-email",
      data: expect.objectContaining({
        verifyUrl: expect.stringMatching(/\/musteri\/dogrula\?token=[a-f0-9]{64}$/),
        expiresInHours: EMAIL_VERIFICATION_TTL_HOURS,
      }),
      channel: "EMAIL",
    });
  });

  it("never throws when the queue is unavailable", async () => {
    mocks.sendNotification.mockRejectedValueOnce(new Error("queue down"));

    await expect(sendVerificationEmail("user_1")).resolves.toEqual({ sent: false });
  });

  it("reports a notification that could not be queued as not sent", async () => {
    mocks.sendNotification.mockResolvedValueOnce({ ok: false, logIds: [], deduplicated: false, error: "NO_EMAIL" });

    await expect(sendVerificationEmail("user_1")).resolves.toEqual({ sent: false });
  });
});

describe("consumeEmailVerificationToken", () => {
  beforeEach(() => {
    mocks.tokens.updateMany.mockResolvedValue({ count: 1 });
    mocks.users.updateMany.mockResolvedValue({ count: 1 });
  });

  it("verifies the user and marks the token used", async () => {
    mocks.tokens.findUnique.mockResolvedValue(storedToken());

    const result = await consumeEmailVerificationToken(TOKEN, { now: NOW });

    expect(result).toEqual({ ok: true, alreadyVerified: false });
    expect(mocks.tokens.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: hashVerificationToken(TOKEN) } })
    );
    expect(mocks.tokens.updateMany).toHaveBeenCalledWith({
      where: { id: "evt_1", usedAt: null },
      data: { usedAt: NOW },
    });
    expect(mocks.users.updateMany).toHaveBeenCalledWith({
      where: { id: "user_1", emailVerifiedAt: null },
      data: { emailVerifiedAt: NOW },
    });
  });

  it("rejects an expired token without verifying", async () => {
    mocks.tokens.findUnique.mockResolvedValue(storedToken({ expiresAt: new Date(NOW.getTime() - 1) }));

    await expect(consumeEmailVerificationToken(TOKEN, { now: NOW })).resolves.toEqual({
      ok: false,
      reason: "expired",
    });
    expect(mocks.users.updateMany).not.toHaveBeenCalled();
  });

  it("rejects reuse of a token when the account is not verified", async () => {
    mocks.tokens.findUnique.mockResolvedValue(storedToken({ usedAt: NOW }));

    await expect(consumeEmailVerificationToken(TOKEN, { now: NOW })).resolves.toEqual({
      ok: false,
      reason: "used",
    });
    expect(mocks.users.updateMany).not.toHaveBeenCalled();
  });

  it("reports an already used link of a verified account as already verified", async () => {
    mocks.tokens.findUnique.mockResolvedValue(
      storedToken({ usedAt: NOW, user: { id: "user_1", emailVerifiedAt: NOW } })
    );

    await expect(consumeEmailVerificationToken(TOKEN, { now: NOW })).resolves.toEqual({
      ok: true,
      alreadyVerified: true,
    });
    expect(mocks.tokens.updateMany).not.toHaveBeenCalled();
  });

  it("lets only one of two parallel clicks consume the token", async () => {
    mocks.tokens.findUnique.mockResolvedValue(storedToken());
    mocks.tokens.updateMany.mockResolvedValue({ count: 0 });

    await expect(consumeEmailVerificationToken(TOKEN, { now: NOW })).resolves.toEqual({
      ok: false,
      reason: "used",
    });
    expect(mocks.users.updateMany).not.toHaveBeenCalled();
  });

  it("rejects malformed and unknown tokens", async () => {
    await expect(consumeEmailVerificationToken("not-a-token")).resolves.toEqual({ ok: false, reason: "invalid" });
    expect(mocks.tokens.findUnique).not.toHaveBeenCalled();

    mocks.tokens.findUnique.mockResolvedValue(null);
    await expect(consumeEmailVerificationToken(TOKEN)).resolves.toEqual({ ok: false, reason: "invalid" });
  });
});

describe("getPurchaseBlock", () => {
  it("blocks unverified users with a clear code", async () => {
    mocks.users.findUnique.mockResolvedValue({ emailVerifiedAt: null });

    await expect(getPurchaseBlock("user_1")).resolves.toMatchObject({
      success: false,
      code: EMAIL_NOT_VERIFIED_CODE,
    });
  });

  it("lets verified users through", async () => {
    mocks.users.findUnique.mockResolvedValue({ emailVerifiedAt: NOW });

    await expect(getPurchaseBlock("user_1")).resolves.toBeNull();
  });
});
