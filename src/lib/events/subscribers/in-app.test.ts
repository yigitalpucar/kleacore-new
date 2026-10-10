import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindMany: vi.fn(),
  userFindUnique: vi.fn(),
  ticketFindUnique: vi.fn(),
  createMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: { findMany: mocks.userFindMany, findUnique: mocks.userFindUnique },
    supportTicket: { findUnique: mocks.ticketFindUnique },
    notification: { createMany: mocks.createMany },
  },
}));

import { IN_APP_EVENTS, inAppNotificationsSubscriber, planInAppNotifications } from "./in-app";
import type { DispatchedEvent } from "./types";

const at = "2026-10-08T10:00:00.000Z";
const ev = (type: string, payload: Record<string, unknown>, actorId: string | null = null) =>
  ({ id: "evt-1", type, payload, aggregateType: "X", aggregateId: "x", actorId, occurredAt: new Date(at) }) as unknown as DispatchedEvent;

const STAFF = [
  { id: "adm-1", role: "ADMIN" },
  { id: "sup-1", role: "SUPPORT" },
  { id: "bil-1", role: "BILLING" },
];

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.userFindMany.mockResolvedValue(STAFF);
  mocks.userFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({ id: where.id }));
  mocks.ticketFindUnique.mockResolvedValue({ assignedTo: null });
  mocks.createMany.mockImplementation(async ({ data }: { data: unknown[] }) => ({ count: data.length }));
});

async function recipientsOf(event: DispatchedEvent) {
  await inAppNotificationsSubscriber.handle(event);
  const call = mocks.createMany.mock.calls[0]?.[0] as { data: Array<{ userId: string }>; skipDuplicates: boolean } | undefined;
  return call?.data.map((r) => r.userId) ?? [];
}

describe("in-app bell: customer events", () => {
  it("renewal invoice → the invoice owner, linking to the panel invoice", () => {
    const [plan] = planInAppNotifications(
      ev("invoice.created", { invoiceId: "inv-1", invoiceNumber: "F-1", customerId: "cus-1", totalAmount: "120.00", dueDate: at, source: "renewal", notify: true })
    );
    expect(plan).toMatchObject({ audience: { kind: "customer", userId: "cus-1" }, link: "/musteri/panel/faturalar/inv-1", title: "Yeni fatura: F-1" });
  });

  it("checkout, silent and zero invoices are not announced", () => {
    const base = { invoiceId: "inv-1", invoiceNumber: "F-1", customerId: "cus-1", totalAmount: "120.00", dueDate: at, notify: true };
    expect(planInAppNotifications(ev("invoice.created", { ...base, source: "checkout" }))).toEqual([]);
    expect(planInAppNotifications(ev("invoice.created", { ...base, source: "admin", notify: false }))).toEqual([]);
    expect(planInAppNotifications(ev("invoice.created", { ...base, source: "admin", totalAmount: "0" }))).toEqual([]);
  });

  it("paid invoice, service ready and suspension go to the customer only", async () => {
    expect(await recipientsOf(ev("invoice.paid", { invoiceId: "inv-1", invoiceNumber: "F-1", customerId: "cus-1", amount: "50", paidAt: at, context: "invoice" }))).toEqual(["cus-1"]);
    mocks.createMany.mockClear();
    expect(await recipientsOf(ev("service.activated", { serviceId: "s-1", customerId: "cus-2", serviceLabel: "Hosting", kind: "hosting" }))).toEqual(["cus-2"]);
    expect(mocks.userFindMany).not.toHaveBeenCalled(); // no staff lookup for customer events
  });

  it("a suspension the admin chose not to announce is skipped", async () => {
    const result = await inAppNotificationsSubscriber.handle(
      ev("service.suspended", { serviceId: "s-1", customerId: "cus-1", serviceLabel: "VDS", reason: "x", suspendedAt: at, notify: false })
    );
    expect(result).toEqual({ skipped: "NOT_NOTIFIABLE" });
    expect(mocks.createMany).not.toHaveBeenCalled();
  });

  it("staff reply → customer; customer reply → staff (not the customer)", async () => {
    const reply = { ticketId: "t-1", ticketNumber: "T-1", subject: "Konu", customerId: "cus-1", senderName: "Ayşe", messagePreview: "Merhaba" };
    expect(await recipientsOf(ev("ticket.replied", { ...reply, authorRole: "STAFF" }))).toEqual(["cus-1"]);
    mocks.createMany.mockClear();
    expect(await recipientsOf(ev("ticket.replied", { ...reply, authorRole: "CUSTOMER" }))).toEqual(["adm-1", "sup-1"]);
  });

  it("a guest ticket reply has no in-app recipient", () => {
    expect(
      planInAppNotifications(ev("ticket.replied", { ticketId: "t-1", ticketNumber: "T-1", subject: "K", customerId: null, authorRole: "STAFF", senderName: "D", messagePreview: "x" }))
    ).toEqual([]);
  });

  it("a deleted customer gets nothing", async () => {
    mocks.userFindUnique.mockResolvedValue(null);
    const result = await inAppNotificationsSubscriber.handle(
      ev("invoice.paid", { invoiceId: "inv-1", invoiceNumber: "F-1", customerId: "gone", amount: "5", paidAt: at, context: "invoice" })
    );
    expect(result).toEqual({ skipped: "NO_RECIPIENT" });
  });
});

describe("in-app bell: staff events are filtered by permission", () => {
  it("new ticket → ADMIN + SUPPORT (tickets.view), not BILLING", async () => {
    expect(await recipientsOf(ev("ticket.opened", { ticketId: "t-1", ticketNumber: "T-1", subject: "Konu", customerId: "cus-1", source: "panel" }))).toEqual(["adm-1", "sup-1"]);
  });

  it("ticket opened by staff on a customer's behalf is not announced", () => {
    expect(planInAppNotifications(ev("ticket.opened", { ticketId: "t-1", ticketNumber: "T-1", subject: "K", source: "admin" }))).toEqual([]);
  });

  it("new order → ADMIN + BILLING (orders.view), not SUPPORT", async () => {
    expect(await recipientsOf(ev("order.created", { orderId: "o-1", orderNumber: "S-1", customerId: "cus-1", totalAmount: "99.9" }, "cus-1"))).toEqual(["adm-1", "bil-1"]);
  });

  it("payment failed → invoices.view holders", async () => {
    expect(await recipientsOf(ev("payment.failed", { invoiceId: "inv-1", invoiceNumber: "F-1", customerId: "cus-1", amount: "10", automatic: true }))).toEqual(["adm-1", "bil-1"]);
  });

  it("KYC pending → kyc.review holders (ADMIN + SUPPORT)", async () => {
    expect(await recipientsOf(ev("kyc.submitted", { userId: "cus-1", customerName: "Ayşe", documentTypes: [] }))).toEqual(["adm-1", "sup-1"]);
  });

  it("a customer reply on an assigned ticket goes to the assignee only", async () => {
    mocks.ticketFindUnique.mockResolvedValue({ assignedTo: "sup-1" });
    expect(
      await recipientsOf(ev("ticket.replied", { ticketId: "t-1", ticketNumber: "T-1", subject: "K", customerId: "cus-1", authorRole: "CUSTOMER", senderName: "A", messagePreview: "x" }))
    ).toEqual(["sup-1"]);
  });

  it("only active staff are queried", async () => {
    await recipientsOf(ev("kyc.submitted", { userId: "cus-1", documentTypes: [] }));
    expect(mocks.userFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { role: { in: ["ADMIN", "SUPPORT", "BILLING"] }, status: "ACTIVE" } }));
  });
});

describe("in-app bell: idempotency", () => {
  it("rows carry the event dedupe key and duplicates are skipped on retry", async () => {
    await inAppNotificationsSubscriber.handle(ev("kyc.submitted", { userId: "cus-1", documentTypes: [] }));
    const arg = mocks.createMany.mock.calls[0][0] as { data: Array<{ dedupeKey: string; kind: string }>; skipDuplicates: boolean };
    expect(arg.skipDuplicates).toBe(true);
    expect(arg.data.every((r) => r.dedupeKey === "event:evt-1" && r.kind === "kyc.submitted")).toBe(true);
  });

  it("every handled event type has a plan branch", () => {
    for (const type of IN_APP_EVENTS) expect(inAppNotificationsSubscriber.handles(type)).toBe(true);
    expect(inAppNotificationsSubscriber.handles("user.registered")).toBe(false);
  });
});
