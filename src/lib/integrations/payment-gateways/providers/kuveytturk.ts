import { getAppBaseUrl } from "@/lib/stripe";
import { roundMoney } from "@/lib/payments/orchestrator";
import { persistGatewayCheckout } from "../persist";
import type { PaymentGatewayConfig } from "../config";
import type { CheckoutSessionInput, CheckoutSessionResult, PaymentGatewayProvider } from "../types";
import {
  buildPaymentRequestXml,
  buildProvisionRequestXml,
  buildReversalSoapEnvelope,
  createMerchantOrderId,
  getKuveytTurkEndpoints,
  parseProvisionResponse,
  parseReversalResponse,
  type KuveytTurkCredentials,
  type PaymentRequestInput,
  type ProvisionResponse,
  type ReversalInput,
  type ReversalResponse,
} from "./kuveytturk-protocol";

const REQUEST_TIMEOUT_MS = 30_000;

export const KUVEYTTURK_NOTES_PREFIX = "Kuveyt Türk 3D ödemesi";

export function getKuveytTurkCredentials(config: PaymentGatewayConfig): KuveytTurkCredentials {
  return {
    merchantId: config.kuveytturk.merchantId,
    customerId: config.kuveytturk.customerId,
    username: config.kuveytturk.username,
    password: config.kuveytturk.password,
  };
}

export function getKuveytTurkCallbackUrl() {
  return `${getAppBaseUrl()}/api/payments/kuveytturk/callback`;
}

export function getKuveytTurkCardPageUrl(merchantOrderId: string) {
  return `${getAppBaseUrl()}/odeme/kuveytturk?ref=${encodeURIComponent(merchantOrderId)}`;
}

/**
 * POSTs to the bank. Errors carry only the HTTP status / error class so
 * nothing from the request body (card data) can reach a log or a message.
 */
async function postToBank(url: string, body: string, headers: Record<string, string>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`KUVEYTTURK_HTTP_${response.status}`);
    }
    return text;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("KUVEYTTURK_HTTP_")) throw error;
    throw new Error(
      error instanceof Error && error.name === "AbortError" ? "KUVEYTTURK_TIMEOUT" : "KUVEYTTURK_NETWORK_ERROR"
    );
  } finally {
    clearTimeout(timeout);
  }
}

const XML_HEADERS = { "content-type": "application/xml; charset=utf-8" };

/**
 * Step 1 — sends card data to ThreeDModelPayGate and returns the bank's
 * self-submitting HTML (3-D Secure redirect). The card lives only in this
 * call's memory.
 */
export async function startKuveytTurkThreeDSecure(
  config: PaymentGatewayConfig,
  input: PaymentRequestInput
): Promise<string> {
  const xml = buildPaymentRequestXml(getKuveytTurkCredentials(config), input);
  const html = await postToBank(getKuveytTurkEndpoints(config.kuveytturk.testMode).payGate, xml, XML_HEADERS);
  if (!/<form[\s>]/i.test(html)) {
    throw new Error("KUVEYTTURK_UNEXPECTED_3D_RESPONSE");
  }
  return html;
}

/** Step 3 — completes the sale with the MD from a successful 3-D authentication. */
export async function provisionKuveytTurkPayment(
  config: PaymentGatewayConfig,
  input: { merchantOrderId: string; amountKurus: number; md: string; clientIp?: string }
): Promise<ProvisionResponse> {
  const xml = buildProvisionRequestXml(getKuveytTurkCredentials(config), input);
  const text = await postToBank(
    getKuveytTurkEndpoints(config.kuveytturk.testMode).provisionGate,
    xml,
    XML_HEADERS
  );
  return parseProvisionResponse(text);
}

async function reverse(config: PaymentGatewayConfig, input: ReversalInput): Promise<ReversalResponse> {
  const { soapAction, body } = buildReversalSoapEnvelope(getKuveytTurkCredentials(config), input);
  let text: string;
  try {
    text = await postToBank(getKuveytTurkEndpoints(config.kuveytturk.testMode).soap, body, {
      "content-type": "text/xml; charset=utf-8",
      soapaction: soapAction,
    });
  } catch (error) {
    // WCF answers faults with HTTP 500 and a SOAP body; surface the code only.
    return {
      ok: false,
      responseCode: error instanceof Error ? error.message : "KUVEYTTURK_ERROR",
      message: "Banka iptal/iade isteğine yanıt vermedi.",
    };
  }
  return parseReversalResponse(text, input.operation);
}

type ReversalReference = Omit<ReversalInput, "operation">;

/** İptal: same-day (before end-of-day batch) full reversal of a sale. */
export function cancelKuveytTurkPayment(config: PaymentGatewayConfig, reference: ReversalReference) {
  return reverse(config, { ...reference, operation: "SaleReversal" });
}

/**
 * İade: after the batch is closed. Full amount → DrawBack, less →
 * PartialDrawback (amountKurus is then the refunded part).
 */
export function refundKuveytTurkPayment(
  config: PaymentGatewayConfig,
  reference: ReversalReference,
  options: { partial: boolean }
) {
  return reverse(config, {
    ...reference,
    operation: options.partial ? "PartialDrawback" : "DrawBack",
  });
}

export function createKuveytTurkPaymentGatewayProvider(
  config: PaymentGatewayConfig
): PaymentGatewayProvider {
  return {
    name: "kuveytturk",
    /**
     * Binds the invoices to a new MerchantOrderId and sends the customer to
     * our own card form; the bank is contacted only when the card is posted.
     */
    async createCheckout(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
      if (input.invoiceIds.length === 0) {
        throw new Error("INVOICE_IDS_REQUIRED");
      }
      if (!Number.isFinite(input.totalAmount) || input.totalAmount <= 0) {
        throw new Error("INVALID_PAYMENT_AMOUNT");
      }

      const merchantOrderId = createMerchantOrderId();

      await persistGatewayCheckout({
        invoiceIds: input.invoiceIds,
        gatewaySessionId: merchantOrderId,
        provider: "kuveytturk",
        customerId: input.customerId,
        context: input.context,
        notesPrefix: KUVEYTTURK_NOTES_PREFIX,
      });

      return {
        checkoutUrl: getKuveytTurkCardPageUrl(merchantOrderId),
        gatewaySessionId: merchantOrderId,
        amount: roundMoney(input.totalAmount),
        provider: "kuveytturk",
      };
    },
    async healthCheck() {
      const { merchantId, customerId, username, password, testMode } = config.kuveytturk;
      if (!merchantId || !customerId || !username || !password) {
        return { ok: false, provider: "kuveytturk", error: "KUVEYTTURK_NOT_CONFIGURED" };
      }
      return {
        ok: true,
        provider: "kuveytturk",
        data: {
          status: "ok",
          environment: testMode ? "test" : "production",
          callbackUrl: getKuveytTurkCallbackUrl(),
        },
      };
    },
  };
}
