import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import {
  buildPaytrCapiDeleteToken,
  buildPaytrCapiListToken,
  buildPaytrDirectToken,
  buildPaytrStoredChargeRequest,
  parsePaytrCardDeleteResponse,
  parsePaytrCardListResponse,
  parsePaytrStoredChargeResponse,
} from "./paytr-card-storage";

const credentials = { merchantId: "123456", merchantKey: "KEY", merchantSalt: "SALT" };
const hmac = (message: string) => createHmac("sha256", "KEY").update(message).digest("base64");

describe("PayTR Kart Saklama hashes (dev.paytr.com/direkt-api/kart-saklama-api)", () => {
  it("signs Direct API payments in the documented field order", () => {
    expect(
      buildPaytrDirectToken(credentials, {
        userIp: "203.0.113.7",
        merchantOid: "KA1",
        email: "a@b.c",
        paymentAmount: "120.00",
        paymentType: "card",
        installmentCount: "0",
        currency: "TL",
        testMode: "0",
        non3d: "1",
      })
    ).toBe(hmac("123456203.0.113.7KA1a@b.c120.00card0TL01SALT"));
  });

  it("signs CAPI LIST (utoken+salt) and CAPI DELETE (ctoken+utoken+salt)", () => {
    expect(buildPaytrCapiListToken(credentials, "UT")).toBe(hmac("UTSALT"));
    expect(buildPaytrCapiDeleteToken(credentials, "CT", "UT")).toBe(hmac("CTUTSALT"));
  });
});

describe("PayTR responses", () => {
  it("maps a card list to masked display data", () => {
    const result = parsePaytrCardListResponse(
      JSON.stringify([
        { ctoken: "c1", last_4: "2544", month: "06", year: "29", c_bank: "Kuveyt Türk", schema: "MASTERCARD", c_brand: "saglamkart", require_cvv: "0" },
        { ctoken: "c2", last_4: "4242", month: "1", year: "2031", initial: "4", schema: "OTHER", require_cvv: "1" },
      ])
    );
    expect(result).toEqual({
      ok: true,
      value: [
        { ctoken: "c1", last4: "2544", requireCvv: false, expMonth: 6, expYear: 2029, bankName: "Kuveyt Türk", brand: "MASTERCARD", program: "saglamkart" },
        { ctoken: "c2", last4: "4242", requireCvv: true, expMonth: 1, expYear: 2031, bankName: null, brand: "VISA", program: null },
      ],
    });
    expect(parsePaytrCardListResponse("{}")).toEqual({ ok: true, value: [] });
    expect(parsePaytrCardListResponse('{"status":"error","err_msg":"utoken hatalı"}')).toMatchObject({ ok: false });
  });

  it("treats an already-deleted card as deleted", () => {
    expect(parsePaytrCardDeleteResponse('{"status":"success"}')).toEqual({ ok: true, value: { alreadyGone: false } });
    expect(parsePaytrCardDeleteResponse('{"status":"error","err_msg":"Kart bulunamadı"}')).toEqual({ ok: true, value: { alreadyGone: true } });
    expect(parsePaytrCardDeleteResponse('{"status":"error","err_msg":"Sistem hatası"}')).toMatchObject({ ok: false });
  });

  it("maps recurring payment answers; 'try again' and unreadable answers are never a decline", () => {
    expect(parsePaytrStoredChargeResponse('{"status":"success"}').outcome).toBe("success");
    expect(parsePaytrStoredChargeResponse('{"status":"wait_callback"}').outcome).toBe("pending");
    expect(parsePaytrStoredChargeResponse('{"status":"failed","msg":"Devam eden işlem","try_again":true}').outcome).toBe("pending");
    expect(parsePaytrStoredChargeResponse('{"status":"failed","msg":"Kart kapalı","try_again":false}')).toMatchObject({
      outcome: "failed",
      message: "Kart kapalı",
    });
    expect(parsePaytrStoredChargeResponse("<html>").outcome).toBe("unknown");
  });

  it("builds a non-3D recurring request with both tokens", () => {
    const body = buildPaytrStoredChargeRequest(credentials, {
      merchantOid: "KA1",
      amount: 99.5,
      description: "Fatura F-1",
      buyer: { email: "a@b.c", name: "Ayşe Yılmaz", address: "", phone: "", ip: "203.0.113.7" },
      utoken: "UT",
      ctoken: "CT",
      okUrl: "https://x/ok",
      failUrl: "https://x/fail",
    });
    expect(Object.fromEntries(body)).toMatchObject({
      payment_amount: "99.50",
      non_3d: "1",
      recurring_payment: "1",
      utoken: "UT",
      ctoken: "CT",
      payment_type: "card",
      installment_count: "0",
    });
    expect(body.has("card_number")).toBe(false);
    expect(body.has("cvv")).toBe(false);
  });
});
