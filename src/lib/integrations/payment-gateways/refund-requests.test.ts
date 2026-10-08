import { createHmac } from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import {
  PAYTR_REFUND_URL,
  buildPaytrRefundRequest,
  parsePaytrRefundResponse,
  refundPaytrPayment,
} from "./providers/paytr";
import { IYZICO_REFUND_PATH, buildIyzicoRefundRequest, refundIyzicoPayment } from "./providers/iyzico";
import type { PaymentGatewayConfig } from "./config";

const paytr = { merchantId: "123456", merchantKey: "merchant-key", merchantSalt: "merchant-salt" };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PayTR refund (iade) request", () => {
  it("signs merchant_id + merchant_oid + return_amount + salt with the merchant key", () => {
    const body = buildPaytrRefundRequest(paytr, {
      merchantOid: "KL1728390000000a1b2c3d4",
      amount: 49.9,
      referenceNo: "cmrefund_01-x",
    });

    const expected = createHmac("sha256", "merchant-key")
      .update("123456KL1728390000000a1b2c3d449.90merchant-salt", "utf8")
      .digest("base64");

    expect(Object.fromEntries(body)).toEqual({
      merchant_id: "123456",
      merchant_oid: "KL1728390000000a1b2c3d4",
      return_amount: "49.90",
      paytr_token: expected,
      reference_no: "cmrefund01x",
    });
  });

  it("parses success and error answers", () => {
    expect(parsePaytrRefundResponse('{"status":"success","merchant_oid":"KL1","return_amount":"10.00"}')).toMatchObject({
      ok: true,
      gatewayRef: "KL1",
    });
    expect(parsePaytrRefundResponse('{"status":"error","err_no":"005","err_msg":"İade tutarı hatalı"}')).toMatchObject({
      ok: false,
      message: "PayTR iadeyi reddetti: İade tutarı hatalı",
    });
    expect(parsePaytrRefundResponse("<html>")).toMatchObject({ ok: false, uncertain: true });
  });

  it("posts the form to the refund endpoint and reports network errors as uncertain", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('{"status":"success","merchant_oid":"KL1"}'));
    vi.stubGlobal("fetch", fetchMock);
    const config = { paytr } as unknown as PaymentGatewayConfig;

    const ok = await refundPaytrPayment(config, { merchantOid: "KL1", amount: "10.00", referenceNo: "r1" });
    expect(ok.ok).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe(PAYTR_REFUND_URL);
    expect(String(fetchMock.mock.calls[0][1].body)).toContain("return_amount=10.00");

    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    const lost = await refundPaytrPayment(config, { merchantOid: "KL1", amount: "10.00", referenceNo: "r1" });
    expect(lost).toMatchObject({ ok: false, uncertain: true });
  });
});

describe("iyzico refund request", () => {
  it("builds the per-item refund body with a TRY price string", () => {
    expect(
      buildIyzicoRefundRequest({ paymentTransactionId: "1234", amount: 12.5, conversationId: "ref-1" })
    ).toEqual({
      locale: "tr",
      conversationId: "ref-1",
      paymentTransactionId: "1234",
      price: "12.50",
      currency: "TRY",
      ip: "127.0.0.1",
    });
  });

  it("reads the item transaction from the checkout token, then refunds it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          status: "success",
          paymentId: "999",
          itemTransactions: [{ itemId: "inv-1", paymentTransactionId: "555" }],
        })
      )
      .mockResolvedValueOnce(Response.json({ status: "success", paymentId: "999", paymentTransactionId: "555", price: 20 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await refundIyzicoPayment(
      { enabled: true, apiKey: "k", secretKey: "s", testMode: true },
      { token: "tok-1", amount: "20.00", conversationId: "ref-2" }
    );

    expect(result).toMatchObject({ ok: true, gatewayRef: "555" });
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(`https://sandbox-api.iyzipay.com${IYZICO_REFUND_PATH}`);
    expect(JSON.parse(init.body)).toMatchObject({ paymentTransactionId: "555", price: "20.00", currency: "TRY" });
    expect(init.headers.authorization).toMatch(/^IYZWSv2 /);
  });

  it("does not refund when the checkout cannot be found", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ status: "failure", errorMessage: "Token bulunamadı" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await refundIyzicoPayment(
      { enabled: true, apiKey: "k", secretKey: "s", testMode: true },
      { token: "tok-x", amount: "20.00", conversationId: "ref-3" }
    );

    expect(result.ok).toBe(false);
    expect(result.uncertain).toBeFalsy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
