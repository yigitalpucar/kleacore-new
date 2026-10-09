import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    user: { updateMany: vi.fn() },
    kycDocument: { createMany: vi.fn(), updateMany: vi.fn() },
  };
  return {
    tx,
    db: {
      user: { findUnique: vi.fn(), updateMany: vi.fn() },
      kycDocument: { findUnique: vi.fn() },
      $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
    },
    storageGet: vi.fn(),
    emitEvent: vi.fn(),
    logActivity: vi.fn(),
    recordConsent: vi.fn(),
    releaseHeldOrdersForCustomer: vi.fn(),
    getKycConfig: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/events/emit", () => ({ emitEvent: mocks.emitEvent }));
vi.mock("@/lib/activity-log", () => ({ logActivity: mocks.logActivity }));
vi.mock("@/lib/legal/documents", () => ({
  getCurrentLegalDocument: vi.fn(async () => ({ id: "doc-kyc", type: "KYC_CONSENT", version: 1, content: "<p>rıza</p>" })),
  recordKvkkAcknowledgement: mocks.recordConsent,
}));
vi.mock("@/lib/provisioning/hold", () => ({ releaseHeldOrdersForCustomer: mocks.releaseHeldOrdersForCustomer }));
vi.mock("./settings", () => ({ getKycConfig: mocks.getKycConfig }));
vi.mock("@/lib/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/storage")>()),
  getStorageDriver: () => ({ name: "local", get: mocks.storageGet, put: vi.fn(), delete: vi.fn() }),
}));

import type { StorageDriver } from "@/lib/storage";
import { approveKyc, canViewKycDocument, KycError, loadKycDocumentForViewer, rejectKyc, submitKycDocuments } from "./service";

const DOC_ID = "clkyc0000000000000000001";
const storedDoc = {
  id: DOC_ID,
  userId: "cus-1",
  type: "IDENTITY_FRONT",
  fileName: "on.jpg",
  mimeType: "image/jpeg",
  storageDriver: "local",
  storageKey: "kyc/2026/10/0b6a3c1e-1b2c-4d5e-8f90-123456789abc",
  deletedAt: null as Date | null,
};

const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32, 1)]);

beforeEach(() => {
  mocks.db.kycDocument.findUnique.mockResolvedValue({ ...storedDoc });
  mocks.storageGet.mockResolvedValue(Buffer.from("image-bytes"));
  mocks.getKycConfig.mockResolvedValue({ requiredCategories: ["vds"], rejectedRetentionDays: 30 });
  mocks.releaseHeldOrdersForCustomer.mockResolvedValue({ held: 1, released: 1 });
  mocks.tx.user.updateMany.mockResolvedValue({ count: 1 });
  mocks.db.user.updateMany.mockResolvedValue({ count: 1 });
});

describe("KYC document access control", () => {
  it("allows only the owner and staff holding kyc.review", () => {
    const doc = { userId: "cus-1" };
    expect(canViewKycDocument({ id: "cus-1", role: "CUSTOMER" }, doc)).toBe(true);
    expect(canViewKycDocument({ id: "adm-1", role: "ADMIN" }, doc)).toBe(true);
    expect(canViewKycDocument({ id: "cus-2", role: "CUSTOMER" }, doc)).toBe(false);
    expect(canViewKycDocument({ id: "sup-1", role: "SUPPORT" }, doc)).toBe(false);
    expect(canViewKycDocument({ id: "bil-1", role: "BILLING" }, doc)).toBe(false);
    expect(canViewKycDocument(null, doc)).toBe(false);
  });

  it("serves the owner without an audit row, and logs staff views", async () => {
    const own = await loadKycDocumentForViewer({ id: "cus-1", role: "CUSTOMER" }, DOC_ID);
    expect(own.ok).toBe(true);
    expect(mocks.logActivity).not.toHaveBeenCalled();

    const staff = await loadKycDocumentForViewer({ id: "adm-1", role: "ADMIN" }, DOC_ID);
    expect(staff).toMatchObject({
      ok: true,
      headers: expect.objectContaining({ "cache-control": "private, no-store", "x-content-type-options": "nosniff" }),
    });
    expect(mocks.logActivity).toHaveBeenCalledWith(expect.objectContaining({ action: "KYC_DOCUMENT_VIEWED", userId: "adm-1", entityId: "cus-1" }));
  });

  it("answers 404 to other customers and staff without kyc.review (no id probing), 401 without session", async () => {
    expect(await loadKycDocumentForViewer({ id: "cus-2", role: "CUSTOMER" }, DOC_ID)).toEqual({ ok: false, status: 404 });
    expect(await loadKycDocumentForViewer({ id: "sup-1", role: "SUPPORT" }, DOC_ID)).toEqual({ ok: false, status: 404 });
    expect(await loadKycDocumentForViewer(null, DOC_ID)).toEqual({ ok: false, status: 401 });
    expect(await loadKycDocumentForViewer({ id: "adm-1", role: "ADMIN" }, "../etc/passwd")).toEqual({ ok: false, status: 404 });
    expect(mocks.storageGet).not.toHaveBeenCalled();
  });

  it("answers 410 for a deleted document", async () => {
    mocks.db.kycDocument.findUnique.mockResolvedValue({ ...storedDoc, deletedAt: new Date() });
    expect(await loadKycDocumentForViewer({ id: "cus-1", role: "CUSTOMER" }, DOC_ID)).toEqual({ ok: false, status: 410 });
  });
});

describe("submitKycDocuments", () => {
  const files = [
    { type: "IDENTITY_FRONT", name: "on.jpg", data: jpeg },
    { type: "IDENTITY_BACK", name: "arka.jpg", data: jpeg },
  ];
  function driver() {
    return { name: "local", put: vi.fn(), get: vi.fn(), delete: vi.fn() } as unknown as StorageDriver & { put: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
  }

  beforeEach(() => {
    mocks.db.user.findUnique.mockResolvedValue({ kycStatus: "NONE", customerType: "INDIVIDUAL", name: "Ayşe", surname: "Yılmaz", companyName: null });
  });

  it("requires the explicit KVKK consent before storing anything", async () => {
    const d = driver();
    await expect(
      submitKycDocuments({ userId: "cus-1", files, consentAccepted: false, ipAddress: null, userAgent: null, driver: d })
    ).rejects.toBeInstanceOf(KycError);
    expect(d.put).not.toHaveBeenCalled();
  });

  it("stores the files, the consent record and moves the customer to PENDING", async () => {
    const d = driver();
    await submitKycDocuments({ userId: "cus-1", files, consentAccepted: true, ipAddress: "203.0.113.5", userAgent: "ua", driver: d });
    expect(d.put).toHaveBeenCalledTimes(2);
    expect(mocks.tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: "cus-1", kycStatus: { in: ["NONE", "REJECTED"] } },
      data: expect.objectContaining({ kycStatus: "PENDING" }),
    });
    expect(mocks.tx.kycDocument.createMany).toHaveBeenCalled();
    expect(mocks.recordConsent).toHaveBeenCalledWith(mocks.tx, expect.objectContaining({ userId: "cus-1", ipAddress: "203.0.113.5" }));
    expect(mocks.emitEvent).toHaveBeenCalledWith(mocks.tx, "kyc.submitted", expect.objectContaining({ userId: "cus-1" }), expect.anything());
  });

  it("refuses a second submission while one is pending and cleans up stored files on a race", async () => {
    mocks.db.user.findUnique.mockResolvedValue({ kycStatus: "PENDING", customerType: "INDIVIDUAL", name: "A", surname: "B", companyName: null });
    await expect(
      submitKycDocuments({ userId: "cus-1", files, consentAccepted: true, ipAddress: null, userAgent: null, driver: driver() })
    ).rejects.toThrow("inceleniyor");

    mocks.db.user.findUnique.mockResolvedValue({ kycStatus: "NONE", customerType: "INDIVIDUAL", name: "A", surname: "B", companyName: null });
    mocks.tx.user.updateMany.mockResolvedValue({ count: 0 });
    const d = driver();
    await expect(
      submitKycDocuments({ userId: "cus-1", files, consentAccepted: true, ipAddress: null, userAgent: null, driver: d })
    ).rejects.toBeInstanceOf(KycError);
    expect(d.delete).toHaveBeenCalledTimes(2);
  });
});

describe("approve / reject", () => {
  it("approval releases the customer's held orders and announces it", async () => {
    const result = await approveKyc({ userId: "cus-1", reviewerId: "adm-1" });
    expect(mocks.db.user.updateMany).toHaveBeenCalledWith({
      where: { id: "cus-1", kycStatus: "PENDING" },
      data: expect.objectContaining({ kycStatus: "APPROVED", kycReviewedBy: "adm-1" }),
    });
    expect(mocks.releaseHeldOrdersForCustomer).toHaveBeenCalledWith("cus-1", "adm-1");
    expect(mocks.emitEvent).toHaveBeenCalledWith(mocks.db, "kyc.approved", { userId: "cus-1", releasedOrders: 1 }, { actorId: "adm-1" });
    expect(result.released).toBe(1);
  });

  it("approval without a pending submission changes nothing", async () => {
    mocks.db.user.updateMany.mockResolvedValue({ count: 0 });
    await expect(approveKyc({ userId: "cus-1", reviewerId: "adm-1" })).rejects.toBeInstanceOf(KycError);
    expect(mocks.releaseHeldOrdersForCustomer).not.toHaveBeenCalled();
  });

  it("rejection schedules the documents for deletion after the retention period", async () => {
    const now = new Date("2026-10-09T10:00:00Z");
    const { deleteAfter } = await rejectKyc({ userId: "cus-1", reviewerId: "adm-1", reason: "Arka yüz okunamıyor", now });
    expect(deleteAfter.toISOString()).toBe("2026-11-08T10:00:00.000Z");
    expect(mocks.tx.kycDocument.updateMany).toHaveBeenCalledWith({
      where: { userId: "cus-1", deletedAt: null, deleteAfter: null },
      data: { deleteAfter },
    });
    expect(mocks.emitEvent).toHaveBeenCalledWith(mocks.tx, "kyc.rejected", { userId: "cus-1", reason: "Arka yüz okunamıyor" }, { actorId: "adm-1" });
    await expect(rejectKyc({ userId: "cus-1", reviewerId: "adm-1", reason: "" })).rejects.toThrow("Ret nedenini");
  });
});
