/**
 * Admin API request pipeline (adminApiRoute) against an in-memory db:
 * token auth (expiry, revocation, IP allowlist), scope enforcement incl.
 * owner demotion, rate limit, Idempotency-Key replay and audit logging.
 */
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod/v4";

type TokenRow = {
  id: string;
  name: string;
  tokenPrefix: string;
  tokenHash: string;
  scopes: string[];
  ipAllowlist: string[];
  rateLimitPerMinute: number;
  expiresAt: Date | null;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  lastUsedIp: string | null;
  userId: string;
};
type UserRow = { id: string; role: string; status: string; name: string; surname: string; email: string };
type IdemRow = {
  id: string;
  tokenId: string;
  key: string;
  method: string;
  path: string;
  requestHash: string;
  responseStatus: number | null;
  responseBody: unknown;
  completedAt: Date | null;
  expiresAt: Date;
};

const state = vi.hoisted(() => ({
  tokens: [] as TokenRow[],
  users: [] as UserRow[],
  idem: [] as IdemRow[],
  activity: [] as Array<{ data: Record<string, unknown> }>,
  twoFactorMissing: false,
  seq: 0,
}));

vi.mock("@/lib/utils/auth-helpers", () => ({ staffTwoFactorMissing: vi.fn(async () => state.twoFactorMissing) }));
vi.mock("@/lib/db", () => {
  const withUser = (token: TokenRow) => ({ ...token, user: state.users.find((user) => user.id === token.userId)! });
  return {
    db: {
      staffApiToken: {
        findMany: vi.fn(async ({ where }: { where: { tokenPrefix: string } }) =>
          state.tokens.filter((token) => token.tokenPrefix === where.tokenPrefix).map(withUser)
        ),
        update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<TokenRow> }) => {
          const token = state.tokens.find((row) => row.id === where.id)!;
          Object.assign(token, data);
          return token;
        }),
      },
      adminApiIdempotencyKey: {
        deleteMany: vi.fn(async ({ where }: { where: { id?: string; tokenId?: string; completedAt?: null; expiresAt?: { lte: Date } } }) => {
          const before = state.idem.length;
          state.idem = state.idem.filter(
            (row) =>
              !(
                (where.id === undefined || row.id === where.id) &&
                (where.tokenId === undefined || row.tokenId === where.tokenId) &&
                (where.completedAt === undefined || row.completedAt === null) &&
                (where.expiresAt === undefined || row.expiresAt <= where.expiresAt.lte)
              )
          );
          return { count: before - state.idem.length };
        }),
        create: vi.fn(async ({ data }: { data: Omit<IdemRow, "id" | "responseStatus" | "responseBody" | "completedAt"> }) => {
          if (state.idem.some((row) => row.tokenId === data.tokenId && row.key === data.key)) {
            throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" });
          }
          const row = { ...data, id: `idem_${++state.seq}`, responseStatus: null, responseBody: null, completedAt: null };
          state.idem.push(row);
          return { id: row.id };
        }),
        findUnique: vi.fn(async ({ where }: { where: { tokenId_key: { tokenId: string; key: string } } }) =>
          state.idem.find((row) => row.tokenId === where.tokenId_key.tokenId && row.key === where.tokenId_key.key) ?? null
        ),
        update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<IdemRow> }) => {
          Object.assign(state.idem.find((row) => row.id === where.id)!, data);
        }),
      },
      activityLog: {
        create: vi.fn(async (args: { data: Record<string, unknown> }) => {
          state.activity.push(args);
        }),
      },
    },
  };
});

import { hashApiKey } from "@/lib/secrets/api-keys";
import { ApiError } from "./errors";
import { defineOperation } from "./operation";
import { adminApiRoute } from "./route";
import { adminTokenPrefix } from "./tokens";

const SECRET = "kc_admin_0123456789abcdef0123456789abcdef0123456789abcdef";

const created: string[] = [];
const createThing = adminApiRoute(
  defineOperation({
    id: "createThing",
    method: "POST",
    path: "/things",
    tag: "Test",
    summary: "test",
    permission: "customers.edit",
    body: z.object({ name: z.string().min(1) }),
    response: z.object({ id: z.string() }),
    successStatus: 201,
    handler: async ({ body }) => {
      created.push(body.name);
      return { data: { id: `thing_${created.length}`, name: body.name } };
    },
  })
);
const listThings = adminApiRoute(
  defineOperation({
    id: "listThings",
    method: "GET",
    path: "/things",
    tag: "Test",
    summary: "test",
    permission: "customers.view",
    response: z.object({ id: z.string() }),
    handler: async () => ({ data: [{ id: "thing_1" }] }),
  })
);
const failing = adminApiRoute(
  defineOperation({
    id: "failing",
    method: "POST",
    path: "/fail",
    tag: "Test",
    summary: "test",
    permission: "customers.edit",
    response: z.object({}),
    handler: async () => {
      throw new Error("boom");
    },
  })
);

let conflicts = 0;
const conflicting = adminApiRoute(
  defineOperation({
    id: "conflicting",
    method: "POST",
    path: "/conflict",
    tag: "Test",
    summary: "test",
    permission: "customers.edit",
    response: z.object({}),
    handler: async () => {
      conflicts += 1;
      throw new ApiError(409, "conflict", "Sadece aktif hizmetler askıya alınabilir");
    },
  })
);

function seed(overrides: Partial<TokenRow> = {}, role = "ADMIN") {
  const id = `tok_${++state.seq}`;
  state.users = [{ id: "staff_1", role, status: "ACTIVE", name: "Ayşe", surname: "Yılmaz", email: "ayse@test.local" }];
  state.tokens = [
    {
      id,
      name: "ajan",
      tokenPrefix: adminTokenPrefix(SECRET),
      tokenHash: hashApiKey(SECRET),
      scopes: ["customers.view", "customers.edit"],
      ipAllowlist: [],
      rateLimitPerMinute: 100,
      expiresAt: null,
      revokedAt: null,
      lastUsedAt: null,
      lastUsedIp: null,
      userId: "staff_1",
      ...overrides,
    },
  ];
  return state.tokens[0];
}

function call(
  handler: typeof listThings,
  init: { method?: string; body?: unknown; headers?: Record<string, string>; ip?: string; secret?: string | null } = {}
) {
  const headers: Record<string, string> = { "x-forwarded-for": init.ip ?? "203.0.113.7", ...init.headers };
  if (init.secret !== null) headers.authorization = `Bearer ${init.secret ?? SECRET}`;
  const url = `http://localhost/api/admin/v1${handler.operation.path}`;
  const request = new Request(url, {
    method: init.method ?? handler.operation.method,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  return handler(request, { params: Promise.resolve({}) });
}

async function errorCode(response: Response) {
  return ((await response.json()) as { error: { code: string } }).error.code;
}

beforeEach(() => {
  state.idem = [];
  state.activity = [];
  state.twoFactorMissing = false;
  created.length = 0;
  conflicts = 0;
});

describe("authentication", () => {
  it("accepts a valid token and wraps the result in { data }", async () => {
    seed();
    const response = await call(listThings);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [{ id: "thing_1" }] });
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect(response.headers.get("x-ratelimit-limit")).toBe("100");
  });

  it("rejects a missing or unknown token", async () => {
    seed();
    const missing = await call(listThings, { secret: null });
    expect(missing.status).toBe(401);
    expect(await errorCode(missing)).toBe("unauthenticated");

    const unknown = await call(listThings, { secret: `${SECRET.slice(0, -1)}0` });
    expect(unknown.status).toBe(401);
    expect(await errorCode(unknown)).toBe("invalid_token");
  });

  it("rejects an expired token", async () => {
    seed({ expiresAt: new Date(Date.now() - 1000) });
    const response = await call(listThings);
    expect(response.status).toBe(401);
    expect(await errorCode(response)).toBe("token_expired");
  });

  it("rejects a revoked token", async () => {
    seed({ revokedAt: new Date() });
    const response = await call(listThings);
    expect(await errorCode(response)).toBe("token_revoked");
  });

  it("accepts a token that has not expired yet", async () => {
    seed({ expiresAt: new Date(Date.now() + 60_000) });
    expect((await call(listThings)).status).toBe(200);
  });

  it("enforces the IP allowlist (addresses and CIDR ranges)", async () => {
    seed({ ipAllowlist: ["198.51.100.0/24", "2001:db8::1"] });
    expect((await call(listThings, { ip: "198.51.100.42" })).status).toBe(200);
    expect((await call(listThings, { ip: "::ffff:198.51.100.9" })).status).toBe(200);
    expect((await call(listThings, { ip: "2001:db8::1" })).status).toBe(200);

    const denied = await call(listThings, { ip: "203.0.113.7" });
    expect(denied.status).toBe(403);
    expect(await errorCode(denied)).toBe("ip_not_allowed");
  });

  it("stops working when the owner is deactivated or demoted to customer", async () => {
    seed();
    state.users[0].status = "SUSPENDED";
    expect(await errorCode(await call(listThings))).toBe("owner_inactive");

    state.users[0].status = "ACTIVE";
    state.users[0].role = "CUSTOMER";
    expect(await errorCode(await call(listThings))).toBe("owner_inactive");
  });

  it("stops working when the owner's role no longer allows API tokens", async () => {
    seed();
    const permissions = await import("@/lib/auth/permissions");
    const spy = vi.spyOn(permissions, "hasPermission").mockImplementation((_role, permission) => permission !== "api_tokens.manage");
    const response = await call(listThings);
    spy.mockRestore();
    expect(response.status).toBe(403);
    expect(await errorCode(response)).toBe("owner_not_allowed");
  });

  it("requires the owner's 2FA when staff 2FA is mandatory", async () => {
    seed();
    state.twoFactorMissing = true;
    const response = await call(listThings);
    expect(response.status).toBe(403);
    expect(await errorCode(response)).toBe("owner_two_factor_required");
  });

  it("records last use time and IP", async () => {
    const token = seed();
    await call(listThings, { ip: "198.51.100.5" });
    expect(token.lastUsedIp).toBe("198.51.100.5");
    expect(token.lastUsedAt).toBeInstanceOf(Date);
  });
});

describe("scopes", () => {
  it("refuses an operation outside the token's scopes", async () => {
    seed({ scopes: ["customers.view"] });
    expect((await call(listThings)).status).toBe(200);

    const response = await call(createThing, { body: { name: "x" } });
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "insufficient_scope", details: { required: "customers.edit" } });
    expect(created).toEqual([]);
  });

  it("shrinks with the owner's role: a demoted owner's token loses the scopes the new role lacks", async () => {
    // ADMIN created a token with customers.view + customers.edit.
    seed({ scopes: ["customers.view", "customers.edit"] }, "ADMIN");
    expect((await call(createThing, { body: { name: "before" } })).status).toBe(201);

    // Demoted to SUPPORT (customers.view only): the stored scopes stay, but
    // edit is no longer effective — re-checked on this very request.
    state.users[0].role = "SUPPORT";
    const denied = await call(createThing, { body: { name: "after" } });
    expect(denied.status).toBe(403);
    expect(await errorCode(denied)).toBe("insufficient_scope");
    expect((await call(listThings)).status).toBe(200);
    expect(created).toEqual(["before"]);

    // Promoted back: the token works again without being re-issued.
    state.users[0].role = "ADMIN";
    expect((await call(createThing, { body: { name: "again" } })).status).toBe(201);
  });

  it("ignores scope names that are not permissions", async () => {
    seed({ scopes: ["customers.view", "everything.*"] });
    const response = await call(createThing, { body: { name: "x" } });
    expect(await errorCode(response)).toBe("insufficient_scope");
  });
});

describe("validation and errors", () => {
  it("answers 422 with the zod issues for an invalid body", async () => {
    seed();
    const response = await call(createThing, { body: { name: "" } });
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("validation_failed");
    expect(body.error.details.issues[0].path).toBe("name");
    expect(body.requestId).toEqual(expect.any(String));
  });

  it("answers 400 for malformed JSON", async () => {
    seed();
    const request = new Request("http://localhost/api/admin/v1/things", {
      method: "POST",
      headers: { authorization: `Bearer ${SECRET}` },
      body: "{nope",
    });
    const response = await createThing(request, { params: Promise.resolve({}) });
    expect(response.status).toBe(400);
    expect(await errorCode(response)).toBe("invalid_json");
  });

  it("hides unexpected errors behind internal_error", async () => {
    seed();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await call(failing, { body: {} });
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: { code: "internal_error" } });
  });
});

describe("rate limit", () => {
  it("answers 429 with Retry-After once the per-token limit is used up", async () => {
    seed({ rateLimitPerMinute: 2 });
    expect((await call(listThings)).status).toBe(200);
    expect((await call(listThings)).status).toBe(200);
    const limited = await call(listThings);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toMatch(/^\d+$/);
    expect(await errorCode(limited)).toBe("rate_limited");
  });
});

describe("Idempotency-Key", () => {
  it("replays the first response for the same key and body without running the operation again", async () => {
    seed();
    const first = await call(createThing, { body: { name: "a" }, headers: { "idempotency-key": "k-1" } });
    expect(first.status).toBe(201);
    const firstBody = await first.json();

    const replay = await call(createThing, { body: { name: "a" }, headers: { "idempotency-key": "k-1" } });
    expect(replay.status).toBe(201);
    expect(replay.headers.get("idempotent-replayed")).toBe("true");
    expect(await replay.json()).toEqual(firstBody);
    expect(created).toEqual(["a"]);
  });

  it("rejects the same key with a different body", async () => {
    seed();
    await call(createThing, { body: { name: "a" }, headers: { "idempotency-key": "k-2" } });
    const reused = await call(createThing, { body: { name: "b" }, headers: { "idempotency-key": "k-2" } });
    expect(reused.status).toBe(422);
    expect(await errorCode(reused)).toBe("idempotency_key_reused");
    expect(created).toEqual(["a"]);
  });

  it("answers 409 while the first request with the key is still running", async () => {
    const token = seed();
    state.idem.push({
      id: "idem_running",
      tokenId: token.id,
      key: "k-3",
      method: "POST",
      path: "/api/admin/v1/things",
      requestHash: (await import("./idempotency")).requestFingerprint("POST", "/api/admin/v1/things", JSON.stringify({ name: "a" })),
      responseStatus: null,
      responseBody: null,
      completedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const response = await call(createThing, { body: { name: "a" }, headers: { "idempotency-key": "k-3" } });
    expect(response.status).toBe(409);
    expect(await errorCode(response)).toBe("idempotency_key_in_use");
    expect(created).toEqual([]);
  });

  it("keys are per token and expire", async () => {
    const token = seed();
    await call(createThing, { body: { name: "a" }, headers: { "idempotency-key": "k-4" } });
    state.idem[0].expiresAt = new Date(Date.now() - 1);
    await call(createThing, { body: { name: "a" }, headers: { "idempotency-key": "k-4" } });
    expect(created).toEqual(["a", "a"]);
    expect(state.idem.filter((row) => row.tokenId === token.id)).toHaveLength(1);
  });

  it("forgets the key after a server error so the client can retry", async () => {
    seed();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await call(failing, { body: {}, headers: { "idempotency-key": "k-5" } });
    expect(response.status).toBe(500);
    expect(state.idem).toHaveLength(0);
  });

  it("stores business refusals (4xx from the operation) and replays them", async () => {
    seed();
    const first = await call(conflicting, { body: {}, headers: { "idempotency-key": "k-6" } });
    expect(first.status).toBe(409);
    const second = await call(conflicting, { body: {}, headers: { "idempotency-key": "k-6" } });
    expect(second.status).toBe(409);
    expect(second.headers.get("idempotent-replayed")).toBe("true");
    expect(conflicts).toBe(1);
  });

  it("does not store requests rejected before the operation ran (validation)", async () => {
    seed();
    expect((await call(createThing, { body: { name: "" }, headers: { "idempotency-key": "k-8" } })).status).toBe(422);
    expect(state.idem).toHaveLength(0);
    expect((await call(createThing, { body: { name: "" }, headers: { "idempotency-key": "k-8" } })).headers.get("idempotent-replayed")).toBeNull();
  });

  it("rejects an invalid key", async () => {
    seed();
    const response = await call(createThing, { body: { name: "a" }, headers: { "idempotency-key": "bad key with spaces" } });
    expect(response.status).toBe(400);
    expect(await errorCode(response)).toBe("idempotency_key_invalid");
  });
});

describe("audit log", () => {
  it("logs every call with token, owner, endpoint, method, status and IP", async () => {
    const token = seed({ scopes: ["customers.view"] });
    await call(listThings, { ip: "198.51.100.77" });
    await call(createThing, { body: { name: "x" }, ip: "198.51.100.77" });

    expect(state.activity).toHaveLength(2);
    expect(state.activity[0].data).toMatchObject({
      userId: "staff_1",
      action: "ADMIN_API_REQUEST",
      entity: "StaffApiToken",
      entityId: token.id,
      ipAddress: "198.51.100.77",
      details: { token: "ajan", operation: "listThings", method: "GET", endpoint: "/things", path: "/api/admin/v1/things", status: 200 },
    });
    expect(state.activity[1].data).toMatchObject({
      details: { operation: "createThing", method: "POST", status: 403, error: "insufficient_scope" },
    });
  });

  it("logs refused calls of a known token (expired / IP) to the owner", async () => {
    seed({ ipAllowlist: ["10.0.0.0/8"] });
    await call(listThings, { ip: "203.0.113.9" });
    expect(state.activity[0].data).toMatchObject({ userId: "staff_1", details: { status: 403, error: "ip_not_allowed" } });
  });

  it("marks idempotent replays", async () => {
    seed();
    await call(createThing, { body: { name: "a" }, headers: { "idempotency-key": "k-7" } });
    await call(createThing, { body: { name: "a" }, headers: { "idempotency-key": "k-7" } });
    expect(state.activity[1].data).toMatchObject({ details: { status: 201, idempotentReplay: true } });
  });

  it("cannot attribute calls without a valid token (application log only)", async () => {
    seed();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await call(listThings, { secret: "kc_admin_nope" });
    expect(state.activity).toHaveLength(0);
    expect(warn).toHaveBeenCalled();
  });
});
