import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  storageGet: vi.fn(),
  getStorageDriver: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: { ticketAttachment: { findUnique: mocks.findUnique } } }));
vi.mock("@/lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage")>();
  return { ...actual, getStorageDriver: mocks.getStorageDriver };
});

import { loadAttachmentForViewer } from "./download";

const ATTACHMENT_ID = "clattachment0000000000001";

function attachment(customerId: string | null) {
  return {
    fileName: "Şirket raporu.pdf",
    mimeType: "application/pdf",
    sizeBytes: 8,
    storageDriver: "local",
    storageKey: "tickets/2026/10/0b6f9a2e-8a4a-4d3a-9d3b-2b0f3c1d4e5f",
    ticket: { customerId },
  };
}

beforeEach(() => {
  mocks.storageGet.mockResolvedValue(Buffer.from("%PDF-1.4"));
  mocks.getStorageDriver.mockReturnValue({ name: "local", get: mocks.storageGet });
});

describe("loadAttachmentForViewer", () => {
  it("serves the ticket owner as a download with nosniff and a sandbox CSP", async () => {
    mocks.findUnique.mockResolvedValue(attachment("customer-1"));
    const result = await loadAttachmentForViewer({ id: "customer-1", role: "CUSTOMER" }, ATTACHMENT_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.headers["content-type"]).toBe("application/pdf");
    expect(result.headers["content-disposition"]).toMatch(/^attachment; filename="_irket raporu.pdf"; filename\*=UTF-8''/);
    expect(result.headers["x-content-type-options"]).toBe("nosniff");
    expect(result.headers["content-security-policy"]).toContain("sandbox");
    expect(result.headers["cache-control"]).toBe("private, no-store");
    expect(mocks.getStorageDriver).toHaveBeenCalledWith("local");
  });

  it("serves staff for any ticket, including guest (e-mail) tickets", async () => {
    mocks.findUnique.mockResolvedValue(attachment(null));
    expect((await loadAttachmentForViewer({ id: "admin-1", role: "ADMIN" }, ATTACHMENT_ID)).ok).toBe(true);
    expect((await loadAttachmentForViewer({ id: "support-1", role: "SUPPORT" }, ATTACHMENT_ID)).ok).toBe(true);
  });

  it("answers another customer exactly like a missing file (404) and never reads storage", async () => {
    mocks.findUnique.mockResolvedValue(attachment("customer-1"));
    expect(await loadAttachmentForViewer({ id: "customer-2", role: "CUSTOMER" }, ATTACHMENT_ID)).toEqual({ ok: false, status: 404 });
    mocks.findUnique.mockResolvedValue(attachment(null));
    expect(await loadAttachmentForViewer({ id: "customer-2", role: "CUSTOMER" }, ATTACHMENT_ID)).toEqual({ ok: false, status: 404 });
    mocks.findUnique.mockResolvedValue(null);
    expect(await loadAttachmentForViewer({ id: "customer-2", role: "CUSTOMER" }, ATTACHMENT_ID)).toEqual({ ok: false, status: 404 });
    expect(mocks.storageGet).not.toHaveBeenCalled();
  });

  it("requires a session and a well-formed id", async () => {
    expect(await loadAttachmentForViewer(null, ATTACHMENT_ID)).toEqual({ ok: false, status: 401 });
    expect(await loadAttachmentForViewer({ id: "customer-1" }, "../../etc/passwd")).toEqual({ ok: false, status: 404 });
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("refuses a tampered storage key from the database and reports a missing object as 410", async () => {
    mocks.findUnique.mockResolvedValue({ ...attachment("customer-1"), storageKey: "../../etc/passwd" });
    expect(await loadAttachmentForViewer({ id: "customer-1" }, ATTACHMENT_ID)).toEqual({ ok: false, status: 404 });
    expect(mocks.storageGet).not.toHaveBeenCalled();

    mocks.findUnique.mockResolvedValue(attachment("customer-1"));
    mocks.storageGet.mockResolvedValue(null);
    expect(await loadAttachmentForViewer({ id: "customer-1" }, ATTACHMENT_ID)).toEqual({ ok: false, status: 410 });
  });
});
