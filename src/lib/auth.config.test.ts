import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: { user: { findUnique: vi.fn() } } }));

import { authConfig } from "./auth.config";

function authorized(role: string | null, pathname: string) {
  const auth = role ? { user: { id: "u1", role }, expires: "" } : null;
  return authConfig.callbacks.authorized({
    auth,
    request: { nextUrl: new URL(`https://kleacore.com${pathname}`) },
  } as unknown as Parameters<typeof authConfig.callbacks.authorized>[0]);
}

describe("proxy gate for /yonetim", () => {
  it("lets every staff role in (pages check their own permission)", () => {
    for (const role of ["ADMIN", "SUPPORT", "BILLING"]) expect(authorized(role, "/yonetim")).toBe(true);
  });

  it("answers 403 (rewrite to /yonetim/yetkisiz) for routes the role cannot open", () => {
    const res = authorized("SUPPORT", "/yonetim/faturalar/abc");
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(403);
    expect((res as Response).headers.get("x-middleware-rewrite")).toContain("/yonetim/yetkisiz");
    expect(authorized("BILLING", "/yonetim/faturalar/abc")).toBe(true);
    expect(authorized("ADMIN", "/yonetim/personel")).toBe(true);
  });

  it("keeps customers and anonymous users out", () => {
    expect(authorized("CUSTOMER", "/yonetim")).toBe(false);
    expect(authorized(null, "/yonetim")).toBe(false);
  });

  it("leaves the customer panel unchanged", () => {
    expect(authorized("CUSTOMER", "/musteri/panel")).toBe(true);
    expect(authorized(null, "/musteri/panel")).toBe(false);
  });
});
