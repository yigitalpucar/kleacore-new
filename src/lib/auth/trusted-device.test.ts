import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => {
  type Row = {
    id: string;
    userId: string;
    secretHash: string;
    deviceHash: string;
    label: string;
    sessionVersion: number;
    expiresAt: Date;
    revokedAt: Date | null;
    lastUsedAt: Date | null;
  };
  const rows: Row[] = [];
  const trustedDevice = {
    create: async ({ data }: { data: Omit<Row, "id" | "revokedAt" | "lastUsedAt"> }) => {
      const row = { ...data, id: `td-${rows.length + 1}`, revokedAt: null, lastUsedAt: null } as Row;
      rows.push(row);
      return { id: row.id };
    },
    findUnique: async ({ where }: { where: { secretHash: string } }) => rows.find((r) => r.secretHash === where.secretHash) ?? null,
    update: async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
      const row = rows.find((r) => r.id === where.id)!;
      Object.assign(row, data);
      return row;
    },
    updateMany: async ({ where, data }: { where: { id?: string; userId: string; revokedAt: null }; data: Partial<Row> }) => {
      const hits = rows.filter((r) => r.userId === where.userId && !r.revokedAt && (!where.id || r.id === where.id));
      hits.forEach((r) => Object.assign(r, data));
      return { count: hits.length };
    },
  };
  return { rows, db: { trustedDevice } };
});

vi.mock("@/lib/db", () => ({ db: store.db }));

import {
  TRUSTED_DEVICE_TTL_MS,
  checkTrustedDevice,
  createTrustedDevice,
  decodeTrustedDeviceCookie,
  encodeTrustedDeviceCookie,
  revokeAllTrustedDevices,
  revokeTrustedDevice,
  trustedDeviceCookieName,
} from "./trusted-device";
import { buildLoginToken, buildTwoFactorChallenge } from "./two-factor";

const CHROME_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
const CHROME_MAC_UPDATED =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const FIREFOX_WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0";

const alice = { id: "user_alice", sessionVersion: 2 };
const bob = { id: "user_bob", sessionVersion: 0 };
const ctx = { userAgent: CHROME_MAC, ip: "203.0.113.5" };
const now = new Date("2026-10-09T10:00:00Z");

beforeEach(() => {
  process.env.AUTH_SECRET = "test-auth-secret";
  store.rows.length = 0;
});

afterEach(() => {
  delete process.env.AUTH_SECRET;
});

describe("trusted device cookie", () => {
  it("lets the same user on the same browser skip 2FA, also after a browser update", async () => {
    const device = await createTrustedDevice(alice, ctx, now);
    expect(device.cookieName).toBe(trustedDeviceCookieName(alice.id));
    expect(device.expiresAt.getTime() - now.getTime()).toBe(TRUSTED_DEVICE_TTL_MS);

    await expect(checkTrustedDevice(alice, device.cookieValue, ctx, now)).resolves.toEqual({ ok: true, deviceId: device.deviceId });
    await expect(checkTrustedDevice(alice, device.cookieValue, { userAgent: CHROME_MAC_UPDATED }, now)).resolves.toMatchObject({ ok: true });
    expect(store.rows[0].lastUsedAt).toEqual(now);
  });

  it("stores only a hash of the secret", async () => {
    const device = await createTrustedDevice(alice, ctx, now);
    const payload = decodeTrustedDeviceCookie(device.cookieValue)!;
    expect(store.rows[0].secretHash).not.toContain(payload.sec);
    expect(JSON.stringify(store.rows[0])).not.toContain(payload.sec);
  });

  it("rejects a stolen cookie of another user (bob's cookie on alice's login)", async () => {
    const bobs = await createTrustedDevice(bob, ctx, now);
    await expect(checkTrustedDevice(alice, bobs.cookieValue, ctx, now)).resolves.toEqual({ ok: false, reason: "other_user" });
  });

  it("rejects a cookie re-signed for another user id without the key, or tampered", async () => {
    const bobs = await createTrustedDevice(bob, ctx, now);
    const payload = decodeTrustedDeviceCookie(bobs.cookieValue)!;
    const [, signature] = bobs.cookieValue.split(".");
    const forged = `${Buffer.from(JSON.stringify({ ...payload, uid: alice.id })).toString("base64url")}.${signature}`;
    await expect(checkTrustedDevice(alice, forged, ctx, now)).resolves.toEqual({ ok: false, reason: "invalid" });
    await expect(checkTrustedDevice(alice, `${bobs.cookieValue}x`, ctx, now)).resolves.toEqual({ ok: false, reason: "invalid" });
    await expect(checkTrustedDevice(alice, "garbage", ctx, now)).resolves.toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects a validly signed cookie whose secret does not belong to the user's device row", async () => {
    const alices = await createTrustedDevice(alice, ctx, now);
    const bobs = await createTrustedDevice(bob, ctx, now);
    const bobPayload = decodeTrustedDeviceCookie(bobs.cookieValue)!;
    // Signed with the real key (e.g. a leaked secret), but alice's id + bob's row secret.
    const mixed = encodeTrustedDeviceCookie({ uid: alice.id, did: alices.deviceId, sec: bobPayload.sec, exp: bobPayload.exp });
    await expect(checkTrustedDevice(alice, mixed, ctx, now)).resolves.toEqual({ ok: false, reason: "unknown" });
  });

  it("never accepts 2FA challenge or login tokens as a trusted-device cookie", async () => {
    const challenge = buildTwoFactorChallenge(alice.id, "alice@example.com");
    const login = buildLoginToken(alice.id, "alice@example.com", "nonce-123");
    await expect(checkTrustedDevice(alice, challenge, ctx, now)).resolves.toEqual({ ok: false, reason: "invalid" });
    await expect(checkTrustedDevice(alice, login, ctx, now)).resolves.toEqual({ ok: false, reason: "invalid" });
  });

  it("is revoked by removing the device or revoking all", async () => {
    const one = await createTrustedDevice(alice, ctx, now);
    const two = await createTrustedDevice(alice, ctx, now);
    expect(await revokeTrustedDevice(alice.id, one.deviceId, now)).toBe(true);
    await expect(checkTrustedDevice(alice, one.cookieValue, ctx, now)).resolves.toEqual({ ok: false, reason: "revoked" });
    await expect(checkTrustedDevice(alice, two.cookieValue, ctx, now)).resolves.toMatchObject({ ok: true });

    expect(await revokeAllTrustedDevices(alice.id, store.db as never, now)).toBe(1);
    await expect(checkTrustedDevice(alice, two.cookieValue, ctx, now)).resolves.toEqual({ ok: false, reason: "revoked" });
  });

  it("cannot revoke another user's device", async () => {
    const bobs = await createTrustedDevice(bob, ctx, now);
    expect(await revokeTrustedDevice(alice.id, bobs.deviceId, now)).toBe(false);
    await expect(checkTrustedDevice(bob, bobs.cookieValue, ctx, now)).resolves.toMatchObject({ ok: true });
  });

  it("is revoked by a sessionVersion bump (password change, reset, sign-out-others)", async () => {
    const device = await createTrustedDevice(alice, ctx, now);
    const afterPasswordChange = { ...alice, sessionVersion: alice.sessionVersion + 1 };
    await expect(checkTrustedDevice(afterPasswordChange, device.cookieValue, ctx, now)).resolves.toEqual({
      ok: false,
      reason: "session_changed",
    });
  });

  it("expires after 30 days", async () => {
    const device = await createTrustedDevice(alice, ctx, now);
    const later = new Date(now.getTime() + TRUSTED_DEVICE_TTL_MS + 1000);
    await expect(checkTrustedDevice(alice, device.cookieValue, ctx, later)).resolves.toEqual({ ok: false, reason: "expired" });
  });

  it("does not work in another browser family (cookie copied to another browser)", async () => {
    const device = await createTrustedDevice(alice, ctx, now);
    await expect(checkTrustedDevice(alice, device.cookieValue, { userAgent: FIREFOX_WIN }, now)).resolves.toEqual({
      ok: false,
      reason: "browser_changed",
    });
  });

  it("missing cookie → 2FA as usual", async () => {
    await expect(checkTrustedDevice(alice, undefined, ctx, now)).resolves.toEqual({ ok: false, reason: "missing" });
  });
});
