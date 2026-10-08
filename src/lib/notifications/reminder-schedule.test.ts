import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  invoices: [] as Array<Record<string, unknown>>,
  activeServices: [] as string[],
  logs: [] as Array<{ dedupeKey: string; channel: string; createdAt: Date }>,
  schedule: null as string | null,
  now: new Date(),
}));

const sendNotification = vi.hoisted(() =>
  vi.fn(async (input: { dedupeKey: string; channel: string }) => {
    if (store.logs.some((log) => log.dedupeKey === input.dedupeKey && log.channel === input.channel)) {
      return { ok: true, logIds: [], deduplicated: true };
    }
    store.logs.push({ dedupeKey: input.dedupeKey, channel: input.channel, createdAt: store.now });
    return { ok: true, logIds: [`log-${store.logs.length}`], deduplicated: false };
  })
);

vi.mock("@/lib/db", () => ({
  db: {
    invoice: { findMany: async () => store.invoices },
    service: { findMany: async () => store.activeServices.map((id) => ({ id })) },
    notificationLog: { findMany: async () => store.logs },
    setting: { findUnique: async () => (store.schedule ? { value: store.schedule } : null) },
  },
}));
vi.mock("./send", () => ({ sendNotification }));
vi.mock("@/lib/cron/jobs/suspend-overdue-services", () => ({ getSuspendGraceDays: async () => 3 }));

import {
  DEFAULT_REMINDER_SCHEDULE,
  daysFromDue,
  parseReminderSchedule,
  planReminder,
  reminderScheduleSchema,
  runInvoiceReminderSchedule,
} from "./reminder-schedule";

const DAY = 86_400_000;
// 10:00 Istanbul on 8 Oct 2026.
const now = new Date("2026-10-08T07:00:00Z");
/** Due date at Istanbul midnight, `days` from today. */
const dueIn = (days: number) => new Date(Date.UTC(2026, 9, 8 + days) - 3 * 3_600_000);

function invoice(id: string, days: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    invoiceNumber: `F-${id}`,
    customerId: `c-${id}`,
    totalAmount: new Prisma.Decimal("100.00"),
    dueDate: dueIn(days),
    createdAt: new Date(now.getTime() - 20 * DAY),
    order: null,
    ...extra,
  };
}

describe("reminder schedule planning", () => {
  it("counts calendar days in Europe/Istanbul", () => {
    expect(daysFromDue(dueIn(3), now)).toBe(-3);
    // 23:30 Istanbul on the 7th is still "yesterday" although it's the 8th in some zones.
    expect(daysFromDue(new Date("2026-10-07T20:30:00Z"), now)).toBe(1);
    expect(daysFromDue(new Date("2026-10-07T21:30:00Z"), now)).toBe(0);
  });

  it("maps steps to templates and channels; the final warning goes at grace − 1 for suspendable invoices", () => {
    const plan = (days: number, suspendable = false) => planReminder(DEFAULT_REMINDER_SCHEDULE, { dueDate: dueIn(days), suspendable }, now, 3);
    expect(plan(3)).toEqual({ step: "d-3", offsetDays: -3, template: "billing.invoice-reminder", channels: ["EMAIL", "SMS"] });
    expect(plan(1)).toMatchObject({ step: "d-1", channels: ["EMAIL"] });
    expect(plan(-1)).toMatchObject({ step: "d+1", template: "billing.invoice-overdue" });
    expect(plan(-7)).toMatchObject({ step: "d+7" });
    expect(plan(-2)).toBeNull();
    expect(plan(-2, true)).toMatchObject({ step: "final", template: "billing.invoice-final-warning", channels: ["EMAIL", "SMS"] });
    expect(plan(2)).toBeNull();
  });

  it("validates the admin setting and falls back to the default on bad JSON", () => {
    expect(reminderScheduleSchema.safeParse({ ...DEFAULT_REMINDER_SCHEDULE, steps: [{ offsetDays: 1, email: true, sms: false }, { offsetDays: 1, email: true, sms: false }] }).success).toBe(false);
    expect(reminderScheduleSchema.safeParse({ ...DEFAULT_REMINDER_SCHEDULE, steps: [{ offsetDays: 1, email: false, sms: false }] }).success).toBe(false);
    expect(parseReminderSchedule("{nope")).toEqual(DEFAULT_REMINDER_SCHEDULE);
    expect(parseReminderSchedule(JSON.stringify({ steps: [{ offsetDays: 5, email: true, sms: false }, { offsetDays: -2, email: true, sms: false }], finalWarning: { enabled: false, email: true, sms: false } })).steps.map((step) => step.offsetDays)).toEqual([-2, 5]);
  });
});

describe("runInvoiceReminderSchedule", () => {
  beforeEach(() => {
    store.invoices = [];
    store.activeServices = [];
    store.logs = [];
    store.schedule = null;
    store.now = now;
    sendNotification.mockClear();
  });

  it("sends each (invoice, step, channel) once, however often the cron runs", async () => {
    store.invoices = [invoice("a", 3), invoice("b", -1), invoice("c", -2, { order: { serviceId: "svc-c" } })];
    store.activeServices = ["svc-c"];

    const first = await runInvoiceReminderSchedule(now);
    expect(first).toMatchObject({ sent: 3, bySteps: { "d-3": 1, "d+1": 1, final: 1 } });
    expect(sendNotification.mock.calls.map((call) => [call[0].dedupeKey, call[0].channel])).toEqual([
      ["invoice.reminder:a:d-3", "EMAIL"],
      ["invoice.reminder:a:d-3", "SMS"],
      ["invoice.reminder:b:d+1", "EMAIL"],
      ["invoice.reminder:c:final", "EMAIL"],
      ["invoice.reminder:c:final", "SMS"],
    ]);
    expect(sendNotification.mock.calls[0][0]).toMatchObject({ template: "billing.invoice-reminder", data: expect.objectContaining({ daysLeft: 3 }) });
    expect(sendNotification.mock.calls[3][0]).toMatchObject({
      template: "billing.invoice-final-warning",
      data: expect.objectContaining({ suspendAt: dueIn(1) }),
    });

    sendNotification.mockClear();
    const second = await runInvoiceReminderSchedule(new Date(now.getTime() + 3_600_000));
    expect(second.sent).toBe(0);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("does not repeat the old fixed −3 reminder, skips zero totals, fresh invoices and same-day duplicates", async () => {
    store.invoices = [
      invoice("legacy", 3),
      invoice("zero", 3, { totalAmount: new Prisma.Decimal("0") }),
      invoice("fresh", 3, { createdAt: new Date(now.getTime() - 3_600_000) }),
      invoice("loud", -1),
    ];
    store.logs = [
      { dedupeKey: "invoice.reminder:legacy", channel: "EMAIL", createdAt: new Date(now.getTime() - 5 * DAY) },
      // "fatura gecikti" from the invoice.overdue event a few hours ago.
      { dedupeKey: "invoice.overdue:loud", channel: "EMAIL", createdAt: new Date(now.getTime() - 4 * 3_600_000) },
    ];

    expect(await runInvoiceReminderSchedule(now)).toMatchObject({ sent: 0 });
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("follows the admin schedule", async () => {
    store.schedule = JSON.stringify({ steps: [{ offsetDays: -2, email: false, sms: true }], finalWarning: { enabled: false, email: true, sms: false } });
    store.invoices = [invoice("a", 2), invoice("b", 3), invoice("c", -2, { order: { serviceId: "svc-c" } })];
    store.activeServices = ["svc-c"];

    await runInvoiceReminderSchedule(now);
    expect(sendNotification.mock.calls.map((call) => [call[0].dedupeKey, call[0].channel])).toEqual([["invoice.reminder:a:d-2", "SMS"]]);
  });
});
