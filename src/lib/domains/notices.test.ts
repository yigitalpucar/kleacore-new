import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  domainFindMany: vi.fn(),
  domainUpdateMany: vi.fn(),
  noticeCreate: vi.fn(),
  noticeDelete: vi.fn(),
  eventCreate: vi.fn(),
  sendNotification: vi.fn(),
  getSettingMap: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    domain: { findMany: mocks.domainFindMany, updateMany: mocks.domainUpdateMany },
    domainNotice: { create: mocks.noticeCreate, delete: mocks.noticeDelete },
    domainLifecycleEvent: { create: mocks.eventCreate },
  },
}));
vi.mock("@/lib/notifications/send", () => ({ sendNotification: mocks.sendNotification }));
vi.mock("@/lib/stripe", () => ({ getAppBaseUrl: () => "https://kleacore.test" }));
vi.mock("@/lib/integrations/settings", () => ({ getSettingMap: mocks.getSettingMap }));

import { noticeKindFor, sendDomainExpiryNotices } from "./notices";

const DAY = 86_400_000;
const now = new Date("2026-10-08T09:00:00Z");
const settings = { graceDays: 30, redemptionDays: 30 };
const at = (days: number) => new Date(now.getTime() + days * DAY);

describe("noticeKindFor", () => {
  it.each([
    [45, null],
    [30, "expiring_30"],
    [8, "expiring_30"],
    [7, "expiring_7"],
    [2, "expiring_7"],
    [1, "expiring_1"],
    [0.5, "expiring_1"],
    [0, "expired"],
    [-10, "expired"],
    [-25, "grace_ending"],
    [-29, "grace_ending"],
    [-30, "redemption"],
    [-59, "redemption"],
    [-60, null],
  ] as const)("%s days from expiry → %s", (days, kind) => {
    expect(noticeKindFor(at(days), now, settings)).toBe(kind);
  });
});

describe("sendDomainExpiryNotices", () => {
  const domain = { id: "dom-1", name: "ornek.com", customerId: "cust-1", expiresAt: at(7), autoRenew: false, renewals: [] };

  beforeEach(() => {
    mocks.getSettingMap.mockResolvedValue({});
    mocks.domainUpdateMany.mockResolvedValue({ count: 0 });
    mocks.eventCreate.mockResolvedValue({});
    mocks.noticeCreate.mockResolvedValue({ id: "notice-1" });
    mocks.sendNotification.mockResolvedValue({ ok: true, logIds: ["log-1"], deduplicated: false });
  });

  it("sends the due notice once per domain + kind + period", async () => {
    mocks.domainFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([domain]);

    const result = await sendDomainExpiryNotices(now);

    expect(result).toMatchObject({ processed: 1, byKind: { expiring_7: 1 } });
    expect(mocks.noticeCreate).toHaveBeenCalledWith({
      data: { domainId: "dom-1", kind: "expiring_7", periodStart: domain.expiresAt },
      select: { id: true },
    });
    expect(mocks.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "cust-1",
        template: "domain.expiry-notice",
        data: expect.objectContaining({ domain: "ornek.com", daysLeft: 7, stage: "expiring", autoRenew: false }),
        dedupeKey: `domain.notice:dom-1:expiring_7:${domain.expiresAt.toISOString().slice(0, 10)}`,
      })
    );
  });

  it("skips a notice already sent (unique marker) without notifying again", async () => {
    mocks.domainFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([domain]);
    mocks.noticeCreate.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));

    const result = await sendDomainExpiryNotices(now);

    expect(result).toMatchObject({ processed: 0, skipped: 1 });
    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });

  it("drops the marker when the notification can't be queued, so the next run retries", async () => {
    mocks.domainFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([domain]);
    mocks.sendNotification.mockResolvedValue({ ok: false, logIds: [], deduplicated: false, error: "queue down" });

    const result = await sendDomainExpiryNotices(now);

    expect(result).toMatchObject({ processed: 0, skipped: 1 });
    expect(mocks.noticeDelete).toHaveBeenCalledWith({ where: { id: "notice-1" } });
  });

  it("does not warn about expiry while the period's renewal is already paid", async () => {
    mocks.domainFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...domain, renewals: [{ periodStart: domain.expiresAt }] }]);

    await sendDomainExpiryNotices(now);

    expect(mocks.noticeCreate).not.toHaveBeenCalled();
  });

  it("marks ACTIVE domains past their expiry as EXPIRED", async () => {
    mocks.domainFindMany.mockResolvedValueOnce([{ id: "dom-2", expiresAt: at(-1) }]).mockResolvedValueOnce([]);
    mocks.domainUpdateMany.mockResolvedValue({ count: 1 });

    await sendDomainExpiryNotices(now);

    expect(mocks.domainUpdateMany).toHaveBeenCalledWith({
      where: { id: "dom-2", status: "ACTIVE", expiresAt: { lt: now } },
      data: { status: "EXPIRED" },
    });
    expect(mocks.eventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ domainId: "dom-2", type: "status.expired" }),
    });
  });
});
