import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  ticketFindUnique: vi.fn(),
  serviceFindFirst: vi.fn(),
  userFindUnique: vi.fn(),
  appendTicketMessage: vi.fn(),
  createTicketRecord: vi.fn(),
  notifyCustomerOfStaffReply: vi.fn(),
  notifyStaffOfCustomerReply: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    supportTicket: { findUnique: m.ticketFindUnique },
    service: { findFirst: m.serviceFindFirst },
    user: { findUnique: m.userFindUnique },
  },
}));
vi.mock("./tickets", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./tickets")>();
  return {
    ...actual,
    appendTicketMessage: m.appendTicketMessage,
    createTicketRecord: m.createTicketRecord,
    notifyCustomerOfStaffReply: m.notifyCustomerOfStaffReply,
    notifyStaffOfCustomerReply: m.notifyStaffOfCustomerReply,
    withStoredAttachments: async (_files: unknown, write: (tx: unknown, stored: unknown[]) => unknown) => write({}, []),
  };
});

import { addCustomerReply, addStaffReply, createCustomerTicket } from "./web";
import { statusChange } from "./tickets";

const PDF = { name: "a.pdf", data: Buffer.from("%PDF-1.4\n") };
const EXE = { name: "a.pdf", data: Buffer.concat([Buffer.from("MZ"), Buffer.alloc(8)]) };

beforeEach(() => {
  m.userFindUnique.mockResolvedValue({ name: "Ayşe", surname: "Yılmaz" });
  m.ticketFindUnique.mockResolvedValue({ id: "t1", customerId: "cust1", status: "ADMIN_REPLY", ticketNumber: "T-123456" });
  m.appendTicketMessage.mockResolvedValue({ messageId: "msg" });
  m.createTicketRecord.mockResolvedValue({ ticket: { id: "t2", ticketNumber: "T-222222" }, messageId: "msg" });
  m.notifyCustomerOfStaffReply.mockResolvedValue(undefined);
});

describe("customer replies", () => {
  it("only the owner can reply; others get 404", async () => {
    expect(await addCustomerReply({ id: "cust2", role: "CUSTOMER" }, "t1", "Merhaba", [])).toEqual({
      success: false,
      error: "Destek talebi bulunamadı",
      status: 404,
    });
    expect(m.appendTicketMessage).not.toHaveBeenCalled();

    expect(await addCustomerReply({ id: "cust1", role: "CUSTOMER" }, "t1", "Merhaba", [PDF])).toEqual({ success: true });
    expect(m.appendTicketMessage.mock.calls[0][1]).toMatchObject({ ticketId: "t1", nextStatus: "CUSTOMER_REPLY", source: "WEB" });
    expect(m.notifyStaffOfCustomerReply).toHaveBeenCalled();
  });

  it("rejects disallowed files before anything is written", async () => {
    const result = await addCustomerReply({ id: "cust1" }, "t1", "Merhaba", [EXE]);
    expect(result).toMatchObject({ success: false, status: 422 });
    expect(m.appendTicketMessage).not.toHaveBeenCalled();
  });

  it("refuses closed tickets and empty messages", async () => {
    expect(await addCustomerReply({ id: "cust1" }, "t1", "   ", [])).toMatchObject({ success: false, status: 422 });
    m.ticketFindUnique.mockResolvedValue({ id: "t1", customerId: "cust1", status: "CLOSED" });
    expect(await addCustomerReply({ id: "cust1" }, "t1", "x", [])).toMatchObject({ success: false, status: 409 });
  });
});

describe("new customer ticket", () => {
  it("rejects a related service that belongs to someone else", async () => {
    m.serviceFindFirst.mockResolvedValue(null);
    const result = await createCustomerTicket(
      { id: "cust1" },
      { subject: "Site açılmıyor", message: "Merhaba, sitem açılmıyor.", relatedServiceId: "svc-of-other" },
      []
    );
    expect(result).toMatchObject({ success: false, error: "Seçilen hizmet bulunamadı" });
    expect(m.serviceFindFirst).toHaveBeenCalledWith({ where: { id: "svc-of-other", customerId: "cust1" }, select: { id: true } });
    expect(m.createTicketRecord).not.toHaveBeenCalled();
  });

  it("creates a WEB ticket for the session user", async () => {
    const result = await createCustomerTicket({ id: "cust1" }, { subject: "Site açılmıyor", message: "Merhaba, sitem açılmıyor." }, [PDF]);
    expect(result).toMatchObject({ success: true, data: { id: "t2", ticketNumber: "T-222222" } });
    expect(m.createTicketRecord.mock.calls[0][1]).toMatchObject({ customerId: "cust1", source: "WEB", department: "GENERAL" });
  });
});

describe("staff replies", () => {
  it("require a support role", async () => {
    expect(await addStaffReply({ id: "cust1", role: "CUSTOMER" }, "t1", "x", "ADMIN_REPLY", [])).toMatchObject({ status: 403 });
    expect(m.appendTicketMessage).not.toHaveBeenCalled();
  });

  it("set the requested status (WAITING = müşteri yanıtı bekleniyor) and notify the customer", async () => {
    expect(await addStaffReply({ id: "admin1", role: "ADMIN" }, "t1", "Yanıt", "WAITING", [])).toEqual({ success: true });
    expect(m.appendTicketMessage.mock.calls[0][1]).toMatchObject({ nextStatus: "WAITING", author: { senderRole: "ADMIN" } });
    expect(m.notifyCustomerOfStaffReply).toHaveBeenCalled();

    await addStaffReply({ id: "admin1", role: "ADMIN" }, "t1", "Yanıt", "OPEN", []);
    expect(m.appendTicketMessage.mock.calls[1][1].nextStatus).toBe("ADMIN_REPLY");
  });
});

describe("statusChange", () => {
  const now = new Date("2026-10-08T10:00:00Z");
  it("starts the auto-close clock only while waiting on the customer", () => {
    expect(statusChange("ADMIN_REPLY", now)).toEqual({ status: "ADMIN_REPLY", closedAt: null, waitingSince: now, autoCloseWarnedAt: null });
    expect(statusChange("WAITING", now)).toEqual({ status: "WAITING", closedAt: null, waitingSince: now, autoCloseWarnedAt: null });
    expect(statusChange("CUSTOMER_REPLY", now)).toEqual({ status: "CUSTOMER_REPLY", closedAt: null, waitingSince: null, autoCloseWarnedAt: null });
    expect(statusChange("CLOSED", now)).toEqual({ status: "CLOSED", closedAt: now, waitingSince: null, autoCloseWarnedAt: null });
  });
});
