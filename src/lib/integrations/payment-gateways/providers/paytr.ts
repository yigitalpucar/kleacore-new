import { randomBytes } from "crypto";
import { getAppBaseUrl } from "@/lib/stripe";
import { toFixed2, toKurus, toNumber } from "@/lib/money";
import { buildPaytrRefundToken, buildPaytrToken } from "../paytr-hash";
import { persistGatewayCheckout } from "../persist";
import type { PaymentGatewayConfig } from "../config";
import type {
  CheckoutSessionInput,
  CheckoutSessionResult,
  GatewayRefundResult,
  PaymentGatewayProvider,
} from "../types";

const PAYTR_GET_TOKEN_URL = "https://www.paytr.com/odeme/api/get-token";

interface PaytrTokenResponse {
  status: string;
  token?: string;
  reason?: string;
}

function createMerchantOid() {
  return `KL${Date.now()}${randomBytes(4).toString("hex")}`.slice(0, 64);
}

function buildUserBasket(description: string, amount: number) {
  const basket = [[description.slice(0, 120), toFixed2(amount), 1]];
  return Buffer.from(JSON.stringify(basket), "utf8").toString("base64");
}

export function createPaytrPaymentGatewayProvider(
  config: PaymentGatewayConfig
): PaymentGatewayProvider {
  return {
    name: "paytr",
    async createCheckout(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
      if (input.invoiceIds.length === 0) {
        throw new Error("INVOICE_IDS_REQUIRED");
      }

      const normalizedAmount = toNumber(input.totalAmount);
      const paymentAmount = toKurus(normalizedAmount);
      const merchantOid = createMerchantOid();
      const userIp = input.customer.ip?.trim() || "127.0.0.1";
      const userBasket = buildUserBasket(input.description, normalizedAmount);
      const noInstallment = "0";
      const maxInstallment = "0";
      const currency = "TL";
      const testMode = process.env.PAYTR_TEST_MODE === "1" ? "1" : "0";

      const paytrToken = buildPaytrToken(
        config.paytr.merchantId,
        userIp,
        merchantOid,
        input.customer.email,
        paymentAmount,
        userBasket,
        noInstallment,
        maxInstallment,
        currency,
        testMode,
        config.paytr.merchantSalt,
        config.paytr.merchantKey
      );

      const form = new URLSearchParams({
        merchant_id: config.paytr.merchantId,
        user_ip: userIp,
        merchant_oid: merchantOid,
        email: input.customer.email,
        payment_amount: String(paymentAmount),
        paytr_token: paytrToken,
        user_basket: userBasket,
        debug_on: "1",
        no_installment: noInstallment,
        max_installment: maxInstallment,
        user_name: `${input.customer.name} ${input.customer.surname}`.trim().slice(0, 60),
        user_address: (input.customer.address || "Türkiye").slice(0, 400),
        user_phone: (input.customer.phone || "05555555555").slice(0, 20),
        merchant_ok_url: input.successUrl,
        merchant_fail_url: input.cancelUrl,
        timeout_limit: "30",
        currency,
        test_mode: testMode,
        lang: "tr",
      });

      const response = await fetch(PAYTR_GET_TOKEN_URL, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      });

      const text = await response.text();
      const result = text ? (JSON.parse(text) as PaytrTokenResponse) : { status: "failed" };

      if (!response.ok || result.status !== "success" || !result.token) {
        throw new Error(result.reason || "PAYTR_TOKEN_REQUEST_FAILED");
      }

      await persistGatewayCheckout({
        invoiceIds: input.invoiceIds,
        gatewaySessionId: merchantOid,
        provider: "paytr",
        customerId: input.customerId,
        context: input.context,
        notesPrefix: "PayTR iframe ödemesi",
      });

      return {
        paytrToken: result.token,
        gatewaySessionId: merchantOid,
        amount: normalizedAmount,
        provider: "paytr",
      };
    },
    async healthCheck() {
      if (!config.paytr.merchantId || !config.paytr.merchantKey || !config.paytr.merchantSalt) {
        return {
          ok: false,
          provider: "paytr",
          error: "PAYTR_NOT_CONFIGURED",
        };
      }

      return {
        ok: true,
        provider: "paytr",
        data: {
          status: "ok",
          callbackUrl: `${getAppBaseUrl()}/api/payments/paytr/callback`,
        },
      };
    },
  };
}
export const PAYTR_REFUND_URL = "https://www.paytr.com/odeme/iade";

/** Form body of PayTR's refund API. `return_amount` is TL with a dot ("12.50"). */
export function buildPaytrRefundRequest(
  config: Pick<PaymentGatewayConfig["paytr"], "merchantId" | "merchantKey" | "merchantSalt">,
  input: { merchantOid: string; amount: number | string; referenceNo: string }
) {
  const returnAmount = toFixed2(input.amount);
  return new URLSearchParams({
    merchant_id: config.merchantId,
    merchant_oid: input.merchantOid,
    return_amount: returnAmount,
    paytr_token: buildPaytrRefundToken(
      config.merchantId,
      input.merchantOid,
      returnAmount,
      config.merchantSalt,
      config.merchantKey
    ),
    // Alphanumeric, ≤64 chars; lets PayTR's panel show which refund this was.
    reference_no: input.referenceNo.replace(/[^A-Za-z0-9]/g, "").slice(0, 64),
  });
}

interface PaytrRefundResponse {
  status?: string;
  is_test?: string | number;
  merchant_oid?: string;
  return_amount?: string;
  reference_no?: string;
  err_no?: string;
  err_msg?: string;
}

export function parsePaytrRefundResponse(text: string): GatewayRefundResult {
  let payload: PaytrRefundResponse;
  try {
    payload = JSON.parse(text) as PaytrRefundResponse;
  } catch {
    return { ok: false, uncertain: true, message: "PayTR yanıtı okunamadı." };
  }
  if (payload.status === "success") {
    return {
      ok: true,
      gatewayRef: payload.reference_no ?? payload.merchant_oid,
      message: "PayTR iadeyi onayladı.",
      data: { ...payload },
    };
  }
  return {
    ok: false,
    message: `PayTR iadeyi reddetti: ${payload.err_msg ?? payload.err_no ?? "bilinmeyen hata"}`,
    data: { ...payload },
  };
}

export async function refundPaytrPayment(
  config: PaymentGatewayConfig,
  input: { merchantOid: string; amount: number | string; referenceNo: string }
): Promise<GatewayRefundResult> {
  const body = buildPaytrRefundRequest(config.paytr, input);
  let text: string;
  try {
    const response = await fetch(PAYTR_REFUND_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    text = await response.text();
    if (!response.ok) {
      return { ok: false, uncertain: response.status >= 500, message: `PayTR HTTP ${response.status}` };
    }
  } catch {
    return { ok: false, uncertain: true, message: "PayTR'ye ulaşılamadı; iade durumu PayTR panelinden kontrol edilmeli." };
  }
  return parsePaytrRefundResponse(text);
}
