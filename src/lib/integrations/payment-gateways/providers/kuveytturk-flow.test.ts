import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    payment: { findMany: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
  },
  getPaymentGatewayConfig: vi.fn(),
  provision: vi.fn(),
  start3d: vi.fn(),
  fulfill: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("../config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../config")>()),
  getPaymentGatewayConfig: mocks.getPaymentGatewayConfig,
}));
vi.mock("./kuveytturk", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./kuveytturk")>()),
  provisionKuveytTurkPayment: mocks.provision,
  startKuveytTurkThreeDSecure: mocks.start3d,
}));
vi.mock("@/lib/payments/gateway-fulfillment", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/payments/gateway-fulfillment")>()),
  fulfillGatewayReference: mocks.fulfill,
}));

import { buildGatewayNotes } from "../gateway-meta";
import { buildAuthenticationResponseHash } from "./kuveytturk-protocol";
import {
  beginKuveytTurkPayment,
  buildKuveytTurkRedirectPath,
  handleKuveytTurkCallback,
} from "./kuveytturk-flow";

const REF = "KCTESTREF000000001";
const PASSWORD = "api123";

function config() {
  return {
    provider: "kuveytturk",
    iyzico: { enabled: false, apiKey: "", secretKey: "", testMode: true },
    paytr: { enabled: false, merchantId: "", merchantKey: "", merchantSalt: "" },
    kuveytturk: {
      enabled: true,
      merchantId: "496",
      customerId: "400235",
      username: "apitest",
      password: PASSWORD,
      testMode: true,
    },
  };
}

function paymentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "pay-1",
    invoiceId: "inv-1",
    customerId: "cus-1",
    amount: 120.5,
    status: "PENDING",
    gatewayData: null,
    notes: buildGatewayNotes("Kuveyt Türk 3D ödemesi", {
      invoiceIds: ["inv-1"],
      customerId: "cus-1",
      context: "panel_invoice",
      provider: "kuveytturk",
    }),
    invoice: { invoiceNumber: "KC-2026-0001", status: "PENDING" },
    ...overrides,
  };
}

function authResponse(options: {
  responseCode?: string;
  amountKurus?: number;
  hash?: string;
  md?: string | null;
  message?: string;
} = {}) {
  const responseCode = options.responseCode ?? "00";
  const orderId = "778899";
  const hashData =
    options.hash ??
    buildAuthenticationResponseHash(PASSWORD, { merchantOrderId: REF, responseCode, orderId });
  const xml =
    `<?xml version="1.0"?><VPosTransaction><VPosMessage><OrderId>${orderId}</OrderId><Amount>${options.amountKurus ?? 12050}</Amount>` +
    `<MerchantOrderId>${REF}</MerchantOrderId><CurrencyCode>0949</CurrencyCode><InstallmentCount>0</InstallmentCount></VPosMessage>` +
    `<ResponseCode>${responseCode}</ResponseCode><ResponseMessage>${options.message ?? "Kart doğrulandı."}</ResponseMessage>` +
    `<OrderId>${orderId}</OrderId><MerchantOrderId>${REF}</MerchantOrderId>` +
    (responseCode === "00" ? `<HashData>${hashData}</HashData>` : "") +
    (options.md === null ? "" : `<MD>${options.md ?? "MD-VALUE"}</MD>`) +
    `</VPosTransaction>`;
  // As posted by the bank: URL-encoded XML inside the form field.
  return encodeURIComponent(xml);
}

const approvedProvision = {
  responseCode: "00",
  responseMessage: "OTORİZASYON VERİLDİ",
  merchantOrderId: REF,
  orderId: "778899",
  provisionNumber: "241839",
  rrn: "318923298433",
  stan: "298433",
  amountKurus: 12050,
  currencyCode: "0949",
  cardLast4: "2544",
};

describe("handleKuveytTurkCallback", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.getPaymentGatewayConfig.mockResolvedValue(config());
    mocks.db.payment.findMany.mockResolvedValue([paymentRow()]);
    mocks.db.payment.updateMany.mockResolvedValue({ count: 1 });
    mocks.provision.mockResolvedValue(approvedProvision);
    mocks.fulfill.mockResolvedValue({
      fulfilled: true,
      skipped: false,
      amountMismatch: false,
      invoiceIds: ["inv-1"],
    });
  });

  it("good hash: claims, provisions with the MD, stores bank refs and fulfils once", async () => {
    const result = await handleKuveytTurkCallback(authResponse());

    expect(result).toEqual({
      outcome: "success",
      reason: "FULFILLED",
      redirectPath: "/musteri/panel/faturalar/inv-1?payment=success",
    });
    // Claim is conditional on PENDING + no gatewayData (single provisioning).
    expect(mocks.db.payment.updateMany.mock.calls[0][0].where).toMatchObject({
      transactionId: REF,
      status: "PENDING",
    });
    expect(mocks.provision).toHaveBeenCalledWith(expect.anything(), {
      merchantOrderId: REF,
      amountKurus: 12050,
      md: "MD-VALUE",
    });
    const stored = mocks.db.payment.updateMany.mock.calls[1][0].data.gatewayData;
    expect(stored).toMatchObject({
      provider: "kuveytturk",
      stage: "PROVISIONED",
      orderId: "778899",
      provisionNumber: "241839",
      rrn: "318923298433",
      stan: "298433",
      cardLast4: "2544",
    });
    expect(JSON.stringify(stored)).not.toMatch(/5188961939192544|MD-VALUE/);
    expect(mocks.fulfill).toHaveBeenCalledTimes(1);
    expect(mocks.fulfill).toHaveBeenCalledWith(REF, "Kuveyt Türk 3D ödemesi", {
      requestedAmount: 120.5,
      currency: "TRY",
    });
  });

  it("bad hash: changes nothing and never provisions", async () => {
    const result = await handleKuveytTurkCallback(authResponse({ hash: "Zm9yZ2VkLWhhc2g=" }));

    expect(result.outcome).toBe("failed");
    expect(result.reason).toBe("BAD_HASH");
    expect(mocks.db.payment.updateMany).not.toHaveBeenCalled();
    expect(mocks.provision).not.toHaveBeenCalled();
    expect(mocks.fulfill).not.toHaveBeenCalled();
  });

  it("amount mismatch: closes the attempt without charging", async () => {
    const result = await handleKuveytTurkCallback(authResponse({ amountKurus: 100 }));

    expect(result.reason).toBe("AMOUNT_MISMATCH");
    expect(mocks.provision).not.toHaveBeenCalled();
    expect(mocks.fulfill).not.toHaveBeenCalled();
    expect(mocks.db.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pay-1", status: "PENDING" },
        data: expect.objectContaining({ status: "FAILED" }),
      })
    );
  });

  it("duplicate callback after completion: no second provision or fulfilment", async () => {
    // On completion the notes (and their gateway meta) are rewritten; the
    // session is still recognised from gatewayData.
    mocks.db.payment.findMany.mockResolvedValue([
      paymentRow({
        status: "COMPLETED",
        notes: "Kuveyt Türk 3D ödemesi",
        gatewayData: { provider: "kuveytturk", stage: "PROVISIONED", context: "panel_invoice" },
      }),
    ]);

    const result = await handleKuveytTurkCallback(authResponse());

    expect(result).toEqual({
      outcome: "success",
      reason: "ALREADY_COMPLETED",
      redirectPath: "/musteri/panel/faturalar/inv-1?payment=success",
    });
    expect(mocks.provision).not.toHaveBeenCalled();
    expect(mocks.fulfill).not.toHaveBeenCalled();
    expect(mocks.db.payment.updateMany).not.toHaveBeenCalled();
  });

  it("concurrent duplicate: losing the claim skips provisioning", async () => {
    mocks.db.payment.updateMany.mockResolvedValueOnce({ count: 0 });

    const result = await handleKuveytTurkCallback(authResponse());

    expect(result).toMatchObject({ outcome: "review", reason: "ALREADY_CLAIMED" });
    expect(mocks.provision).not.toHaveBeenCalled();
    expect(mocks.fulfill).not.toHaveBeenCalled();
  });

  it("FailUrl: marks the attempt FAILED with the bank's Turkish message", async () => {
    const result = await handleKuveytTurkCallback(
      authResponse({ responseCode: "51", message: "Bakiye yetersiz." })
    );

    expect(result).toEqual({
      outcome: "failed",
      reason: "AUTH_51",
      redirectPath: "/musteri/panel/faturalar/inv-1?payment=failed",
    });
    const update = mocks.db.payment.updateMany.mock.calls[0][0];
    expect(update.data.status).toBe("FAILED");
    expect(update.data.notes).toContain("Kuveyt Türk: Bakiye yetersiz.");
    // Gateway meta survives so later lookups still find the context.
    expect(update.data.notes).toContain("gateway_meta:");
    expect(update.data.gatewayData).toMatchObject({ stage: "FAILED", errorCode: "51", errorMessage: "Bakiye yetersiz." });
    expect(mocks.provision).not.toHaveBeenCalled();
  });

  it("declined provision: FAILED with the bank message, no fulfilment", async () => {
    mocks.provision.mockResolvedValue({
      ...approvedProvision,
      responseCode: "05",
      responseMessage: "İşlem onaylanmadı.",
    });

    const result = await handleKuveytTurkCallback(authResponse());

    expect(result.reason).toBe("PROVISION_05");
    expect(mocks.fulfill).not.toHaveBeenCalled();
    const failed = mocks.db.payment.updateMany.mock.calls[1][0];
    expect(failed.data.status).toBe("FAILED");
    expect(failed.data.gatewayData).toMatchObject({ errorMessage: "İşlem onaylanmadı." });
  });

  it("provision network error: leaves the attempt for review, no fulfilment", async () => {
    mocks.provision.mockRejectedValue(new Error("KUVEYTTURK_TIMEOUT"));

    const result = await handleKuveytTurkCallback(authResponse());

    expect(result).toMatchObject({ outcome: "review", reason: "PROVISION_UNKNOWN" });
    expect(mocks.fulfill).not.toHaveBeenCalled();
    expect(mocks.db.payment.updateMany.mock.calls[1][0].data.gatewayData).toMatchObject({
      stage: "PROVISION_UNKNOWN",
    });
  });

  it("fulfilment error after a successful provision: review, refs kept, no rethrow", async () => {
    mocks.fulfill.mockRejectedValue(new Error("DOMAIN_REQUIRED"));

    const result = await handleKuveytTurkCallback(authResponse());

    expect(result).toMatchObject({ outcome: "review", reason: "FULFILLMENT_ERROR" });
    expect(mocks.db.payment.updateMany.mock.calls[1][0].data.gatewayData).toMatchObject({
      stage: "PROVISIONED",
      provisionNumber: "241839",
    });
  });

  it("unknown MerchantOrderId or garbage: generic failure, nothing touched", async () => {
    mocks.db.payment.findMany.mockResolvedValue([]);
    expect((await handleKuveytTurkCallback(authResponse())).reason).toBe("UNKNOWN_ORDER");
    expect((await handleKuveytTurkCallback("not-xml")).reason).toBe("INVALID_RESPONSE");
    expect(mocks.db.payment.updateMany).not.toHaveBeenCalled();
  });
});

describe("beginKuveytTurkPayment", () => {
  const card = {
    holderName: "Test Kart",
    number: "5188961939192544",
    expireMonth: "06",
    expireYear: "29",
    cvv: "588",
  };

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.getPaymentGatewayConfig.mockResolvedValue(config());
    mocks.db.payment.findMany.mockResolvedValue([paymentRow()]);
    mocks.db.user.findUnique.mockResolvedValue({ email: "a@b.com", phone: null, city: null, address: null });
    mocks.start3d.mockResolvedValue("<form id='x'></form>");
  });

  it("sends the session amount to the bank and returns its 3-D HTML", async () => {
    const result = await beginKuveytTurkPayment({
      merchantOrderId: REF,
      customerId: "cus-1",
      card,
      clientIp: "203.0.113.7",
    });

    expect(result).toEqual({ ok: true, html: "<form id='x'></form>" });
    expect(mocks.start3d).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        merchantOrderId: REF,
        amountKurus: 12050,
        okUrl: expect.stringMatching(/\/api\/payments\/kuveytturk\/callback$/),
        clientIp: "203.0.113.7",
      })
    );
  });

  it("refuses another customer's session and already-started attempts", async () => {
    expect(
      await beginKuveytTurkPayment({ merchantOrderId: REF, customerId: "other", card, clientIp: "1.1.1.1" })
    ).toEqual({ ok: false, reason: "not_found" });

    mocks.db.payment.findMany.mockResolvedValue([paymentRow({ gatewayData: { stage: "PROVISIONING" } })]);
    expect(
      await beginKuveytTurkPayment({ merchantOrderId: REF, customerId: "cus-1", card, clientIp: "1.1.1.1" })
    ).toEqual({ ok: false, reason: "not_payable" });
    expect(mocks.start3d).not.toHaveBeenCalled();
  });

  it("never logs card data when the bank call fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.start3d.mockRejectedValue(new Error("KUVEYTTURK_HTTP_500"));

    const result = await beginKuveytTurkPayment({
      merchantOrderId: REF,
      customerId: "cus-1",
      card,
      clientIp: "1.1.1.1",
    });

    expect(result).toEqual({ ok: false, reason: "bank_error" });
    const logged = errorSpy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(logged).toContain("KUVEYTTURK_HTTP_500");
    expect(logged).not.toMatch(/5188961939192544|588|Test Kart/);
  });
});

describe("buildKuveytTurkRedirectPath", () => {
  it("routes cart, invoice and renewal payments to their result pages", () => {
    expect(buildKuveytTurkRedirectPath("cart", REF, ["a", "b"], "success")).toBe(
      `/sepet/basarili?session_id=${REF}`
    );
    expect(buildKuveytTurkRedirectPath("cart", REF, ["a", "b"], "failed")).toBe(
      `/sepet/iptal?invoice_ids=a,b&ref=${REF}`
    );
    expect(buildKuveytTurkRedirectPath("panel_invoice", REF, ["a"], "review")).toBe(
      "/musteri/panel/faturalar/a?payment=review"
    );
    expect(buildKuveytTurkRedirectPath("panel_renewal", REF, ["a"], "failed")).toBe(
      "/musteri/panel/hizmetlerim?renewal=cancelled"
    );
  });
});
