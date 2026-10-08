import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createPanelLoginUrl: vi.fn(),
  revealPanelPassword: vi.fn(),
  resetPanelPassword: vi.fn(),
  logActivity: vi.fn(),
}));

vi.mock("@/lib/utils/auth-helpers", () => ({
  requireCustomer: vi.fn().mockResolvedValue({ user: { id: "cus-1" } }),
  requirePermission: vi.fn().mockResolvedValue({ user: { id: "adm-1" } }),
}));
vi.mock("@/lib/services/panel-access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/services/panel-access")>()),
  createPanelLoginUrl: mocks.createPanelLoginUrl,
  revealPanelPassword: mocks.revealPanelPassword,
  resetPanelPassword: mocks.resetPanelPassword,
}));
vi.mock("@/lib/activity-log", () => ({ logActivity: mocks.logActivity }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { openServicePanelAsAdmin } from "../admin/hosting-panel";
import { openHostingPanel, resetHostingPanelPassword, revealHostingPanelPassword } from "./hosting-panel";

const SSO_URL = "https://whm.test:2083/cpsess4567890123/login/?session=ornekcom%3aAbCd";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.logActivity.mockResolvedValue(undefined);
  mocks.createPanelLoginUrl.mockResolvedValue({ ok: true, data: { url: SSO_URL, remoteId: "ornekcom", customerId: "cus-1" } });
  mocks.revealPanelPassword.mockResolvedValue({ ok: true, data: { username: "ornekcom", password: "Gizli-Sifre-123", setAt: null } });
  mocks.resetPanelPassword.mockResolvedValue({ ok: true, data: { username: "ornekcom", password: "Yeni-Sifre-456" } });
});

describe("customer hosting panel actions", () => {
  it("checks ownership as the signed-in customer and returns the login URL", async () => {
    expect(await openHostingPanel("svc-1", "fileManager")).toEqual({ success: true, url: SSO_URL });
    expect(mocks.createPanelLoginUrl).toHaveBeenCalledWith("svc-1", "fileManager", { kind: "customer", userId: "cus-1" });
  });

  it("rejects unknown links before touching the panel", async () => {
    expect(await openHostingPanel("svc-1", "ssh" as never)).toMatchObject({ success: false });
    expect(mocks.createPanelLoginUrl).not.toHaveBeenCalled();
  });

  it("passes the generic error through (no remote details)", async () => {
    mocks.createPanelLoginUrl.mockResolvedValue({ ok: false, error: "NOT_FOUND", message: "Hizmet bulunamadı." });
    expect(await openHostingPanel("svc-2", "panel")).toEqual({ success: false, error: "Hizmet bulunamadı." });
  });

  it("logs reveals and resets without the password", async () => {
    expect(await revealHostingPanelPassword("svc-1")).toMatchObject({ success: true, password: "Gizli-Sifre-123" });
    expect(await resetHostingPanelPassword("svc-1")).toMatchObject({ success: true, password: "Yeni-Sifre-456" });
    expect(mocks.logActivity.mock.calls.map(([entry]) => entry.action)).toEqual([
      "SERVICE_PANEL_PASSWORD_REVEAL",
      "SERVICE_PANEL_PASSWORD_RESET",
    ]);
    const logged = JSON.stringify(mocks.logActivity.mock.calls);
    expect(logged).not.toContain("Gizli-Sifre-123");
    expect(logged).not.toContain("Yeni-Sifre-456");
  });

  it("rate-limits password resets", async () => {
    // Fresh customer id → fresh bucket (in-memory limiter under vitest).
    const { requireCustomer } = await import("@/lib/utils/auth-helpers");
    vi.mocked(requireCustomer).mockResolvedValue({ user: { id: "cus-rate" } } as never);
    const results = [];
    for (let i = 0; i < 4; i += 1) results.push(await resetHostingPanelPassword("svc-1"));
    expect(results.slice(0, 3).every((r) => r.success)).toBe(true);
    expect(results[3]).toMatchObject({ success: false, error: expect.stringContaining("Çok fazla") });
    expect(mocks.resetPanelPassword).toHaveBeenCalledTimes(3);
  });
});

describe("admin cPanel login as customer", () => {
  it("records the login in the activity log without the URL", async () => {
    expect(await openServicePanelAsAdmin("svc-1", "panel")).toEqual({ success: true, url: SSO_URL });
    expect(mocks.createPanelLoginUrl).toHaveBeenCalledWith("svc-1", "panel", { kind: "admin", userId: "adm-1" });
    expect(mocks.logActivity).toHaveBeenCalledWith({
      userId: "adm-1",
      action: "SERVICE_PANEL_LOGIN_AS_CUSTOMER",
      entity: "Service",
      entityId: "svc-1",
      details: { link: "panel", remoteId: "ornekcom", customerId: "cus-1" },
    });
    expect(JSON.stringify(mocks.logActivity.mock.calls)).not.toContain("cpsess");
  });

  it("logs nothing when the login could not be created", async () => {
    mocks.createPanelLoginUrl.mockResolvedValue({ ok: false, error: "REMOTE_ERROR", message: "x" });
    expect(await openServicePanelAsAdmin("svc-1", "webmail")).toEqual({ success: false, error: "x" });
    expect(mocks.logActivity).not.toHaveBeenCalled();
  });
});
