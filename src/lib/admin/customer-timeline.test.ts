import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import {
  allowedTimelineKinds,
  decodeCursor,
  encodeCursor,
  mergeTimeline,
  parseKinds,
  type TimelineEvent,
} from "./customer-timeline";

const ev = (key: string, iso: string, kind: TimelineEvent["kind"] = "order"): TimelineEvent => ({
  key,
  kind,
  at: new Date(iso),
  title: key,
});

describe("customer timeline", () => {
  const orders = [ev("order:3", "2026-10-10T10:00:00Z"), ev("order:1", "2026-10-01T10:00:00Z")];
  const invoices = [ev("invoice:2", "2026-10-05T10:00:00Z", "invoice"), ev("invoice:9", "2026-10-01T10:00:00Z", "invoice")];

  it("merges sources newest first and returns a cursor when more exist", () => {
    const page1 = mergeTimeline([orders, invoices], 2);
    expect(page1.events.map((e) => e.key)).toEqual(["order:3", "invoice:2"]);
    expect(page1.next).toEqual({ at: new Date("2026-10-05T10:00:00Z"), key: "invoice:2" });

    const page2 = mergeTimeline([orders, invoices], 2, page1.next);
    // Same instant: ordered by key descending, nothing repeated or skipped.
    expect(page2.events.map((e) => e.key)).toEqual(["order:1", "invoice:9"]);
    expect(page2.next).toBeNull();
  });

  it("pages through events sharing one instant without losing any", () => {
    const same = [ev("a:1", "2026-10-01T10:00:00Z"), ev("a:2", "2026-10-01T10:00:00Z"), ev("a:3", "2026-10-01T10:00:00Z")];
    const p1 = mergeTimeline([same], 2);
    const p2 = mergeTimeline([same], 2, p1.next);
    expect([...p1.events, ...p2.events].map((e) => e.key)).toEqual(["a:3", "a:2", "a:1"]);
  });

  it("round-trips the cursor and rejects junk", () => {
    const c = { at: new Date("2026-10-05T10:00:00.000Z"), key: "invoice:abc" };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
    expect(decodeCursor("nope")).toBeNull();
    expect(decodeCursor("not-a-date~x")).toBeNull();
    expect(decodeCursor(null)).toBeNull();
  });

  it("only offers kinds the role may see (KYC needs kyc.review)", () => {
    expect(allowedTimelineKinds("SUPPORT")).toEqual(["ticket", "login", "kyc"]);
    expect(allowedTimelineKinds("BILLING")).toEqual(["order", "invoice", "payment", "login", "fraud"]);
    expect(allowedTimelineKinds("ADMIN")).toHaveLength(8);
  });

  it("parses the kind filter against the allowed kinds", () => {
    const allowed = allowedTimelineKinds("SUPPORT");
    expect(parseKinds("ticket,invoice,kyc", allowed)).toEqual(["ticket", "kyc"]);
    expect(parseKinds("invoice", allowed)).toEqual(allowed); // nothing allowed picked → all
    expect(parseKinds(undefined, allowed)).toEqual(allowed);
  });
});
