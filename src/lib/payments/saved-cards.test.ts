import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => {
  process.env.ENCRYPTION_KEY = "test-encryption-key-for-saved-cards";
  process.env.PAYTR_MERCHANT_ID = "123456";
  process.env.PAYTR_MERCHANT_KEY = "paytr-key";
  process.env.PAYTR_MERCHANT_SALT = "paytr-salt";
  process.env.SAVED_CARDS_ENABLED = "true";
  process.env.CRON_TIMEZONE = "Europe/Istanbul";
  return { UTOKEN: "UT-super-secret-user-token", CTOKEN: "CT-super-secret-card-token" };
});

const fake = vi.hoisted(() => ({ current: null as unknown as ReturnType<typeof import("./test-utils/fake-prisma").createSavedCardsFakeDb> }));
const spies = vi.hoisted(() => ({
  sendNotification: vi.fn(async (_input: Record<string, unknown>) => ({ ok: true, logIds: [], deduplicated: false })),
  emitEvent: vi.fn(async (..._args: unknown[]) => undefined),
  fulfillGatewayReference: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  get db() {
    return fake.current.db;
  },
}));
vi.mock("@/lib/notifications/send", () => ({ sendNotification: spies.sendNotification }));
vi.mock("@/lib/events/emit", () => ({ emitEvent: spies.emitEvent }));
vi.mock("@/lib/payments/gateway-fulfillment", () => ({ fulfillGatewayReference: spies.fulfillGatewayReference }));

import { createSavedCardsFakeDb } from "./test-utils/fake-prisma";
import { createLogger } from "@/lib/logger";
import { decryptSecret, encryptSecret } from "@/lib/secrets/crypto";
import {
  buildPaytrCapiDeleteToken,
  buildPaytrCapiListToken,
  buildPaytrDirectToken,
} from "@/lib/integrations/payment-gateways/providers/paytr-card-storage";
import {
  SAVED_CARD_CONSENT_TEXT,
  SavedCardError,
  deleteSavedCard,
  handleCardVerificationNotification,
  loadCardVerificationForm,
  setAutoPay,
  startCardVerification,
} from "./saved-cards";
import { autoChargeKey, runAutoCharge } from "./auto-charge";

const credentials = { merchantId: "123456", merchantKey: "paytr-key", merchantSalt: "paytr-salt" };

type ChargeOutcome = "success" | "failed" | "wait_callback";

/** Fake PayTR (Kart Saklama + Direct + iade). Checks every paytr_token like PayTR would. */
function createFakePaytr() {
  const state = {
    cards: new Map<string, Array<Record<string, string>>>(),
    chargeOutcome: "success" as ChargeOutcome,
    deleteFails: false,
    listFails: false,
    charges: [] as URLSearchParams[],
    deletes: [] as URLSearchParams[],
    refunds: [] as URLSearchParams[],
    badTokens: 0,
  };
  const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const body = new URLSearchParams(String(init?.body ?? ""));
    const json = (value: unknown) => new Response(JSON.stringify(value), { status: 200 });
    const target = String(url);

    if (target === "https://www.paytr.com/odeme/capi/list") {
      if (body.get("paytr_token") !== buildPaytrCapiListToken(credentials, body.get("utoken") ?? "")) state.badTokens += 1;
      if (state.listFails) return json({ status: "error", err_msg: "geçersiz utoken" });
      return json(state.cards.get(body.get("utoken") ?? "") ?? []);
    }
    if (target === "https://www.paytr.com/odeme/capi/delete") {
      state.deletes.push(body);
      const utoken = body.get("utoken") ?? "";
      const ctoken = body.get("ctoken") ?? "";
      if (body.get("paytr_token") !== buildPaytrCapiDeleteToken(credentials, ctoken, utoken)) state.badTokens += 1;
      if (state.deleteFails) return json({ status: "error", err_msg: "Sistem hatası" });
      state.cards.set(utoken, (state.cards.get(utoken) ?? []).filter((card) => card.ctoken !== ctoken));
      return json({ status: "success" });
    }
    if (target === "https://www.paytr.com/odeme/iade") {
      state.refunds.push(body);
      return json({ status: "success", merchant_oid: body.get("merchant_oid"), return_amount: body.get("return_amount") });
    }
    if (target === "https://www.paytr.com/odeme") {
      state.charges.push(body);
      const expected = buildPaytrDirectToken(credentials, {
        userIp: body.get("user_ip") ?? "",
        merchantOid: body.get("merchant_oid") ?? "",
        email: body.get("email") ?? "",
        paymentAmount: body.get("payment_amount") ?? "",
        paymentType: body.get("payment_type") ?? "",
        installmentCount: body.get("installment_count") ?? "",
        currency: body.get("currency") ?? "",
        testMode: body.get("test_mode") ?? "",
        non3d: body.get("non_3d") ?? "",
      });
      if (body.get("paytr_token") !== expected) state.badTokens += 1;
      const known = (state.cards.get(body.get("utoken") ?? "") ?? []).some((card) => card.ctoken === body.get("ctoken"));
      if (!known) return json({ status: "failed", msg: "Kart bulunamadı", try_again: false });
      if (state.chargeOutcome === "success") return json({ status: "success", msg: "Başarılı" });
      if (state.chargeOutcome === "wait_callback") return json({ status: "wait_callback" });
      return json({ status: "failed", msg: "Yetersiz bakiye", try_again: false });
    }
    throw new Error(`unexpected fetch ${target}`);
  });
  return { state, fetchMock };
}

let paytr: ReturnType<typeof createFakePaytr>;

function seedUser(overrides: Record<string, unknown> = {}) {
  return fake.current.insert("user", {
    email: "ayse@example.com",
    name: "Ayşe",
    surname: "Yılmaz",
    address: "Atatürk Cad. 1",
    city: "İstanbul",
    phone: "05551112233",
    autoPayEnabled: false,
    ...overrides,
  });
}

function seedActiveCard(userId: string, overrides: Record<string, unknown> = {}) {
  const ctoken = (overrides.ctoken as string) ?? env.CTOKEN;
  const list = paytr.state.cards.get(env.UTOKEN) ?? [];
  list.push({ ctoken, last_4: "2544", month: "06", year: "29" });
  paytr.state.cards.set(env.UTOKEN, list);
  const { ctoken: _ignored, ...rest } = overrides;
  return fake.current.insert("savedCard", {
    userId,
    gateway: "paytr",
    gatewayCustomerRef: encryptSecret(env.UTOKEN),
    cardToken: encryptSecret(ctoken),
    last4: "2544",
    brand: "MASTERCARD",
    expMonth: 6,
    expYear: 2029,
    bankName: "Kuveyt Türk",
    requireCvv: false,
    isDefault: true,
    status: "ACTIVE",
    consentAt: new Date(),
    consentIp: "203.0.113.7",
    consentText: SAVED_CARD_CONSENT_TEXT,
    verificationRef: null,
    expiryNoticeSentAt: null,
    ...rest,
  });
}

function seedInvoice(customerId: string, dueDate: Date, overrides: Record<string, unknown> = {}) {
  return fake.current.insert("invoice", {
    invoiceNumber: `F-2026-${Math.floor(Math.random() * 1e6)}`,
    customerId,
    status: "PENDING",
    totalAmount: "120.00",
    paidAmount: "0.00",
    dueDate,
    ...overrides,
  });
}

beforeEach(() => {
  fake.current = createSavedCardsFakeDb();
  paytr = createFakePaytr();
  vi.stubGlobal("fetch", paytr.fetchMock);
  spies.fulfillGatewayReference.mockImplementation(async (reference: string) => {
    const payments = fake.current.rows("payment").filter((payment) => payment.transactionId === reference);
    for (const payment of payments) {
      payment.status = "COMPLETED";
      const invoice = fake.current.rows("invoice").find((row) => row.id === payment.invoiceId);
      if (invoice) Object.assign(invoice, { status: "PAID", paidAmount: invoice.totalAmount });
    }
    return { fulfilled: payments.length > 0, skipped: false, amountMismatch: false, invoiceIds: [], results: [] };
  });
});

describe("saved cards: consent", () => {
  it("refuses to store a card without explicit consent and records nothing", async () => {
    const user = seedUser();
    await expect(startCardVerification({ userId: user.id, consent: false })).rejects.toMatchObject({
      code: "CONSENT_REQUIRED",
    });
    expect(fake.current.rows("savedCard")).toHaveLength(0);
    expect(paytr.fetchMock).not.toHaveBeenCalled();
  });

  it("records consent text, time and IP with the pending card", async () => {
    const user = seedUser();
    const now = new Date("2026-10-08T09:00:00Z");
    const { ref } = await startCardVerification({ userId: user.id, consent: true, ip: "203.0.113.7", userAgent: "UA", now });
    const card = fake.current.rows("savedCard")[0];
    expect(card).toMatchObject({
      status: "PENDING",
      verificationRef: ref,
      consentAt: now,
      consentIp: "203.0.113.7",
      consentText: SAVED_CARD_CONSENT_TEXT,
    });
  });

  it("does not switch auto-pay on without consent", async () => {
    const user = seedUser();
    seedActiveCard(user.id);
    await expect(setAutoPay({ userId: user.id, enabled: true, consent: false })).rejects.toBeInstanceOf(SavedCardError);
    expect(fake.current.rows("user")[0].autoPayEnabled).toBe(false);

    await setAutoPay({ userId: user.id, enabled: true, consent: true, ip: "203.0.113.7" });
    expect(fake.current.rows("user")[0]).toMatchObject({ autoPayEnabled: true, autoPayConsentIp: "203.0.113.7" });
  });
});

describe("saved cards: storing at PayTR", () => {
  it("builds a store_card form without any card data and stores only encrypted tokens + masked info", async () => {
    const user = seedUser();
    const { ref } = await startCardVerification({ userId: user.id, consent: true, ip: "203.0.113.7" });

    const form = await loadCardVerificationForm(user.id, ref, "203.0.113.7");
    expect(form?.action).toBe("https://www.paytr.com/odeme");
    expect(form?.fields).toMatchObject({ store_card: "1", non_3d: "0", payment_amount: "1.00", merchant_oid: ref });
    expect(Object.keys(form?.fields ?? {})).not.toEqual(expect.arrayContaining(["card_number", "cvv"]));
    // Signed exactly as PayTR checks it.
    expect(form?.fields.paytr_token).toBe(
      buildPaytrDirectToken(credentials, {
        userIp: "203.0.113.7",
        merchantOid: ref,
        email: "ayse@example.com",
        paymentAmount: "1.00",
        paymentType: "card",
        installmentCount: "0",
        currency: "TL",
        testMode: "0",
        non3d: "0",
      })
    );

    paytr.state.cards.set(env.UTOKEN, [
      { ctoken: env.CTOKEN, last_4: "2544", month: "06", year: "29", c_bank: "Kuveyt Türk", schema: "MASTERCARD", require_cvv: "0", c_brand: "saglamkart" },
    ]);
    const result = await handleCardVerificationNotification({ merchantOid: ref, status: "success", totalAmount: "100", utoken: env.UTOKEN });
    expect(result).toMatchObject({ status: "ACTIVE" });

    const card = fake.current.rows("savedCard")[0];
    expect(card).toMatchObject({
      status: "ACTIVE",
      isDefault: true,
      last4: "2544",
      brand: "MASTERCARD",
      expMonth: 6,
      expYear: 2029,
      bankName: "Kuveyt Türk",
    });
    expect(String(card.cardToken)).toMatch(/^enc:v1:/);
    expect(String(card.gatewayCustomerRef)).toMatch(/^enc:v1:/);
    expect(decryptSecret(String(card.cardToken))).toBe(env.CTOKEN);
    expect(JSON.stringify(card)).not.toContain(env.CTOKEN);

    // The 1 TL verification is refunded.
    expect(paytr.state.refunds).toHaveLength(1);
    expect(paytr.state.refunds[0].get("return_amount")).toBe("1.00");
    expect(card.verificationChargedAt).toBeInstanceOf(Date);
    expect(card.verificationRefundedAt).toBeInstanceOf(Date);

    // A repeated notification changes nothing and refunds nothing twice.
    await handleCardVerificationNotification({ merchantOid: ref, status: "success", totalAmount: "100", utoken: env.UTOKEN });
    expect(paytr.state.refunds).toHaveLength(1);
    expect(paytr.state.badTokens).toBe(0);
  });

  it("marks the card failed when 3D verification fails", async () => {
    const user = seedUser();
    const { ref } = await startCardVerification({ userId: user.id, consent: true });
    await handleCardVerificationNotification({ merchantOid: ref, status: "failed", totalAmount: "100", failedReason: "3D doğrulama başarısız" });
    expect(fake.current.rows("savedCard")[0]).toMatchObject({ status: "FAILED", failureReason: "3D doğrulama başarısız" });
    // No money moved: nothing to refund, no admin alert.
    expect(fake.current.rows("savedCard")[0].verificationChargedAt).toBeUndefined();
    expect(paytr.state.refunds).toHaveLength(0);
  });
});

describe("saved cards: tokens never reach logs", () => {
  it("keeps utoken/ctoken out of every log line, notification and event", async () => {
    const lines: string[] = [];
    for (const method of ["log", "warn", "error", "info", "debug"] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        lines.push(args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" "));
      });
    }

    const user = seedUser({ autoPayEnabled: true });
    // Failure paths that log: CAPI LIST error, declined charges, refused delete.
    const { ref } = await startCardVerification({ userId: user.id, consent: true });
    paytr.state.listFails = true;
    await handleCardVerificationNotification({ merchantOid: ref, status: "success", totalAmount: "100", utoken: env.UTOKEN });
    paytr.state.listFails = false;

    const card = seedActiveCard(user.id);
    seedInvoice(user.id, new Date("2026-10-08T06:00:00Z"));
    paytr.state.chargeOutcome = "failed";
    await runAutoCharge(new Date("2026-10-08T09:00:00Z"));
    paytr.state.deleteFails = true;
    await expect(deleteSavedCard(user.id, card.id)).rejects.toBeInstanceOf(SavedCardError);

    // Even a careless log call with token-shaped keys is redacted.
    createLogger("test").error("oops", { utoken: env.UTOKEN, ctoken: env.CTOKEN, cardToken: env.CTOKEN, gatewayCustomerRef: env.UTOKEN });

    const everything = [
      ...lines,
      JSON.stringify(spies.sendNotification.mock.calls),
      JSON.stringify(spies.emitEvent.mock.calls),
      JSON.stringify(fake.current.rows("paymentAttempt")),
      JSON.stringify(fake.current.rows("payment")),
    ].join("\n");
    expect(lines.length).toBeGreaterThan(0);
    expect(spies.sendNotification).toHaveBeenCalled();
    expect(everything).not.toContain(env.UTOKEN);
    expect(everything).not.toContain(env.CTOKEN);
  });
});

describe("saved cards: deletion", () => {
  it("deletes the card at PayTR, wipes the tokens and promotes the next default", async () => {
    const user = seedUser({ autoPayEnabled: true });
    const older = seedActiveCard(user.id, { ctoken: "CT-older", isDefault: false, createdAt: new Date("2026-01-01") });
    const current = seedActiveCard(user.id);

    await deleteSavedCard(user.id, current.id);

    expect(paytr.state.deletes).toHaveLength(1);
    expect(paytr.state.deletes[0].get("utoken")).toBe(env.UTOKEN);
    expect(paytr.state.deletes[0].get("ctoken")).toBe(env.CTOKEN);
    expect(paytr.state.badTokens).toBe(0);
    expect(paytr.state.cards.get(env.UTOKEN)?.map((card) => card.ctoken)).toEqual(["CT-older"]);

    const deleted = fake.current.rows("savedCard").find((row) => row.id === current.id);
    expect(deleted).toMatchObject({ status: "DELETED", cardToken: "", gatewayCustomerRef: "", isDefault: false });
    expect(fake.current.rows("savedCard").find((row) => row.id === older.id)?.isDefault).toBe(true);
    expect(fake.current.rows("user")[0].autoPayEnabled).toBe(true);
  });

  it("keeps the card when PayTR refuses the delete, and turns auto-pay off after the last card", async () => {
    const user = seedUser({ autoPayEnabled: true });
    const card = seedActiveCard(user.id);

    paytr.state.deleteFails = true;
    await expect(deleteSavedCard(user.id, card.id)).rejects.toMatchObject({ code: "GATEWAY_ERROR" });
    expect(fake.current.rows("savedCard")[0]).toMatchObject({ status: "ACTIVE" });

    paytr.state.deleteFails = false;
    await deleteSavedCard(user.id, card.id);
    expect(fake.current.rows("savedCard")[0]).toMatchObject({ status: "DELETED" });
    expect(fake.current.rows("user")[0].autoPayEnabled).toBe(false);
  });

  it("never deletes another customer's card", async () => {
    const owner = seedUser();
    const other = seedUser({ email: "other@example.com" });
    const card = seedActiveCard(owner.id);
    await expect(deleteSavedCard(other.id, card.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(paytr.state.deletes).toHaveLength(0);
  });
});

describe("automatic collection", () => {
  const day = (iso: string) => new Date(`${iso}T06:00:00Z`); // 09:00 Istanbul

  it("charges the outstanding amount once and settles through the regular fulfilment", async () => {
    const user = seedUser({ autoPayEnabled: true });
    seedActiveCard(user.id);
    const invoice = seedInvoice(user.id, day("2026-10-08"), { paidAmount: "20.00" });

    const first = await runAutoCharge(day("2026-10-08"));
    const second = await runAutoCharge(day("2026-10-08"));

    expect(first).toMatchObject({ charged: 1, failed: 0 });
    expect(second.charged).toBe(0);
    expect(paytr.state.charges).toHaveLength(1);
    const charge = paytr.state.charges[0];
    expect(charge.get("payment_amount")).toBe("100.00");
    expect(charge.get("non_3d")).toBe("1");
    expect(charge.get("recurring_payment")).toBe("1");
    expect(paytr.state.badTokens).toBe(0);

    const payment = fake.current.rows("payment")[0];
    expect(payment).toMatchObject({ invoiceId: invoice.id, amount: "100.00", method: "CREDIT_CARD", status: "COMPLETED" });
    expect(spies.fulfillGatewayReference).toHaveBeenCalledWith(payment.transactionId, expect.any(String), { requestedAmount: 100 });
    expect(fake.current.rows("invoice")[0].status).toBe("PAID");
    expect(fake.current.rows("paymentAttempt")[0]).toMatchObject({
      idempotencyKey: autoChargeKey(invoice.id, day("2026-10-08")),
      status: "SUCCEEDED",
      kind: "AUTO",
    });
  });

  it("is idempotent per invoice and day even when the charge failed (two runs → one charge)", async () => {
    const user = seedUser({ autoPayEnabled: true });
    seedActiveCard(user.id);
    seedInvoice(user.id, day("2026-10-08"));
    paytr.state.chargeOutcome = "failed";

    await runAutoCharge(day("2026-10-08"));
    const rerun = await runAutoCharge(new Date("2026-10-08T18:00:00Z"));

    expect(paytr.state.charges).toHaveLength(1);
    expect(rerun.skippedReasons).toMatchObject({ "already-attempted-today": 1 });
    expect(spies.sendNotification).toHaveBeenCalledTimes(1);
  });

  it("counts failures: one attempt per day, notifies each time, stops after max attempts", async () => {
    const user = seedUser({ autoPayEnabled: true });
    seedActiveCard(user.id);
    const invoice = seedInvoice(user.id, day("2026-10-08"));
    paytr.state.chargeOutcome = "failed";

    for (const date of ["2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"]) {
      await runAutoCharge(day(date));
    }

    expect(paytr.state.charges).toHaveLength(3);
    const failures = spies.sendNotification.mock.calls
      .map(([input]) => input)
      .filter((input) => input.template === "billing.auto-charge-failed");
    expect(failures.map((input) => (input.data as { attempt: number }).attempt)).toEqual([1, 2, 3]);
    expect(failures[0]).toMatchObject({
      userId: user.id,
      data: { invoiceId: invoice.id, maxAttempts: 3, card: "Mastercard •••• 2544", reason: "Yetersiz bakiye" },
    });
    expect(spies.emitEvent).toHaveBeenCalledTimes(3);
    expect(spies.emitEvent.mock.calls[0][1]).toBe("payment.failed");
    expect(fake.current.rows("payment").every((payment) => payment.status === "FAILED")).toBe(true);
    expect(fake.current.rows("invoice")[0].status).toBe("PENDING");
  });

  it("skips customers without auto-pay, invoices outside the grace window and pending bank transfers", async () => {
    const off = seedUser({ autoPayEnabled: false });
    seedActiveCard(off.id);
    seedInvoice(off.id, day("2026-10-08"));

    const on = seedUser({ email: "on@example.com", autoPayEnabled: true });
    seedActiveCard(on.id, { ctoken: "CT-on" });
    seedInvoice(on.id, day("2026-10-01")); // due+7 > grace 3
    seedInvoice(on.id, day("2026-10-20")); // not due yet
    const notified = seedInvoice(on.id, day("2026-10-08"));
    fake.current.insert("bankTransferNotice", { invoiceId: notified.id, status: "PENDING" });

    const summary = await runAutoCharge(day("2026-10-08"));
    expect(summary.processed).toBe(0);
    expect(paytr.state.charges).toHaveLength(0);
  });

  it("leaves a 'wait_callback' charge open and does not charge again while it is in flight", async () => {
    const user = seedUser({ autoPayEnabled: true });
    seedActiveCard(user.id);
    seedInvoice(user.id, day("2026-10-08"));
    paytr.state.chargeOutcome = "wait_callback";

    const first = await runAutoCharge(day("2026-10-08"));
    const nextDay = await runAutoCharge(day("2026-10-09"));

    expect(first.pending).toBe(1);
    expect(nextDay.skippedReasons).toMatchObject({ "in-flight": 1 });
    expect(paytr.state.charges).toHaveLength(1);
    expect(fake.current.rows("paymentAttempt")[0].status).toBe("UNKNOWN");
  });
});

describe("card expiry", () => {
  it("notifies once 30 days before expiry and retires expired cards", async () => {
    const user = seedUser({ autoPayEnabled: true });
    const expiring = seedActiveCard(user.id, { expMonth: 10, expYear: 2026 });
    const expired = seedActiveCard(user.id, { ctoken: "CT-old", expMonth: 9, expYear: 2026, isDefault: false });

    const now = new Date("2026-10-08T06:00:00Z");
    const first = await runAutoCharge(now);
    const second = await runAutoCharge(new Date("2026-10-09T06:00:00Z"));

    expect(first).toMatchObject({ expiryNotices: 1, expiredCards: 1 });
    expect(second).toMatchObject({ expiryNotices: 0, expiredCards: 0 });
    const notices = spies.sendNotification.mock.calls.map(([input]) => input).filter((input) => input.template === "billing.card-expiring");
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({
      userId: user.id,
      dedupeKey: `card.expiring:${expiring.id}`,
      data: { card: "Mastercard •••• 2544", autoPay: true },
    });
    expect(fake.current.rows("savedCard").find((row) => row.id === expired.id)?.status).toBe("EXPIRED");
  });

  it("does not notify for cards far from expiry", async () => {
    const user = seedUser();
    seedActiveCard(user.id, { expMonth: 12, expYear: 2026 });
    const summary = await runAutoCharge(new Date("2026-10-08T06:00:00Z"));
    expect(summary.expiryNotices).toBe(0);
  });
});
