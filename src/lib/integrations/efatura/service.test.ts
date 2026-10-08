import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EInvoiceConfig, EInvoiceProvider } from "./types";

const mocks = vi.hoisted(() => ({
  db: {
    invoice: { findUnique: vi.fn() },
    eInvoiceRecord: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
  config: null as unknown as EInvoiceConfig,
  provider: null as unknown as EInvoiceProvider & { getStatuses: ReturnType<typeof vi.fn> },
}));

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("./config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./config")>();
  return {
    ...actual,
    getEInvoiceConfig: vi.fn(async () => mocks.config),
    createEInvoiceProvider: vi.fn(() => mocks.provider),
  };
});

import { issueEInvoiceForInvoice, retryEInvoiceRecord, syncEInvoiceStatuses, cancelEInvoiceRecord } from "./service";

const config: EInvoiceConfig = {
  enabled: true,
  provider: "uyumsoft",
  apiKey: "",
  companyVkn: "1234567890",
  defaultProfile: "TICARIFATURA",
  uyumsoft: { username: "u", password: "p", testMode: true, earsivPrefix: "", efaturaPrefix: "" },
  supplier: {
    name: "KLEAWORK",
    vkn: "1234567890",
    taxOffice: "Kadıköy",
    street: "",
    district: "",
    city: "İstanbul",
    postalZone: "",
    country: "Türkiye",
    phone: "",
    email: "",
    website: "https://kleacore.com",
  },
};

const paidInvoice = (taxNumber: string | null = null) => ({
  id: "inv_1",
  invoiceNumber: "F-1",
  customerId: "c1",
  status: "PAID",
  subtotal: 100,
  taxRate: 20,
  taxAmount: 20,
  totalAmount: 120,
  issuedAt: new Date(),
  paidAt: new Date(),
  items: [{ id: "i", description: "Hosting", quantity: 1, unitPrice: 100, totalPrice: 120 }],
  payments: [],
  customer: {
    name: "Ali",
    surname: "Yılmaz",
    email: "ali@example.com",
    phone: null,
    customerType: taxNumber ? "CORPORATE" : "INDIVIDUAL",
    companyName: taxNumber ? "Acme" : null,
    taxNumber,
    taxOffice: null,
    address: null,
    city: null,
    country: "Türkiye",
  },
});

const record = (overrides: Record<string, unknown> = {}) => ({
  id: "rec_1",
  invoiceId: "inv_1",
  customerId: "c1",
  type: "e-arsiv",
  status: "QUEUED",
  documentUuid: "uuid-1",
  documentNumber: null,
  provider: "uyumsoft",
  attempts: 0,
  sentAt: null,
  ...overrides,
});

beforeEach(() => {
  mocks.config = structuredClone(config);
  mocks.provider = {
    name: "uyumsoft",
    healthCheck: vi.fn(),
    checkTaxpayer: vi.fn(async () => ({ isEInvoiceUser: false })),
    issue: vi.fn(async (doc: { uuid: string }) => ({ uuid: doc.uuid, number: "BOX2026000000001", status: "SENT" as const, providerStatus: "Queued" })),
    getStatus: vi.fn(),
    getStatuses: vi.fn(async () => new Map()),
    getPdf: vi.fn(),
    cancel: vi.fn(),
  };
  mocks.db.invoice.findUnique.mockResolvedValue(paidInvoice());
  mocks.db.eInvoiceRecord.findUnique.mockResolvedValue(null);
  mocks.db.eInvoiceRecord.create.mockResolvedValue(record());
  mocks.db.eInvoiceRecord.updateMany.mockResolvedValue({ count: 1 });
  mocks.db.eInvoiceRecord.update.mockImplementation(async ({ data }) => ({ ...record(), ...data }));
});

describe("issueEInvoiceForInvoice", () => {
  it("skips quietly when the module is not configured", async () => {
    mocks.config.enabled = false;
    const outcome = await issueEInvoiceForInvoice("inv_1");
    expect(outcome).toMatchObject({ ok: false, skipped: true });
    expect(mocks.db.invoice.findUnique).not.toHaveBeenCalled();
  });

  it("refuses unpaid invoices", async () => {
    mocks.db.invoice.findUnique.mockResolvedValue({ ...paidInvoice(), status: "PENDING" });
    await expect(issueEInvoiceForInvoice("inv_1")).rejects.toThrow("INVOICE_NOT_PAID");
  });

  it("issues an e-Arşiv for a customer without a tax number and stores number + status", async () => {
    const outcome = await issueEInvoiceForInvoice("inv_1");

    expect(outcome.ok).toBe(true);
    expect(mocks.provider.checkTaxpayer).not.toHaveBeenCalled();
    const doc = vi.mocked(mocks.provider.issue).mock.calls[0][0];
    expect(doc).toMatchObject({ type: "e-arsiv", profile: "EARSIVFATURA", uuid: "uuid-1" });
    expect(mocks.db.eInvoiceRecord.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "SENT",
          documentNumber: "BOX2026000000001",
          documentUuid: "uuid-1",
          type: "e-arsiv",
          errorMessage: null,
        }),
      })
    );
  });

  it("issues an e-Fatura with the default profile when the VKN is a registered user", async () => {
    mocks.db.invoice.findUnique.mockResolvedValue(paidInvoice("9000068418"));
    vi.mocked(mocks.provider.checkTaxpayer).mockResolvedValue({ isEInvoiceUser: true, alias: "urn:mail:pk@x.com" });

    await issueEInvoiceForInvoice("inv_1");

    expect(mocks.provider.checkTaxpayer).toHaveBeenCalledWith("9000068418");
    expect(vi.mocked(mocks.provider.issue).mock.calls[0][0]).toMatchObject({
      type: "e-fatura",
      profile: "TICARIFATURA",
      customerAlias: "urn:mail:pk@x.com",
    });
  });

  it("falls back to e-Arşiv when the VKN is not an e-Fatura user", async () => {
    mocks.db.invoice.findUnique.mockResolvedValue(paidInvoice("1234567801"));
    await issueEInvoiceForInvoice("inv_1");
    expect(vi.mocked(mocks.provider.issue).mock.calls[0][0].type).toBe("e-arsiv");
  });

  it("is idempotent: an already issued record is returned untouched", async () => {
    mocks.db.eInvoiceRecord.findUnique.mockResolvedValue(record({ status: "SENT" }));
    const outcome = await issueEInvoiceForInvoice("inv_1");
    expect(outcome.ok).toBe(true);
    expect(mocks.provider.issue).not.toHaveBeenCalled();
    expect(mocks.db.eInvoiceRecord.updateMany).not.toHaveBeenCalled();
  });

  it("does nothing when another worker holds the claim", async () => {
    mocks.db.eInvoiceRecord.updateMany.mockResolvedValue({ count: 0 });
    const outcome = await issueEInvoiceForInvoice("inv_1");
    expect(outcome).toMatchObject({ ok: false, skipped: true, reason: "EFATURA_IN_PROGRESS" });
    expect(mocks.provider.issue).not.toHaveBeenCalled();
  });

  it("records provider errors on the record as FAILED with the message, keeping the ETTN", async () => {
    vi.mocked(mocks.provider.issue).mockRejectedValue(new Error("UYUMSOFT_FAULT: yetkiniz yok"));
    const outcome = await issueEInvoiceForInvoice("inv_1");
    expect(outcome).toMatchObject({ ok: false, error: "UYUMSOFT_FAULT: yetkiniz yok" });
    expect(mocks.db.eInvoiceRecord.update).toHaveBeenLastCalledWith({
      where: { id: "rec_1" },
      data: { status: "FAILED", documentUuid: "uuid-1", errorMessage: "UYUMSOFT_FAULT: yetkiniz yok" },
    });
  });

  it("adopts a document that reached Uyumsoft in an earlier attempt instead of re-issuing", async () => {
    mocks.db.eInvoiceRecord.findUnique.mockResolvedValue(record({ status: "FAILED", attempts: 1 }));
    mocks.provider.getStatuses.mockResolvedValue(
      new Map([["uuid-1", { status: "ACCEPTED", providerStatus: "Approved" }]])
    );

    const outcome = await issueEInvoiceForInvoice("inv_1");

    expect(outcome.ok).toBe(true);
    expect(mocks.provider.issue).not.toHaveBeenCalled();
    expect(mocks.db.eInvoiceRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "ACCEPTED", providerStatus: "Approved" }) })
    );
  });

  it("reserves a local SSSYYYY number when a series prefix is configured", async () => {
    mocks.config.uyumsoft.earsivPrefix = "KLE";
    mocks.db.eInvoiceRecord.findFirst.mockResolvedValue({ documentNumber: "KLE2026000000041" });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-08T10:00:00Z"));
    try {
      await issueEInvoiceForInvoice("inv_1");
    } finally {
      vi.useRealTimers();
    }
    expect(vi.mocked(mocks.provider.issue).mock.calls[0][0].number).toBe("KLE2026000000042");
  });
});

describe("retryEInvoiceRecord", () => {
  it("only retries failed/queued records and surfaces the error", async () => {
    mocks.db.eInvoiceRecord.findUnique.mockResolvedValueOnce(record({ status: "ACCEPTED" }));
    await expect(retryEInvoiceRecord("rec_1")).rejects.toThrow("EFATURA_RECORD_NOT_RETRYABLE");

    mocks.db.eInvoiceRecord.findUnique.mockResolvedValue(record({ status: "FAILED" }));
    vi.mocked(mocks.provider.issue).mockRejectedValue(new Error("boom"));
    await expect(retryEInvoiceRecord("rec_1")).rejects.toThrow("boom");
  });
});

describe("syncEInvoiceStatuses", () => {
  it("updates in-flight records from a batch status query", async () => {
    mocks.db.eInvoiceRecord.findMany.mockResolvedValue([
      { id: "r1", documentUuid: "uuid-1" },
      { id: "r2", documentUuid: "uuid-2" },
      { id: "r3", documentUuid: "uuid-3" },
    ]);
    mocks.provider.getStatuses.mockResolvedValue(
      new Map([
        ["uuid-1", { status: "ACCEPTED", providerStatus: "Approved" }],
        ["uuid-2", { status: "FAILED", providerStatus: "Error", message: "Şema hatası" }],
      ])
    );

    const result = await syncEInvoiceStatuses();

    expect(result).toEqual({ checked: 3, changed: 2 });
    expect(mocks.db.eInvoiceRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "r2" }, data: expect.objectContaining({ status: "FAILED", errorMessage: "Şema hatası" }) })
    );
    expect(mocks.db.eInvoiceRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "r3" }, data: { statusCheckedAt: expect.any(Date) } })
    );
  });
});

describe("cancelEInvoiceRecord", () => {
  it("cancels issued e-Arşiv only, with a reason", async () => {
    await expect(cancelEInvoiceRecord("rec_1", "")).rejects.toThrow("EFATURA_CANCEL_REASON_REQUIRED");

    mocks.db.eInvoiceRecord.findUnique.mockResolvedValueOnce(record({ type: "e-fatura", status: "SENT" }));
    await expect(cancelEInvoiceRecord("rec_1", "Hatalı tutar")).rejects.toThrow("EFATURA_CANCEL_ONLY_EARSIV");

    mocks.db.eInvoiceRecord.findUnique.mockResolvedValueOnce(record({ status: "ACCEPTED" }));
    await cancelEInvoiceRecord("rec_1", "Hatalı tutar");
    expect(mocks.provider.cancel).toHaveBeenCalledWith("uuid-1", "Hatalı tutar");
    expect(mocks.db.eInvoiceRecord.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "CANCELLED", cancelReason: "Hatalı tutar" }) })
    );
  });
});
