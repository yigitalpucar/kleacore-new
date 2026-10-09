import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loginDeleteMany: vi.fn(async (_args: unknown) => ({ count: 4 })),
  deviceDeleteMany: vi.fn(async (_args: unknown) => ({ count: 0 })),
}));

vi.mock("@/lib/db", () => ({
  db: {
    loginEvent: { deleteMany: mocks.loginDeleteMany },
    trustedDevice: { deleteMany: mocks.deviceDeleteMany },
    dataRequest: { findMany: vi.fn(async () => []) },
  },
}));
vi.mock("./export", () => ({ purgeExpiredExports: vi.fn(async () => 0) }));
vi.mock("./requests", () => ({ cancelExpiredVerifications: vi.fn(async () => 0) }));

import { LOGIN_EVENT_RETENTION_DAYS, runPrivacyMaintenance } from "./maintenance";

describe("privacy-maintenance: sign-in history retention", () => {
  it("keeps login events for one year and prunes older rows", async () => {
    expect(LOGIN_EVENT_RETENTION_DAYS).toBe(365);
    const now = new Date("2026-10-09T09:30:00Z");
    const result = await runPrivacyMaintenance(now);
    expect(mocks.loginDeleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: new Date("2025-10-09T09:30:00Z") } },
    });
    expect(result.loginEventsDeleted).toBe(4);
  });
});
