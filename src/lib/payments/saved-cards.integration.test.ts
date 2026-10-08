/**
 * Saved card end-to-end against a real Postgres: "Kart ekle" consent →
 * PayTR store_card notification (through the real callback route, real hash)
 * → auto-pay on → daily job charges the stored card → invoice PAID through
 * the real fulfilment. PayTR itself is a contract fake (no public test
 * merchant exists; see docs/payments-saved-cards.md for the real-credential
 * checklist).
 *
 *   RUN_DB_TESTS=1 pnpm vitest run src/lib/payments/saved-cards.integration.test.ts
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => {
  process.env.PAYTR_MERCHANT_ID = "123456";
  process.env.PAYTR_MERCHANT_KEY = "itest-key";
  process.env.PAYTR_MERCHANT_SALT = "itest-salt";
  process.env.SAVED_CARDS_ENABLED = "true";
  return { UTOKEN: "UT-itest-user-token", CTOKEN: "CT-itest-card-token" };
});
const notifications = vi.hoisted(() => ({ send: vi.fn(async () => ({ ok: true, logIds: [], deduplicated: false })) }));

vi.mock("@/lib/notifications/send", () => ({ sendNotification: notifications.send }));
vi.mock("@/lib/stripe", () => ({ getAppBaseUrl: () => "http://localhost:3000" }));

import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { stopBoss } from "@/lib/jobs/boss";
import { netInvoiceLine } from "@/lib/billing/invoice-lines";
import { buildPaytrCallbackHash } from "@/lib/integrations/payment-gateways/paytr-hash";
import { POST as paytrCallback } from "@/app/api/payments/paytr/callback/route";
import { runAutoCharge } from "./auto-charge";
import { setAutoPay, startCardVerification } from "./saved-cards";

const enabled = process.env.RUN_DB_TESTS === "1";
const tag = `itest-cards-${randomUUID().slice(0, 8)}`;

const paytr = {
  cards: [] as Array<Record<string, string>>,
  charges: [] as URLSearchParams[],
  refunds: [] as URLSearchParams[],
};

function fakePaytrFetch(url: string | URL, init?: RequestInit) {
  const body = new URLSearchParams(String(init?.body ?? ""));
  const json = (value: unknown) => Promise.resolve(new Response(JSON.stringify(value), { status: 200 }));
  switch (String(url)) {
    case "https://www.paytr.com/odeme/capi/list":
      return json(body.get("utoken") === env.UTOKEN ? paytr.cards : []);
    case "https://www.paytr.com/odeme/iade":
      paytr.refunds.push(body);
      return json({ status: "success", merchant_oid: body.get("merchant_oid") });
    case "https://www.paytr.com/odeme":
      paytr.charges.push(body);
      return json(
        body.get("utoken") === env.UTOKEN && body.get("ctoken") === env.CTOKEN
          ? { status: "success" }
          : { status: "failed", msg: "Kart bulunamadı" }
      );
    default:
      return Promise.reject(new Error(`unexpected fetch ${String(url)}`));
  }
}

function notify(fields: Record<string, string>) {
  const hash = buildPaytrCallbackHash(fields.merchant_oid, "itest-salt", fields.status, fields.total_amount, "itest-key");
  return paytrCallback(
    new NextRequest("http://localhost:3000/api/payments/paytr/callback", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ ...fields, hash }).toString(),
    })
  );
}

let userId = "";
let invoiceId = "";

describe.runIf(enabled)("saved card → automatic collection (integration, real Postgres)", () => {
  beforeAll(async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(fakePaytrFetch));
    const user = await db.user.create({
      data: { email: `${tag}@test.local`, password: "x", name: "Kart", surname: "Test", emailVerifiedAt: new Date() },
    });
    userId = user.id;
    const invoice = await db.invoice.create({
      data: {
        invoiceNumber: `${tag}-F`,
        customerId: userId,
        subtotal: 100,
        taxRate: 20,
        taxAmount: 20,
        totalAmount: 120,
        dueDate: new Date(),
        items: { create: netInvoiceLine({ description: "Hosting yenileme", unitPrice: 100 }) },
      },
    });
    invoiceId = invoice.id;
  });

  afterAll(async () => {
    if (userId) {
      await db.paymentAttempt.deleteMany({ where: { userId } });
      await db.payment.deleteMany({ where: { customerId: userId } });
      await db.invoiceItem.deleteMany({ where: { invoiceId } });
      await db.eInvoiceRecord.deleteMany({ where: { invoiceId } });
      await db.invoice.deleteMany({ where: { customerId: userId } });
      await db.savedCard.deleteMany({ where: { userId } });
      await db.activityLog.deleteMany({ where: { userId } });
      await db.user.delete({ where: { id: userId } });
    }
    await stopBoss({ graceful: false });
  });

  it("stores a card, charges it on the due date and marks the invoice PAID", async () => {
    // 1. Customer consents, PayTR stores the card (3D 1 TL) and notifies us.
    const { ref } = await startCardVerification({ userId, consent: true, ip: "203.0.113.7" });
    paytr.cards = [
      { ctoken: env.CTOKEN, last_4: "2544", month: "06", year: "29", c_bank: "Kuveyt Türk", schema: "MASTERCARD", require_cvv: "0" },
    ];
    const verification = await notify({ merchant_oid: ref, status: "success", total_amount: "100", utoken: env.UTOKEN });
    expect(await verification.text()).toBe("OK");

    const card = await db.savedCard.findFirstOrThrow({ where: { userId } });
    expect(card).toMatchObject({ status: "ACTIVE", isDefault: true, last4: "2544", brand: "MASTERCARD" });
    expect(card.cardToken).toMatch(/^enc:v1:/);
    expect(card.cardToken).not.toContain(env.CTOKEN);
    expect(card.verificationRefundedAt).not.toBeNull();
    expect(paytr.refunds.map((refund) => refund.get("merchant_oid"))).toEqual([ref]);

    // 2. Auto-pay on (consent recorded), daily job runs twice.
    await setAutoPay({ userId, enabled: true, consent: true, ip: "203.0.113.7" });
    const first = await runAutoCharge(new Date());
    const second = await runAutoCharge(new Date());

    expect(first.charged).toBe(1);
    expect(second.charged).toBe(0);
    expect(paytr.charges).toHaveLength(1);
    expect(paytr.charges[0].get("payment_amount")).toBe("120.00");

    const invoice = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(invoice.status).toBe("PAID");
    expect(invoice.paidAmount.toFixed(2)).toBe("120.00");
    const [attempt] = await db.paymentAttempt.findMany({ where: { invoiceId } });
    expect(attempt).toMatchObject({ kind: "AUTO", status: "SUCCEEDED" });
    const payment = await db.payment.findFirstOrThrow({ where: { invoiceId, transactionId: attempt.gatewayRef } });
    expect(payment).toMatchObject({ status: "COMPLETED", method: "CREDIT_CARD" });

    // 3. PayTR's own notification for the same charge changes nothing.
    const late = await notify({ merchant_oid: attempt.gatewayRef, status: "success", total_amount: "12000", payment_amount: "12000" });
    expect(await late.text()).toBe("OK");
    expect(await db.payment.count({ where: { invoiceId, status: "COMPLETED" } })).toBe(1);
    expect((await db.invoice.findUniqueOrThrow({ where: { id: invoiceId } })).paidAmount.toFixed(2)).toBe("120.00");
  });
});
