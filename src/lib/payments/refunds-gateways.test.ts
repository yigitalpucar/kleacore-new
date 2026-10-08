import { describe, expect, it, vi } from "vitest";

const kt = vi.hoisted(() => ({
  cancelKuveytTurkPayment: vi.fn(),
  refundKuveytTurkPayment: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/integrations/payment-gateways/providers/kuveytturk", () => kt);

import { detectCardGateway, executeGatewayRefund } from "./refunds-gateways";
import type { PaymentGatewayConfig } from "@/lib/integrations/payment-gateways/config";

const provisioned = {
  provider: "kuveytturk",
  stage: "PROVISIONED",
  merchantOrderId: "KT-1",
  orderId: "123",
  rrn: "rrn",
  stan: "stan",
  provisionNumber: "prov",
  amountKurus: 12000,
};

function ktRequest(overrides: Partial<Parameters<typeof executeGatewayRefund>[1]> = {}) {
  return {
    gateway: "kuveytturk" as const,
    refundId: "ref-1",
    idempotencyKey: "k",
    amount: "120.00",
    payment: {
      transactionId: "KT-1",
      notes: null,
      gatewayData: provisioned,
      paidAt: new Date("2026-10-08T08:00:00Z"),
      createdAt: new Date("2026-10-08T07:59:00Z"),
    },
    sessionAmount: "120.00",
    sessionRefunded: 0,
    now: new Date("2026-10-08T12:00:00Z"),
    ...overrides,
  };
}

describe("executeGatewayRefund — Kuveyt Türk", () => {
  const config = {} as PaymentGatewayConfig;

  it("same day full amount → SaleReversal with the provision references", async () => {
    kt.cancelKuveytTurkPayment.mockResolvedValue({ ok: true, responseCode: "00", message: "OK", rrn: "rrn2" });
    const result = await executeGatewayRefund(config, ktRequest());
    expect(result).toMatchObject({ ok: true, operation: "SaleReversal", gatewayRef: "rrn2" });
    expect(kt.cancelKuveytTurkPayment).toHaveBeenCalledWith(config, {
      merchantOrderId: "KT-1",
      orderId: "123",
      rrn: "rrn",
      stan: "stan",
      provisionNumber: "prov",
      amountKurus: 12000,
    });
  });

  it("next day partial → PartialDrawback; transport errors are uncertain", async () => {
    kt.refundKuveytTurkPayment.mockResolvedValue({ ok: false, responseCode: "KUVEYTTURK_TIMEOUT", message: "x" });
    const result = await executeGatewayRefund(
      config,
      ktRequest({ amount: "20.00", now: new Date("2026-10-09T12:00:00Z") })
    );
    expect(kt.refundKuveytTurkPayment.mock.calls[0][2]).toEqual({ partial: true });
    expect(result).toMatchObject({ ok: false, uncertain: true, operation: "PartialDrawback" });
  });

  it("same day partial is refused before calling the bank", async () => {
    kt.cancelKuveytTurkPayment.mockClear();
    const result = await executeGatewayRefund(config, ktRequest({ amount: "20.00" }));
    expect(result.ok).toBe(false);
    expect(kt.cancelKuveytTurkPayment).not.toHaveBeenCalled();
  });

  it("refuses without provision data", async () => {
    const result = await executeGatewayRefund(
      config,
      ktRequest({ payment: { ...ktRequest().payment, gatewayData: { provider: "kuveytturk", stage: "FAILED" } } })
    );
    expect(result).toMatchObject({ ok: false });
  });
});

describe("detectCardGateway", () => {
  it("reads Kuveyt Türk from gatewayData", () => {
    expect(
      detectCardGateway({ transactionId: "KT1", notes: "Ödeme tamamlandı", gatewayData: { provider: "kuveytturk" } })
    ).toBe("kuveytturk");
  });

  it("reads the gateway meta of pending rows and the label fulfilment writes", () => {
    expect(
      detectCardGateway({
        transactionId: "tok",
        notes: 'iyzico gateway_meta:{"invoiceIds":["i"],"customerId":"c","context":"cart","provider":"iyzico"}',
        gatewayData: null,
      })
    ).toBe("iyzico");
    expect(detectCardGateway({ transactionId: "x", notes: "PayTR iframe ödemesi", gatewayData: null })).toBe("paytr");
    expect(detectCardGateway({ transactionId: "x", notes: "Stripe Checkout ödemesi", gatewayData: null })).toBe("stripe");
  });

  it("falls back to the reference format", () => {
    expect(detectCardGateway({ transactionId: "cs_test_123", notes: null, gatewayData: null })).toBe("stripe");
    expect(detectCardGateway({ transactionId: "KL1728390000000a1b2c3d4", notes: null, gatewayData: null })).toBe("paytr");
    expect(detectCardGateway({ transactionId: "admin", notes: "Admin ödeme onayı", gatewayData: null })).toBeNull();
  });
});
