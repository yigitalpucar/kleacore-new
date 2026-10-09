import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  create: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  logActivity: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { staffApiToken: { count: mocks.count, create: mocks.create, findUnique: mocks.findUnique, update: mocks.update } },
}));
vi.mock("@/lib/activity-log", () => ({ logActivity: mocks.logActivity }));

import { hashApiKey } from "@/lib/secrets/api-keys";
import { isIpAllowed, parseAllowlist } from "./ip";
import { decodeCursor, encodeCursor, pageOf } from "./pagination";
import { effectiveScopes } from "./scopes";
import { ADMIN_TOKEN_PREFIX, TokenError, adminTokenPrefix, createStaffApiToken, revokeStaffApiToken, tokenState } from "./tokens";

beforeEach(() => {
  mocks.count.mockResolvedValue(0);
  mocks.create.mockImplementation(async ({ data }) => ({ id: "tok_1", ...data }));
  mocks.update.mockImplementation(async ({ data }) => ({ id: "tok_1", ...data }));
});

describe("createStaffApiToken", () => {
  it("returns the secret once and stores only prefix + hash", async () => {
    const { secret, token } = await createStaffApiToken(
      { id: "staff_1", role: "SUPPORT" },
      { name: "Destek botu", scopes: ["tickets.view", "tickets.reply"], ipAllowlist: "198.51.100.0/24\n2001:db8::/32", expiresInDays: 30 }
    );
    expect(secret.startsWith(ADMIN_TOKEN_PREFIX)).toBe(true);
    const data = mocks.create.mock.calls[0][0].data;
    expect(data.tokenHash).toBe(hashApiKey(secret));
    expect(data.tokenPrefix).toBe(adminTokenPrefix(secret));
    expect(JSON.stringify(data)).not.toContain(secret);
    expect(data.ipAllowlist).toEqual(["198.51.100.0/24", "2001:db8::/32"]);
    expect(data.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000);
    expect(token.id).toBe("tok_1");
    expect(mocks.logActivity).toHaveBeenCalledWith(expect.objectContaining({ action: "STAFF_API_TOKEN_CREATE", userId: "staff_1" }));
  });

  it("refuses scopes the creator does not hold", async () => {
    await expect(
      createStaffApiToken({ id: "staff_1", role: "SUPPORT" }, { name: "x", scopes: ["tickets.view", "invoices.edit"] })
    ).rejects.toThrow(/invoices\.edit/);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("refuses unknown scopes, bad IPs and non-staff owners", async () => {
    await expect(createStaffApiToken({ id: "a", role: "ADMIN" }, { name: "x", scopes: ["root"] })).rejects.toThrow(TokenError);
    await expect(
      createStaffApiToken({ id: "a", role: "ADMIN" }, { name: "x", scopes: ["customers.view"], ipAllowlist: "10.0.0.0/33" })
    ).rejects.toThrow(/10\.0\.0\.0\/33/);
    await expect(createStaffApiToken({ id: "c", role: "CUSTOMER" }, { name: "x", scopes: ["customers.view"] })).rejects.toThrow(TokenError);
  });
});

describe("revokeStaffApiToken", () => {
  it("lets the owner revoke their own token", async () => {
    mocks.findUnique.mockResolvedValue({ id: "tok_1", userId: "staff_1", name: "x", tokenPrefix: "kc_admin_1", revokedAt: null });
    await revokeStaffApiToken({ id: "staff_1", role: "SUPPORT" }, "tok_1");
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ revokedById: "staff_1" }) }));
  });

  it("lets staff.manage revoke anyone's token but not other staff", async () => {
    mocks.findUnique.mockResolvedValue({ id: "tok_1", userId: "staff_1", name: "x", tokenPrefix: "kc_admin_1", revokedAt: null });
    await expect(revokeStaffApiToken({ id: "staff_2", role: "BILLING" }, "tok_1")).rejects.toThrow(TokenError);
    await revokeStaffApiToken({ id: "admin_1", role: "ADMIN" }, "tok_1");
    expect(mocks.update).toHaveBeenCalledTimes(1);
  });
});

describe("effectiveScopes", () => {
  it("is the stored scopes the owner's current role still grants", () => {
    const stored = ["customers.view", "customers.edit", "tickets.reply", "nope"];
    expect(effectiveScopes(stored, "ADMIN")).toEqual(["customers.view", "customers.edit", "tickets.reply"]);
    expect(effectiveScopes(stored, "SUPPORT")).toEqual(["customers.view", "tickets.reply"]);
    expect(effectiveScopes(stored, "CUSTOMER")).toEqual([]);
  });
});

describe("IP allowlist", () => {
  it("parses entries and matches v4/v6 addresses and ranges", () => {
    expect(parseAllowlist("1.2.3.4, 10.0.0.0/8 bad ::1").invalid).toEqual(["bad"]);
    expect(isIpAllowed("10.20.30.40", ["10.0.0.0/8"])).toBe(true);
    expect(isIpAllowed("11.0.0.1", ["10.0.0.0/8"])).toBe(false);
    expect(isIpAllowed("2001:db8::abcd", ["2001:db8::/32"])).toBe(true);
    expect(isIpAllowed(null, ["10.0.0.0/8"])).toBe(false);
    expect(isIpAllowed(null, [])).toBe(true);
  });
});

describe("cursor pagination", () => {
  it("round-trips the cursor and reports the next page", () => {
    const rows = [1, 2, 3].map((n) => ({ id: `r${n}`, createdAt: new Date(Date.UTC(2026, 0, n)) }));
    const page = pageOf(rows, 2, (row) => row.createdAt);
    expect(page.items.map((row) => row.id)).toEqual(["r1", "r2"]);
    expect(page.pagination.hasMore).toBe(true);
    expect(decodeCursor(page.pagination.nextCursor!)).toEqual({ id: "r2", value: rows[1].createdAt });

    const last = pageOf(rows.slice(0, 2), 2, (row) => row.createdAt);
    expect(last.pagination).toEqual({ nextCursor: null, hasMore: false, limit: 2 });
  });

  it("rejects a tampered cursor with 400 invalid_cursor", () => {
    expect(() => decodeCursor("not-a-cursor")).toThrow(expect.objectContaining({ status: 400, code: "invalid_cursor" }));
    expect(decodeCursor(encodeCursor(new Date(0), "x"))).toEqual({ id: "x", value: new Date(0) });
  });
});

describe("tokenState", () => {
  it("derives revoked / expired / active", () => {
    expect(tokenState({ revokedAt: new Date(), expiresAt: null })).toBe("revoked");
    expect(tokenState({ revokedAt: null, expiresAt: new Date(Date.now() - 1) })).toBe("expired");
    expect(tokenState({ revokedAt: null, expiresAt: null })).toBe("active");
  });
});
