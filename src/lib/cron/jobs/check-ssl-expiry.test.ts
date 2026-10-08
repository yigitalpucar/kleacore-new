import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/notifications/send", () => ({ sendNotification: vi.fn() }));

import { sslNoticeBucket } from "./check-ssl-expiry";

describe("sslNoticeBucket", () => {
  const now = new Date("2026-10-08T04:00:00Z");
  const inDays = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  it("maps days left to the 30/7/1/expired notices so the daily cron mails once per step", () => {
    expect(sslNoticeBucket(inDays(45), now)).toBeNull();
    expect(sslNoticeBucket(inDays(30), now)).toBe("30");
    expect(sslNoticeBucket(inDays(8), now)).toBe("30");
    expect(sslNoticeBucket(inDays(7), now)).toBe("7");
    expect(sslNoticeBucket(inDays(2), now)).toBe("7");
    expect(sslNoticeBucket(inDays(0.5), now)).toBe("1");
    expect(sslNoticeBucket(inDays(-1), now)).toBe("expired");
  });
});
