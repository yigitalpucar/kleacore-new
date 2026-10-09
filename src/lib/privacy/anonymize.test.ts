import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Proxy database: every model/method call is recorded; counts come from
 * `counts`, so the test sees exactly which tables an anonymisation writes.
 */
const fx = vi.hoisted(() => {
  const calls: Array<{ model: string; method: string; args: unknown }> = [];
  const state = {
    counts: {} as Record<string, number>,
    user: { id: "cus-1", email: "ayse@example.com", role: "CUSTOMER", balance: "0.00" } as Record<string, unknown>,
    request: {} as Record<string, unknown>,
    attachments: [] as Array<{ storageKey: string; storageDriver: string }>,
    kycDocuments: [] as Array<Record<string, unknown>>,
    serverServices: [] as Array<Record<string, unknown>>,
  };
  const READS = new Set(["count", "findUnique", "findFirst", "findMany"]);
  const model = (name: string) =>
    new Proxy(
      {},
      {
        get: (_target, method: string) => async (args: unknown) => {
          calls.push({ model: name, method, args });
          if (method === "count") {
            const where = JSON.stringify((args as { where?: unknown })?.where ?? {});
            // Status-filtered counts (open services, unpaid invoices…) use "<model>:status".
            if (where.includes('"status"')) return state.counts[`${name}:status`] ?? 0;
            return state.counts[name] ?? 0;
          }
          if (name === "user" && method === "findUnique") return state.user;
          if (name === "dataRequest" && method === "findUnique") return state.request;
          if (name === "ticketAttachment" && method === "findMany") return state.attachments;
          if (name === "kycDocument" && method === "findMany") return state.kycDocuments;
          if (name === "service" && method === "findMany") return state.serverServices;
          if (READS.has(method)) return null;
          return method.endsWith("Many") ? { count: 1 } : {};
        },
      }
    );
  const client = new Proxy({} as Record<string, unknown>, {
    get: (_target, prop: string) => {
      if (prop === "$transaction") return async (fn: (tx: unknown) => unknown) => fn(client);
      if (prop === "then") return undefined;
      return model(prop);
    },
  });
  const deleted: string[] = [];
  return { calls, state, client, deleted, READS };
});

vi.mock("@/lib/db", () => ({ db: fx.client }));
vi.mock("@/lib/kyc/settings", () => ({
  getKycConfig: async () => ({ requiredCategories: ["vds", "server", "datacenter"], rejectedRetentionDays: 30 }),
}));
vi.mock("@/lib/storage", () => ({
  getStorageDriver: () => ({ delete: async (key: string) => void fx.deleted.push(key) }),
}));

import { anonymousEmail, applyAnonymization, buildAnonymizationPlan, previewAnonymizationForRequest, type AnonymizationSnapshot } from "./anonymize";

const FINANCIAL_MODELS = ["invoice", "invoiceItem", "payment", "refund", "eInvoiceRecord", "transaction", "consentRecord"];

function writes() {
  return fx.calls.filter((c) => !fx.READS.has(c.method));
}

beforeEach(() => {
  fx.calls.length = 0;
  fx.deleted.length = 0;
  fx.state.counts = {};
  fx.state.attachments = [];
  fx.state.kycDocuments = [];
  fx.state.serverServices = [];
  fx.state.user = { id: "cus-1", email: "ayse@example.com", role: "CUSTOMER", balance: "0.00" };
  fx.state.request = { id: "dr-1", type: "ERASURE", status: "IN_PROGRESS", userId: "cus-1", anonymizedAt: null, requestNumber: "KVKK-2026-000003" };
});

const snapshot = (counts: Partial<AnonymizationSnapshot["counts"]> = {}, user: Partial<AnonymizationSnapshot["user"]> = {}): AnonymizationSnapshot => ({
  user: { id: "cus-1", email: "ayse@example.com", role: "CUSTOMER", balance: "0.00", alreadyAnonymized: false, ...user },
  counts: {
    openServices: 0,
    unpaidInvoices: 0,
    activeDomains: 0,
    activeSavedCards: 0,
    invoices: 0,
    payments: 0,
    refunds: 0,
    eInvoices: 0,
    transactions: 0,
    orders: 0,
    consents: 0,
    tickets: 0,
    ticketAttachments: 0,
    apiKeys: 0,
    sessions: 0,
    loginEvents: 0,
    trustedDevices: 0,
    notifications: 0,
    inboxMessages: 0,
    notificationLogs: 0,
    emailAccounts: 0,
    domainsWithWhois: 0,
    contactMessages: 0,
    activityLogs: 0,
    kycDocumentsDeleted: 0,
    kycDocumentsRetained: 0,
    broadcastRecipients: 0,
    staffApiTokens: 0,
    ...counts,
  },
});

describe("buildAnonymizationPlan", () => {
  it("blocks while services are open, invoices unpaid, domains active, cards stored or balance remains", () => {
    const plan = buildAnonymizationPlan(
      snapshot({ openServices: 2, unpaidInvoices: 1, activeDomains: 1, activeSavedCards: 1 }, { balance: "15.50" })
    );
    expect(plan.canApply).toBe(false);
    expect(plan.blockers).toHaveLength(5);
    expect(plan.blockers.join(" ")).toMatch(/hizmet[\s\S]*fatura[\s\S]*alan adı[\s\S]*kart[\s\S]*bakiye/);
  });

  it("blocks staff accounts and already anonymised accounts", () => {
    expect(buildAnonymizationPlan(snapshot({}, { role: "ADMIN" })).canApply).toBe(false);
    expect(buildAnonymizationPlan(snapshot({}, { alreadyAnonymized: true })).canApply).toBe(false);
  });

  it("keeps the invoice identity when invoices exist and lists the financial records as retained", () => {
    const plan = buildAnonymizationPlan(snapshot({ invoices: 4, payments: 4, eInvoices: 4, consents: 2 }));
    expect(plan.canApply).toBe(true);
    expect(plan.keepBillingIdentity).toBe(true);
    expect(plan.retained.find((l) => l.label === "Faturalar")).toMatchObject({ count: 4, detail: expect.stringContaining("10 yıl") });
    expect(plan.retained.find((l) => l.label === "Yasal onay kayıtları")?.count).toBe(2);
  });

  it("removes the name and tax data too when there are no invoices", () => {
    const plan = buildAnonymizationPlan(snapshot());
    expect(plan.keepBillingIdentity).toBe(false);
    expect(plan.changes[0].detail).toContain("Ad, soyad");
  });
});

describe("dry run vs apply", () => {
  it("the preview only reads", async () => {
    fx.state.counts = { invoice: 3, loginEvent: 12 };
    const plan = await previewAnonymizationForRequest("dr-1");
    expect(plan.canApply).toBe(true);
    expect(writes()).toEqual([]);
  });

  it("apply overwrites personal data but never touches financial or legal records", async () => {
    fx.state.counts = { invoice: 3, payment: 3 };
    fx.state.attachments = [{ storageKey: "tickets/2026/10/abc", storageDriver: "local" }];

    const plan = await applyAnonymization("dr-1", { id: "admin-1" }, "AYSE@example.com", new Date("2026-10-09T10:00:00Z"));
    expect(plan.keepBillingIdentity).toBe(true);

    const written = writes();
    expect(written.filter((c) => FINANCIAL_MODELS.includes(c.model))).toEqual([]);

    const userUpdate = written.find((c) => c.model === "user" && c.method === "update")!.args as { data: Record<string, unknown> };
    expect(userUpdate.data).toMatchObject({
      email: anonymousEmail("cus-1"),
      phone: null,
      status: "CLOSED",
      twoFactorEnabled: false,
      twoFactorSecret: null,
      sessionVersion: { increment: 1 },
    });
    // Invoices exist: the invoice identity (name, tax number, address) stays.
    for (const field of ["name", "surname", "taxNumber", "taxOffice", "address", "companyName"]) {
      expect(userUpdate.data).not.toHaveProperty(field);
    }
    expect(String(userUpdate.data.password)).toMatch(/^\$2[aby]\$/);

    const touched = new Set(written.map((c) => `${c.model}.${c.method}`));
    for (const expected of [
      "apiKey.deleteMany",
      "session.deleteMany",
      "trustedDevice.deleteMany",
      "loginEvent.updateMany",
      "broadcastRecipient.updateMany",
      "staffApiToken.updateMany",
      "emailMessage.deleteMany",
      "ticketAttachment.deleteMany",
      "ticketMessage.updateMany",
      "supportTicket.updateMany",
      "domain.updateMany",
      "notificationLog.updateMany",
      "dataRequest.update",
      "activityLog.create",
    ]) {
      expect(touched).toContain(expected);
    }
    expect(fx.deleted).toEqual(["tickets/2026/10/abc"]);
  });

  it("apply clears the name and tax data when there are no invoices", async () => {
    await applyAnonymization("dr-1", { id: "admin-1" }, "ayse@example.com");
    const userUpdate = writes().find((c) => c.model === "user" && c.method === "update")!.args as { data: Record<string, unknown> };
    expect(userUpdate.data).toMatchObject({ name: "Anonim", surname: "Kullanıcı", taxNumber: null, address: null });
  });

  it("apply refuses while a blocker exists and writes nothing", async () => {
    fx.state.counts = { invoice: 2, "invoice:status": 1 }; // one of two invoices unpaid
    await expect(applyAnonymization("dr-1", { id: "admin-1" }, "ayse@example.com")).rejects.toThrow("ödenmemiş fatura");
    expect(writes()).toEqual([]);
  });

  it("apply requires the account e-mail as confirmation", async () => {
    await expect(applyAnonymization("dr-1", { id: "admin-1" }, "someone@else.com")).rejects.toThrow("e-posta");
    expect(writes()).toEqual([]);
  });

  it("only for an open ERASURE request that was not applied yet", async () => {
    fx.state.request = { ...fx.state.request, type: "EXPORT" };
    await expect(applyAnonymization("dr-1", { id: "admin-1" }, "ayse@example.com")).rejects.toThrow("silme talebi değil");
    fx.state.request = { ...fx.state.request, type: "ERASURE", anonymizedAt: new Date() };
    await expect(applyAnonymization("dr-1", { id: "admin-1" }, "ayse@example.com")).rejects.toThrow("zaten");
    expect(writes()).toEqual([]);
  });

  it("keeps sign-in history for its retention (e-mail anonymised), redacts broadcast addresses, revokes staff API tokens", async () => {
    const now = new Date("2026-10-09T10:00:00Z");
    await applyAnonymization("dr-1", { id: "admin-1" }, "ayse@example.com", now);
    const written = writes();
    expect(written.find((c) => c.model === "loginEvent" && c.method === "deleteMany")).toBeUndefined();
    expect(written.find((c) => c.model === "loginEvent" && c.method === "updateMany")?.args).toEqual({
      where: { userId: "cus-1" },
      data: { email: anonymousEmail("cus-1") },
    });
    expect(written.find((c) => c.model === "broadcastRecipient")?.args).toMatchObject({ data: { to: expect.stringContaining("KVKK") } });
    expect(written.find((c) => c.model === "staffApiToken")?.args).toEqual({
      where: { userId: "cus-1", revokedAt: null },
      data: { revokedAt: now, revokedById: "admin-1" },
    });
    const plan = await previewAnonymizationForRequest("dr-1");
    expect(plan.retained.map((line) => line.label)).toContain("Giriş geçmişi");
  });
});

describe("KYC documents on erasure", () => {
  const docs = [
    { id: "kyc-1", storageDriver: "local", storageKey: "kyc/2026/09/front", deletedAt: null, deleteAfter: null },
    { id: "kyc-2", storageDriver: "local", storageKey: "kyc/2026/09/back", deletedAt: null, deleteAfter: null },
    { id: "kyc-3", storageDriver: "local", storageKey: "kyc/2026/08/rejected", deletedAt: null, deleteAfter: new Date("2026-09-10") },
    { id: "kyc-4", storageDriver: "local", storageKey: "kyc/2026/07/gone", deletedAt: new Date("2026-08-01"), deleteAfter: new Date("2026-08-01") },
  ];

  it("retains approved documents for 2 years after the last server service; deletes the rest (files + rows)", async () => {
    fx.state.user = { ...fx.state.user, kycStatus: "APPROVED" };
    fx.state.kycDocuments = docs;
    fx.state.serverServices = [{ status: "CANCELLED", cancelledAt: new Date("2026-04-01"), expiresAt: null, updatedAt: new Date("2026-04-01") }];

    const preview = await previewAnonymizationForRequest("dr-1", new Date("2026-10-09"));
    expect(preview.retained.find((l) => l.label.startsWith("Onaylı kimlik"))).toMatchObject({
      count: 2,
      detail: expect.stringContaining("2028-04-01"),
    });
    expect(preview.changes.find((l) => l.label.startsWith("Kimlik doğrulama"))?.count).toBe(2);

    await applyAnonymization("dr-1", { id: "admin-1" }, "ayse@example.com", new Date("2026-10-09"));
    const removed = writes().find((c) => c.model === "kycDocument" && c.method === "deleteMany")?.args;
    expect(removed).toEqual({ where: { id: { in: ["kyc-3", "kyc-4"] } } });
    // The stub's file is already gone; only the rejected document's file is deleted.
    expect(fx.deleted).toEqual(["kyc/2026/08/rejected"]);
  });

  it("deletes approved documents too once the retention after the last server service has passed", async () => {
    fx.state.user = { ...fx.state.user, kycStatus: "APPROVED" };
    fx.state.kycDocuments = docs.slice(0, 2);
    fx.state.serverServices = [{ status: "CANCELLED", cancelledAt: new Date("2023-01-01"), expiresAt: null, updatedAt: new Date("2023-01-01") }];

    await applyAnonymization("dr-1", { id: "admin-1" }, "ayse@example.com", new Date("2026-10-09"));
    expect(writes().find((c) => c.model === "kycDocument")?.args).toEqual({ where: { id: { in: ["kyc-1", "kyc-2"] } } });
    expect(fx.deleted).toEqual(["kyc/2026/09/front", "kyc/2026/09/back"]);
  });
});

