import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * In-memory stand-in for the two tables involved, so the counting / claiming
 * logic runs for real.
 */
const store = vi.hoisted(() => {
  type LoginRow = { id: string; userId: string | null; success: boolean; deviceHash: string | null; createdAt: Date };
  const state = {
    events: [] as LoginRow[],
    users: new Map<string, { failedLoginNoticeAt: Date | null }>(),
    emitted: [] as Array<{ type: string; payload: Record<string, unknown> }>,
    failCreate: false,
  };
  const matches = (row: LoginRow, where: Record<string, unknown>) => {
    if ("userId" in where && row.userId !== where.userId) return false;
    if ("success" in where && row.success !== where.success) return false;
    if ("deviceHash" in where && row.deviceHash !== where.deviceHash) return false;
    const created = where.createdAt as { gte?: Date } | undefined;
    if (created?.gte && row.createdAt < created.gte) return false;
    return true;
  };
  const loginEvent = {
    count: async ({ where }: { where: Record<string, unknown> }) => state.events.filter((r) => matches(r, where)).length,
    findFirst: async ({ where }: { where: Record<string, unknown> }) => state.events.find((r) => matches(r, where)) ?? null,
    create: async ({ data }: { data: Omit<LoginRow, "id"> & Record<string, unknown> }) => {
      if (state.failCreate) throw new Error("db down");
      const row = { ...data, id: `le-${state.events.length + 1}` } as LoginRow;
      state.events.push(row);
      return { id: row.id };
    },
  };
  const user = {
    updateMany: async ({ where, data }: { where: { id: string; OR: Array<Record<string, unknown>> }; data: { failedLoginNoticeAt: Date } }) => {
      const row = state.users.get(where.id);
      if (!row) return { count: 0 };
      const cutoff = (where.OR[1].failedLoginNoticeAt as { lte: Date }).lte;
      if (row.failedLoginNoticeAt && row.failedLoginNoticeAt > cutoff) return { count: 0 };
      row.failedLoginNoticeAt = data.failedLoginNoticeAt;
      return { count: 1 };
    },
  };
  const client = { loginEvent, user };
  const db = { ...client, $transaction: async (fn: (tx: typeof client) => unknown) => fn(client) };
  return { state, db };
});

vi.mock("@/lib/db", () => ({ db: store.db }));
vi.mock("@/lib/events/emit", () => ({
  emitEvent: vi.fn(async (_tx: unknown, type: string, payload: Record<string, unknown>) => {
    store.state.emitted.push({ type, payload });
    return { id: `evt-${store.state.emitted.length}`, type, queued: true };
  }),
}));

import { FAILED_LOGIN_BURST_THRESHOLD, recordLoginEvent } from "./login-events";

const CHROME_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
const FIREFOX_WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0";

const base = { userId: "u1", email: "ayse@example.com" };
const t0 = new Date("2026-10-09T10:00:00Z");
const minutes = (n: number) => new Date(t0.getTime() + n * 60_000);

beforeEach(() => {
  store.state.events = [];
  store.state.emitted = [];
  store.state.failCreate = false;
  store.state.users = new Map([["u1", { failedLoginNoticeAt: null }]]);
});

describe("new-device detection", () => {
  it("does not flag the first login ever (no history yet: no rollout blast)", async () => {
    const result = await recordLoginEvent({ ...base, success: true, ip: "203.0.113.5", userAgent: CHROME_MAC, now: t0 });
    expect(result?.newDevice).toBe(false);
    expect(store.state.emitted).toEqual([]);
  });

  it("flags a login from a new browser family / network once, and not the known device", async () => {
    await recordLoginEvent({ ...base, success: true, ip: "203.0.113.5", userAgent: CHROME_MAC, now: t0 });

    // Same browser family, same /24: known.
    const known = await recordLoginEvent({ ...base, success: true, ip: "203.0.113.99", userAgent: CHROME_MAC, now: minutes(5) });
    expect(known?.newDevice).toBe(false);

    // Other browser + other network: new → event with the device details.
    const fresh = await recordLoginEvent({
      ...base,
      success: true,
      ip: "198.51.100.7",
      userAgent: FIREFOX_WIN,
      twoFactorUsed: true,
      now: minutes(10),
    });
    expect(fresh?.newDevice).toBe(true);
    expect(store.state.emitted).toHaveLength(1);
    expect(store.state.emitted[0]).toMatchObject({
      type: "security.new_device_login",
      payload: { userId: "u1", loginEventId: fresh?.id, device: "Firefox · Windows", ipAddress: "198.51.100.7", network: "198.51.100.0/24", twoFactorUsed: true },
    });

    // Second login from that device: known now.
    const again = await recordLoginEvent({ ...base, success: true, ip: "198.51.100.8", userAgent: FIREFOX_WIN, now: minutes(20) });
    expect(again?.newDevice).toBe(false);
    expect(store.state.emitted).toHaveLength(1);
  });

  it("never flags a session re-issue (password change / sign-out-others) or a failed attempt", async () => {
    await recordLoginEvent({ ...base, success: true, ip: "203.0.113.5", userAgent: CHROME_MAC, now: t0 });
    const reissue = await recordLoginEvent({
      ...base,
      success: true,
      method: "reissue",
      detectNewDevice: false,
      ip: "198.51.100.7",
      userAgent: FIREFOX_WIN,
      now: minutes(1),
    });
    const failed = await recordLoginEvent({ ...base, success: false, reason: "bad_password", ip: "192.0.2.1", userAgent: FIREFOX_WIN, now: minutes(2) });
    expect(reissue?.newDevice).toBe(false);
    expect(failed?.newDevice).toBe(false);
    expect(store.state.emitted.filter((e) => e.type === "security.new_device_login")).toEqual([]);
  });

  it("never throws (a broken audit must not break the login)", async () => {
    store.state.failCreate = true;
    await expect(recordLoginEvent({ ...base, success: true, ip: null, userAgent: null })).resolves.toBeNull();
  });
});

describe("failed-login burst notice", () => {
  const fail = (at: Date, reason: "bad_password" | "bad_2fa" = "bad_password") =>
    recordLoginEvent({ ...base, success: false, reason, ip: "192.0.2.50", userAgent: CHROME_MAC, now: at });

  const bursts = () => store.state.emitted.filter((e) => e.type === "security.failed_login_burst");

  it("notifies once when the threshold is reached, not on every further failure", async () => {
    for (let i = 0; i < FAILED_LOGIN_BURST_THRESHOLD - 1; i += 1) await fail(minutes(i));
    expect(bursts()).toHaveLength(0);

    const hit = await fail(minutes(FAILED_LOGIN_BURST_THRESHOLD));
    expect(hit?.burstNotified).toBe(true);
    expect(bursts()).toHaveLength(1);
    expect(bursts()[0].payload).toMatchObject({ userId: "u1", failedAttempts: FAILED_LOGIN_BURST_THRESHOLD, windowMinutes: 60, lastIpAddress: "192.0.2.50" });

    // Ten more failures within the hour: still one notice.
    for (let i = 0; i < 10; i += 1) await fail(minutes(10 + i), i % 2 ? "bad_2fa" : "bad_password");
    expect(bursts()).toHaveLength(1);
  });

  it("allows the next notice only after an hour", async () => {
    for (let i = 0; i < FAILED_LOGIN_BURST_THRESHOLD; i += 1) await fail(minutes(i));
    expect(bursts()).toHaveLength(1);

    for (let i = 0; i < FAILED_LOGIN_BURST_THRESHOLD; i += 1) await fail(minutes(50 + i));
    expect(bursts()).toHaveLength(1);

    for (let i = 0; i < FAILED_LOGIN_BURST_THRESHOLD; i += 1) await fail(minutes(70 + i));
    expect(bursts()).toHaveLength(2);
  });

  it("only counts failures inside the window", async () => {
    // Spread out: never 5 within one hour.
    for (let i = 0; i < 8; i += 1) await fail(minutes(i * 20));
    expect(bursts()).toHaveLength(0);
  });

  it("does not count unknown e-mail attempts against an account", async () => {
    for (let i = 0; i < 10; i += 1) {
      await recordLoginEvent({ userId: null, email: "nobody@example.com", success: false, reason: "unknown_user", ip: "192.0.2.1", userAgent: null, now: minutes(i) });
    }
    expect(bursts()).toHaveLength(0);
  });
});
