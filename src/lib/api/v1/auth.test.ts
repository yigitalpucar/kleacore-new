import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: { apiKey: { findMany: vi.fn(), update: vi.fn() } },
}));

vi.mock("@/lib/db", () => ({ db: mocks.db }));

import { hashApiKey } from "@/lib/secrets/api-keys";
import { authenticateApiRequest } from "./auth";

const KEY = "kc_live_0123456789abcdef0123456789abcdef0123456789abcdef";

function request() {
  return new Request("http://localhost/api/v1/services", {
    headers: { authorization: `Bearer ${KEY}` },
  });
}

function candidate(status: string) {
  return {
    id: "key_1",
    userId: "user_1",
    keyHash: hashApiKey(KEY),
    expiresAt: null,
    user: { status },
  };
}

describe("authenticateApiRequest", () => {
  it("authenticates a valid key of an active user", async () => {
    mocks.db.apiKey.findMany.mockResolvedValue([candidate("ACTIVE")]);

    expect(await authenticateApiRequest(request())).toEqual({
      apiKeyId: "key_1",
      customerId: "user_1",
    });
  });

  it.each(["SUSPENDED", "CLOSED"])("rejects keys of %s users", async (status) => {
    mocks.db.apiKey.findMany.mockResolvedValue([candidate(status)]);

    expect(await authenticateApiRequest(request())).toBeNull();
    expect(mocks.db.apiKey.update).not.toHaveBeenCalled();
  });
});
