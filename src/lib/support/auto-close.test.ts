import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = {
  id: string;
  ticketNumber: string;
  subject: string;
  department: string;
  customerId: string | null;
  guestEmail: string | null;
  guestName: string | null;
  status: string;
  waitingSince: Date | null;
  autoCloseWarnedAt: Date | null;
  closedAt: Date | null;
};

const state = vi.hoisted(() => ({
  tickets: [] as Row[],
  messages: [] as { ticketId: string; message: string }[],
  sendNotification: vi.fn(),
  emitEvent: vi.fn(),
}));

/** Minimal Prisma-where evaluation for the fields the auto-close queries use. */
function matches(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, cond]) => {
    const value = row[key];
    if (cond === null) return value === null;
    if (cond instanceof Date) return value instanceof Date && value.getTime() === cond.getTime();
    if (typeof cond === "object" && cond) {
      const c = cond as { in?: unknown[]; lte?: Date };
      if (c.in) return c.in.includes(value);
      if (c.lte) return value instanceof Date && value.getTime() <= c.lte.getTime();
    }
    return value === cond;
  });
}

vi.mock("@/lib/db", () => {
  const db = {
    supportTicket: {
      findMany: async ({ where, take }: { where: Record<string, unknown>; take: number }) =>
        state.tickets.filter((t) => matches(t, where)).slice(0, take).map((t) => ({ ...t })),
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<Row> }) => {
        const hits = state.tickets.filter((t) => matches(t, where));
        for (const t of hits) Object.assign(t, data);
        return { count: hits.length };
      },
    },
    ticketMessage: {
      create: async ({ data }: { data: { ticketId: string; message: string } }) => {
        state.messages.push(data);
        return { id: `m${state.messages.length}` };
      },
    },
    supportMailbox: { findMany: async () => [{ address: "destek@kleacore.com", department: null }] },
    $transaction: async (cb: (tx: unknown) => unknown) => cb(db),
  };
  return { db };
});
vi.mock("@/lib/notifications/send", () => ({ sendNotification: state.sendNotification }));
vi.mock("@/lib/events/emit", () => ({ emitEvent: state.emitEvent }));
vi.mock("./settings", () => ({ getAutoCloseDays: async () => 5 }));

import { runTicketAutoClose } from "./auto-close";

const DAY = 86_400_000;
const NOW = new Date("2026-10-20T09:00:00Z");
const ago = (days: number, base = NOW) => new Date(base.getTime() - days * DAY);

function ticket(id: string, patch: Partial<Row>): Row {
  return {
    id,
    ticketNumber: `T-${id.padStart(6, "0")}`,
    subject: "Konu",
    department: "GENERAL",
    customerId: "cust1",
    guestEmail: null,
    guestName: null,
    status: "ADMIN_REPLY",
    waitingSince: null,
    autoCloseWarnedAt: null,
    closedAt: null,
    ...patch,
  };
}

beforeEach(() => {
  state.tickets = [];
  state.messages = [];
  state.sendNotification.mockResolvedValue({ ok: true, logIds: ["log"], deduplicated: false });
});

describe("runTicketAutoClose", () => {
  it("warns at days-1 once, with an idempotency key per waiting period", async () => {
    state.tickets = [
      ticket("1", { waitingSince: ago(4.2) }), // due for warning
      ticket("2", { waitingSince: ago(1) }), // too early
      ticket("3", { status: "CUSTOMER_REPLY", waitingSince: ago(10) }), // ball in our court
      ticket("4", { status: "WAITING", waitingSince: ago(4.5), customerId: null, guestEmail: "misafir@firma.com" }),
    ];

    const first = await runTicketAutoClose(NOW);
    expect(first).toMatchObject({ warned: 2, closed: 0 });
    expect(state.sendNotification).toHaveBeenCalledTimes(2);
    expect(state.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "cust1",
        template: "support.ticket-auto-close-warning",
        dedupeKey: `ticket.auto-close-warning:1:${ago(4.2).toISOString()}`,
        data: expect.objectContaining({ ticketNumber: "T-000001", closesAt: new Date(NOW.getTime() + DAY), replyTo: "destek@kleacore.com" }),
      })
    );
    expect(state.sendNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: null, to: "misafir@firma.com" }));

    const second = await runTicketAutoClose(new Date(NOW.getTime() + 60_000));
    expect(second).toMatchObject({ warned: 0, closed: 0 });
    expect(state.sendNotification).toHaveBeenCalledTimes(2);
  });

  it("closes only after the period AND at least 24h after the warning, exactly once", async () => {
    state.tickets = [
      ticket("1", { waitingSince: ago(6), autoCloseWarnedAt: ago(2) }), // close
      ticket("2", { waitingSince: ago(9), autoCloseWarnedAt: ago(0.5) }), // warned too recently
      ticket("3", { waitingSince: ago(9) }), // never warned → warn now, close later
    ];

    const run = await runTicketAutoClose(NOW);
    expect(run).toMatchObject({ warned: 1, closed: 1 });
    expect(state.tickets[0]).toMatchObject({ status: "CLOSED", closedAt: NOW, waitingSince: null });
    expect(state.tickets[1].status).toBe("ADMIN_REPLY");
    expect(state.tickets[2]).toMatchObject({ status: "ADMIN_REPLY", autoCloseWarnedAt: NOW });
    // The warning promises at least 24h.
    expect(state.sendNotification.mock.calls[0][0].data.closesAt.getTime()).toBe(NOW.getTime() + DAY);
    expect(state.messages).toEqual([expect.objectContaining({ ticketId: "1", message: expect.stringContaining("5 gün") })]);
    expect(state.emitEvent).toHaveBeenCalledWith(
      expect.anything(),
      "ticket.closed",
      expect.objectContaining({ ticketId: "1", ticketNumber: "T-000001", closedBy: "auto" })
    );

    const again = await runTicketAutoClose(new Date(NOW.getTime() + 60_000));
    expect(again).toMatchObject({ warned: 0, closed: 0 });
    expect(state.messages).toHaveLength(1);

    const dayLater = await runTicketAutoClose(new Date(NOW.getTime() + DAY + 60_000));
    expect(dayLater).toMatchObject({ closed: 2 });
  });

  it("does not close a ticket the customer answered in the meantime", async () => {
    state.tickets = [ticket("1", { waitingSince: ago(6), autoCloseWarnedAt: ago(2) })];
    // Simulate the customer reply landing between the query and the claim.
    const original = state.tickets[0];
    const { db } = await import("@/lib/db");
    const findMany = db.supportTicket.findMany;
    vi.spyOn(db.supportTicket, "findMany").mockImplementation((async (args: never) => {
      const rows = await (findMany as (a: never) => Promise<Row[]>)(args);
      Object.assign(original, { status: "CUSTOMER_REPLY", waitingSince: null, autoCloseWarnedAt: null });
      return rows;
    }) as never);

    const run = await runTicketAutoClose(NOW);
    expect(run).toMatchObject({ closed: 0 });
    expect(original.status).toBe("CUSTOMER_REPLY");
    expect(state.messages).toHaveLength(0);
  });

  it("is disabled with 0 days", async () => {
    state.tickets = [ticket("1", { waitingSince: ago(60) })];
    expect(await runTicketAutoClose(NOW, 0)).toMatchObject({ disabled: true, processed: 0 });
    expect(state.tickets[0].status).toBe("ADMIN_REPLY");
  });
});
