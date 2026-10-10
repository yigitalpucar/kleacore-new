import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAnyPermission: vi.fn(),
  search: vi.fn(async (_role: unknown, _q: string) => [] as unknown[]),
}));

vi.mock("@/lib/utils/auth-helpers", () => ({ requireAnyPermission: mocks.requireAnyPermission }));
vi.mock("@/lib/search/rate", () => ({ allowSearch: async () => ({ allowed: true, remaining: 1 }) }));
vi.mock("@/lib/search/command-search", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/search/command-search")>()),
  searchStaffRecords: mocks.search,
}));

import { GET } from "./route";

beforeEach(() => {
  mocks.requireAnyPermission.mockReset();
  mocks.search.mockClear();
});

describe("GET /api/admin/arama (staff ⌘K)", () => {
  it("requires a staff view permission before searching", async () => {
    mocks.requireAnyPermission.mockRejectedValue(new Error("NEXT_HTTP_ERROR_FALLBACK;403"));
    await expect(GET(new NextRequest("http://localhost/api/admin/arama?q=ornek"))).rejects.toThrow("403");
    expect(mocks.search).not.toHaveBeenCalled();
  });

  it("searches with the session role (per-group permissions applied downstream)", async () => {
    mocks.requireAnyPermission.mockResolvedValue({ user: { id: "s-1", role: "BILLING" } });
    const res = await GET(new NextRequest("http://localhost/api/admin/arama?q=F-2026"));
    expect(res.status).toBe(200);
    expect(mocks.search).toHaveBeenCalledWith("BILLING", "F-2026");
  });
});
