import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: { user: { findUnique: vi.fn() } },
}));

vi.mock("@/lib/db", () => ({ db: mocks.db }));

import { SESSION_RECHECK_INTERVAL_MS, refreshSessionToken } from "./session-refresh";

const NOW = 1_700_000_000_000;

describe("refreshSessionToken", () => {
  it("stamps role, sessionVersion and check time on sign-in", async () => {
    const token = await refreshSessionToken(
      {},
      { id: "u1", role: "ADMIN", sessionVersion: 2 },
      NOW
    );

    expect(token).toMatchObject({ id: "u1", role: "ADMIN", sessionVersion: 2, checkedAt: NOW });
    expect(mocks.db.user.findUnique).not.toHaveBeenCalled();
  });

  it("does not hit the database inside the re-check interval", async () => {
    const token = { id: "u1", role: "ADMIN", sessionVersion: 0, checkedAt: NOW };
    expect(await refreshSessionToken(token, undefined, NOW + 60_000)).toBe(token);
    expect(mocks.db.user.findUnique).not.toHaveBeenCalled();
  });

  it("refreshes a demoted admin's role after the interval", async () => {
    mocks.db.user.findUnique.mockResolvedValue({ role: "CUSTOMER", status: "ACTIVE", sessionVersion: 0 });
    const later = NOW + SESSION_RECHECK_INTERVAL_MS;

    const token = await refreshSessionToken(
      { id: "u1", role: "ADMIN", sessionVersion: 0, checkedAt: NOW },
      undefined,
      later
    );

    expect(token).toMatchObject({ role: "CUSTOMER", checkedAt: later });
  });

  it("revokes sessions of suspended users", async () => {
    mocks.db.user.findUnique.mockResolvedValue({ role: "CUSTOMER", status: "SUSPENDED", sessionVersion: 0 });

    expect(
      await refreshSessionToken({ id: "u1", role: "CUSTOMER", sessionVersion: 0 }, undefined, NOW)
    ).toBeNull();
  });

  it("revokes sessions issued before a password change/reset", async () => {
    mocks.db.user.findUnique.mockResolvedValue({ role: "CUSTOMER", status: "ACTIVE", sessionVersion: 1 });

    expect(
      await refreshSessionToken({ id: "u1", role: "CUSTOMER", sessionVersion: 0, checkedAt: 0 }, undefined, NOW)
    ).toBeNull();
  });

  it("treats tokens from before this change as version 0", async () => {
    mocks.db.user.findUnique.mockResolvedValue({ role: "CUSTOMER", status: "ACTIVE", sessionVersion: 0 });

    const token = await refreshSessionToken({ id: "u1", role: "CUSTOMER" }, undefined, NOW);
    expect(token).toMatchObject({ sessionVersion: 0, checkedAt: NOW });
  });

  it("revokes sessions of deleted users", async () => {
    mocks.db.user.findUnique.mockResolvedValue(null);
    expect(await refreshSessionToken({ id: "u1" }, undefined, NOW)).toBeNull();
  });

  it("keeps the session on a transient database error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.db.user.findUnique.mockRejectedValue(new Error("db down"));
    const token = { id: "u1", role: "CUSTOMER", sessionVersion: 0, checkedAt: 0 };

    expect(await refreshSessionToken(token, undefined, NOW)).toEqual(token);
  });
});
