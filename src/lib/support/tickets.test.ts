import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ emitEvent: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/events/emit", () => ({ emitEvent: m.emitEvent }));

import { appendTicketMessage } from "./tickets";

const GUEST_TICKET = {
  id: "t1",
  ticketNumber: "T-123456",
  subject: "Site açılmıyor",
  customerId: null,
  department: "TECHNICAL",
  guestEmail: "misafir@firma.com",
  guestName: "Misafir",
};

function tx() {
  return {
    ticketMessage: { create: vi.fn().mockResolvedValue({ id: "msg1" }) },
    ticketAttachment: { createMany: vi.fn() },
    supportTicket: { update: vi.fn().mockResolvedValue(GUEST_TICKET) },
  };
}

beforeEach(() => m.emitEvent.mockReset());

describe("appendTicketMessage events", () => {
  it("a staff reply on a guest ticket notifies the guest address through ticket.replied", async () => {
    await appendTicketMessage(tx() as never, {
      ticketId: "t1",
      author: { senderId: "a1", senderName: "Destek", senderRole: "ADMIN" },
      message: "Yanıt",
      source: "WEB",
      nextStatus: "ADMIN_REPLY",
    });
    expect(m.emitEvent).toHaveBeenCalledTimes(1);
    expect(m.emitEvent).toHaveBeenCalledWith(expect.anything(), "ticket.replied", {
      ticketId: "t1",
      ticketNumber: "T-123456",
      subject: "Site açılmıyor",
      customerId: null,
      department: "TECHNICAL",
      authorRole: "STAFF",
      senderName: "Destek",
      messagePreview: "Yanıt",
      recipientEmail: "misafir@firma.com",
      recipientName: "Misafir",
    });
  });

  it("reply-and-close also emits ticket.closed (staff)", async () => {
    await appendTicketMessage(tx() as never, {
      ticketId: "t1",
      author: { senderId: "a1", senderName: "Destek", senderRole: "ADMIN" },
      message: "Kapatıyoruz",
      source: "WEB",
      nextStatus: "CLOSED",
    });
    expect(m.emitEvent.mock.calls.map((call) => call[1])).toEqual(["ticket.replied", "ticket.closed"]);
    expect(m.emitEvent.mock.calls[1][2]).toMatchObject({ ticketId: "t1", closedBy: "staff" });
  });
});
