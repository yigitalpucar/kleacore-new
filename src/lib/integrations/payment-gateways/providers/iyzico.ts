import { getAppBaseUrl } from "@/lib/stripe";
import { roundMoney } from "@/lib/payments/orchestrator";
import { buildIyzicoAuthorization, createIyzicoRandomKey } from "../iyzico-auth";
import { persistGatewayCheckout } from "../persist";
import type { PaymentGatewayConfig } from "../config";
import type { CheckoutSessionInput, CheckoutSessionResult, PaymentGatewayProvider } from "../types";

const IYZICO_INIT_PATH = "/payment/iyzipos/checkoutform/initialize/auth/ecom";
const IYZICO_RETRIEVE_PATH = "/payment/iyzipos/checkoutform/auth/ecom/detail";

interface IyzicoInitializeResponse {
  status: string;
  token?: string;
  checkoutFormContent?: string;
  paymentPageUrl?: string;
  conversationId?: string;
  errorMessage?: string;
}

interface IyzicoRetrieveResponse {
  status: string;
  paymentStatus?: string;
  paymentId?: string;
  conversationId?: string;
  errorMessage?: string;
}

function getIyzicoBaseUrl(testMode: boolean) {
  return testMode ? "https://sandbox-api.iyzipay.com" : "https://api.iyzipay.com";
}

function formatIyzicoAmount(amount: number) {
  return roundMoney(amount).toFixed(2);
}

function resolveCheckoutHtml(content?: string) {
  if (!content) return undefined;
  if (content.trim().startsWith("<")) return content;

  try {
    const decoded = Buffer.from(content, "base64").toString("utf8");
    if (decoded.trim().startsWith("<")) {
      return decoded;
    }
  } catch {
    // fall through
  }

  return content;
}

function buildBuyer(input: CheckoutSessionInput) {
  const customer = input.customer;
  const contactName = `${customer.name} ${customer.surname}`.trim() || "Müşteri";
  const address = customer.address?.trim() || "Türkiye";
  const city = customer.city?.trim() || "İstanbul";
  const country = customer.country?.trim() || "Türkiye";

  return {
    buyer: {
      id: customer.id,
      name: customer.name || "Müşteri",
      surname: customer.surname || "Kullanıcı",
      gsmNumber: customer.phone?.trim() || "+905555555555",
      email: customer.email,
      identityNumber: customer.identityNumber?.trim() || "11111111111",
      registrationAddress: address,
      ip: customer.ip?.trim() || "127.0.0.1",
      city,
      country,
      zipCode: "34000",
    },
    shippingAddress: {
      contactName,
      city,
      country,
      address,
      zipCode: "34000",
    },
    billingAddress: {
      contactName,
      city,
      country,
      address,
      zipCode: "34000",
    },
  };
}

async function postIyzico<T>(
  config: PaymentGatewayConfig["iyzico"],
  uriPath: string,
  body: Record<string, unknown>
): Promise<T> {
  const requestBody = JSON.stringify(body);
  const randomKey = createIyzicoRandomKey();
  const { authorization } = buildIyzicoAuthorization(
    config.apiKey,
    config.secretKey,
    uriPath,
    requestBody,
    randomKey
  );

  const response = await fetch(`${getIyzicoBaseUrl(config.testMode)}${uriPath}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization,
      "x-iyzi-rnd": randomKey,
    },
    body: requestBody,
  });

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as T) : ({} as T);

  if (!response.ok) {
    throw new Error(`IYZICO_HTTP_${response.status}`);
  }

  return payload;
}

export function createIyzicoPaymentGatewayProvider(
  config: PaymentGatewayConfig
): PaymentGatewayProvider {
  return {
    name: "iyzico",
    async createCheckout(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
      if (input.invoiceIds.length === 0) {
        throw new Error("INVOICE_IDS_REQUIRED");
      }

      const normalizedAmount = roundMoney(input.totalAmount);
      const amountText = formatIyzicoAmount(normalizedAmount);
      const conversationId = `kleacore-${input.invoiceIds[0]}-${Date.now()}`;
      const callbackUrl = `${getAppBaseUrl()}/api/payments/iyzico/callback`;
      const addressFields = buildBuyer(input);

      const body = {
        locale: "tr",
        conversationId,
        price: amountText,
        paidPrice: amountText,
        currency: "TRY",
        basketId: input.invoiceIds.join("-"),
        paymentGroup: "PRODUCT",
        callbackUrl,
        enabledInstallments: [1, 2, 3, 6, 9, 12],
        ...addressFields,
        basketItems: [
          {
            id: input.invoiceIds[0],
            name: input.description,
            category1: "Hizmet",
            itemType: "VIRTUAL",
            price: amountText,
          },
        ],
      };

      const result = await postIyzico<IyzicoInitializeResponse>(
        config.iyzico,
        IYZICO_INIT_PATH,
        body
      );

      if (result.status !== "success" || !result.token) {
        throw new Error(result.errorMessage || "IYZICO_CHECKOUT_INIT_FAILED");
      }

      await persistGatewayCheckout({
        invoiceIds: input.invoiceIds,
        gatewaySessionId: result.token,
        provider: "iyzico",
        customerId: input.customerId,
        context: input.context,
        notesPrefix: "iyzico Checkout ödemesi",
      });

      const checkoutHtml = resolveCheckoutHtml(result.checkoutFormContent);

      return {
        checkoutHtml,
        checkoutUrl: result.paymentPageUrl,
        gatewaySessionId: result.token,
        amount: normalizedAmount,
        provider: "iyzico",
      };
    },
    async healthCheck() {
      try {
        const result = await postIyzico<{ status: string }>(config.iyzico, "/payment/test", {
          locale: "tr",
        });
        if (result.status === "success") {
          return { ok: true, provider: "iyzico", data: { status: "ok" } };
        }
        return { ok: false, provider: "iyzico", error: "IYZICO_HEALTH_CHECK_FAILED" };
      } catch (error) {
        return {
          ok: false,
          provider: "iyzico",
          error: error instanceof Error ? error.message : "IYZICO_HEALTH_CHECK_FAILED",
        };
      }
    },
  };
}

export async function retrieveIyzicoCheckoutResult(
  config: PaymentGatewayConfig["iyzico"],
  token: string,
  conversationId?: string
) {
  return postIyzico<IyzicoRetrieveResponse>(config, IYZICO_RETRIEVE_PATH, {
    locale: "tr",
    conversationId: conversationId ?? `retrieve-${token}`,
    token,
  });
}