import { describe, expect, it } from "vitest";
import { STATUTORY_DEADLINE_DAYS, canTransition, computeDueAt, deadlineState } from "./labels";

const DAY = 24 * 60 * 60 * 1000;
const received = new Date("2026-10-01T09:00:00Z");

describe("KVKK statutory deadline", () => {
  it("is 30 days after the request was received", () => {
    expect(STATUTORY_DEADLINE_DAYS).toBe(30);
    expect(computeDueAt(received).toISOString()).toBe("2026-10-31T09:00:00.000Z");
  });

  it("shows days left, warns in the last week and flags overdue requests", () => {
    const dueAt = computeDueAt(received);
    expect(deadlineState({ status: "RECEIVED", dueAt }, new Date(received.getTime() + 5 * DAY))).toMatchObject({
      kind: "open",
      daysLeft: 25,
      tone: "neutral",
    });
    expect(deadlineState({ status: "IN_PROGRESS", dueAt }, new Date(dueAt.getTime() - 3 * DAY))).toMatchObject({
      daysLeft: 3,
      tone: "warning",
      label: "3 gün kaldı",
    });
    expect(deadlineState({ status: "IN_PROGRESS", dueAt }, new Date(dueAt.getTime() - 3 * 60 * 60 * 1000))).toMatchObject({
      daysLeft: 1,
      tone: "warning",
    });
    expect(deadlineState({ status: "RECEIVED", dueAt }, new Date(dueAt.getTime() + 2 * DAY + 1))).toMatchObject({
      tone: "danger",
      label: "Süre 3 gün geçti",
    });
  });

  it("has no running deadline before verification or after closing", () => {
    expect(deadlineState({ status: "PENDING_VERIFICATION", dueAt: null })).toEqual({ kind: "none" });
    expect(deadlineState({ status: "COMPLETED", dueAt: computeDueAt(received) })).toEqual({ kind: "closed" });
  });
});

describe("status transitions", () => {
  it("allows the review flow and forbids reopening closed requests", () => {
    expect(canTransition("RECEIVED", "IN_PROGRESS")).toBe(true);
    expect(canTransition("IN_PROGRESS", "RECEIVED")).toBe(true);
    expect(canTransition("PENDING_VERIFICATION", "CANCELLED")).toBe(true);
    expect(canTransition("PENDING_VERIFICATION", "RECEIVED")).toBe(false); // only via the e-mail link
    expect(canTransition("COMPLETED", "IN_PROGRESS")).toBe(false);
    expect(canTransition("REJECTED", "RECEIVED")).toBe(false);
    expect(canTransition("CANCELLED", "RECEIVED")).toBe(false);
  });
});
