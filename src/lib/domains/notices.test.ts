import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  domainFindMany: vi.fn(),
  domainUpdateMany: vi.fn(),
  noticeCreate: vi.fn(),
  noticeDelete: vi.fn(),
  eventCreate: vi.fn(),
  emitEvent: vi.fn(),
  getSettingMap: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const db = {
    domain: { findMany: mocks.domainFindMany, updateMany: mocks.domainUpdateMany },
    domainNotice: { create: mocks.noticeCreate, delete: mocks.noticeDelete },
    domainLifecycleEvent: { create: mocks.eventCreate },
    $transaction: (fn: (tx: unknown) => unknown) => fn(db),
  };
  return { db };
});
vi.mock("@/lib/events/emit", () => ({ emitEvent: mocks.emitEvent }));
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
    mocks.emitEvent.mockResolvedValue({ id: "evt-1", type: "domain.expiring", queued: true });
  });

  it("sends the due notice once per domain + kind + period", async () => {
    mocks.domainFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([domain]);

    const result = await sendDomainExpiryNotices(now);

    expect(result).toMatchObject({ processed: 1, byKind: { expiring_7: 1 } });
    expect(mocks.noticeCreate).toHaveBeenCalledWith({
      data: { domainId: "dom-1", kind: "expiring_7", periodStart: domain.expiresAt },
      select: { id: true },
    });
    // Marker and outbox event in one transaction; the notice (same template
    // and dedupe key as before) is planned by the notifications subscriber.
    expect(mocks.emitEvent).toHaveBeenCalledWith(
      expect.anything(),
      "domain.expiring",
      expect.objectContaining({ domainId: "dom-1", customerId: "cust-1", kind: "expiring_7", daysLeft: 7, autoRenew: false })
    );
  });

  it("skips a notice already sent (unique marker) without notifying again", async () => {
    mocks.domainFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([domain]);
    mocks.noticeCreate.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));

    const result = await sendDomainExpiryNotices(now);

    expect(result).toMatchObject({ processed: 0, skipped: 1 });
    expect(mocks.emitEvent).not.toHaveBeenCalled();
  });

  it("counts a failed event write as skipped (the marker rolls back with it), so the next run retries", async () => {
    mocks.domainFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([domain]);
    mocks.emitEvent.mockRejectedValue(new Error("db down"));

    const result = await sendDomainExpiryNotices(now);

    expect(result).toMatchObject({ processed: 0, skipped: 1 });
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
