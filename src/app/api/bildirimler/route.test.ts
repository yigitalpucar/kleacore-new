import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  updateMany: vi.fn(async (_args: unknown) => ({ count: 2 })),
  findMany: vi.fn(async (_args: unknown) => [] as unknown[]),
  count: vi.fn(async (_args: unknown) => 0),
}));

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({
  db: { notification: { updateMany: mocks.updateMany, findMany: mocks.findMany, count: mocks.count } },
}));
vi.mock("@/lib/support/http", () => ({
  isSameOriginRequest: (r: NextRequest) => r.headers.get("origin") === "http://localhost",
}));

import { GET, POST } from "./route";

const post = (body: unknown, origin = "http://localhost") =>
  new NextRequest("http://localhost/api/bildirimler", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", origin },
  });

beforeEach(() => {
  mocks.auth.mockReset();
  mocks.updateMany.mockClear();
  mocks.findMany.mockClear();
});

describe("/api/bildirimler", () => {
  it("GET lists only the session user's notifications", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "u-1" } });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "u-1" } }));
  });

  it("GET 401 without a session", async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it("marking ids read is scoped to the session user", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "u-1" } });
    const res = await POST(post({ ids: ["n-1", "n-of-someone-else"] }));
    expect(res.status).toBe(200);
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { userId: "u-1", isRead: false, id: { in: ["n-1", "n-of-someone-else"] } },
      data: { isRead: true, readAt: expect.any(Date) },
    });
  });

  it("mark all read touches only the user's unread rows", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "u-1" } });
    await POST(post({ all: true }));
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "u-1", isRead: false } }));
  });

  it("rejects cross-site posts and bad bodies", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "u-1" } });
    expect((await POST(post({ all: true }, "https://evil.example"))).status).toBe(403);
    expect((await POST(post({ ids: [] }))).status).toBe(400);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});
