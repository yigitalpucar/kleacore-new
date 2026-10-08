/**
 * Sends a refund for a card payment to the gateway that charged it.
 */
import type { Prisma } from "@prisma/client";
import { parseGatewayMeta } from "@/lib/integrations/payment-gateways/gateway-meta";
import type { PaymentGatewayConfig } from "@/lib/integrations/payment-gateways/config";
import type { CardGatewayId } from "@/lib/integrations/payment-gateways/methods-config";
import type { GatewayRefundResult } from "@/lib/integrations/payment-gateways/types";
import {
  cancelKuveytTurkPayment,
  refundKuveytTurkPayment,
} from "@/lib/integrations/payment-gateways/providers/kuveytturk";
import type { KuveytTurkGatewayData } from "@/lib/integrations/payment-gateways/providers/kuveytturk-flow";
import { refundPaytrPayment } from "@/lib/integrations/payment-gateways/providers/paytr";
import { refundIyzicoPayment } from "@/lib/integrations/payment-gateways/providers/iyzico";
import { refundStripePayment } from "@/lib/integrations/payment-gateways/providers/stripe";
import { toFixed2, toKurus, type MoneyInput } from "@/lib/money";
import { planKuveytTurkRefund } from "./refunds-math";

interface CardPaymentLike {
  transactionId: string | null;
  notes: string | null;
  gatewayData: Prisma.JsonValue | null;
}

const NOTE_PREFIXES: Array<[string, CardGatewayId]> = [
  ["Kuveyt Türk", "kuveytturk"],
  ["PayTR", "paytr"],
  ["iyzico", "iyzico"],
  ["Stripe", "stripe"],
];

/**
 * Which gateway charged a CREDIT_CARD payment. Fulfilment rewrites `notes` to
 * the gateway's label ("PayTR iframe ödemesi"), so that label, the stored
 * gateway meta and the reference format are all consulted.
 */
export function detectCardGateway(payment: CardPaymentLike): CardGatewayId | null {
  const data = payment.gatewayData as { provider?: string } | null;
  if (data?.provider === "kuveytturk") return "kuveytturk";

  const meta = parseGatewayMeta(payment.notes);
  if (meta && meta.provider !== "disabled") return meta.provider;

  const notes = payment.notes ?? "";
  for (const [prefix, id] of NOTE_PREFIXES) {
    if (notes.includes(prefix)) return id;
  }

  const ref = payment.transactionId ?? "";
  if (ref.startsWith("cs_")) return "stripe";
  if (/^KL\d{13}[0-9a-f]{8}$/.test(ref)) return "paytr";
  return null;
}

export interface GatewayRefundRequest {
  gateway: CardGatewayId;
  refundId: string;
  idempotencyKey: string;
  amount: MoneyInput;
  payment: CardPaymentLike & { paidAt: Date | null; createdAt: Date };
  /** Total charged in this gateway session (all invoices it paid). */
  sessionAmount: MoneyInput;
  /** Already refunded (or in flight) from this session, excluding this refund. */
  sessionRefunded: MoneyInput;
  now: Date;
}

export async function executeGatewayRefund(
  config: PaymentGatewayConfig,
  request: GatewayRefundRequest
): Promise<GatewayRefundResult> {
  const reference = request.payment.transactionId;
  if (!reference) {
    return { ok: false, message: "Ödemenin ağ geçidi referansı yok; manuel iade yapın." };
  }

  switch (request.gateway) {
    case "kuveytturk": {
      const data = request.payment.gatewayData as Partial<KuveytTurkGatewayData> | null;
      if (
        data?.stage !== "PROVISIONED" ||
        !data.orderId ||
        !data.rrn ||
        !data.stan ||
        !data.provisionNumber
      ) {
        return { ok: false, message: "Kuveyt Türk provizyon bilgileri eksik; iade banka panelinden yapılmalı." };
      }
      const plan = planKuveytTurkRefund({
        paidAt: request.payment.paidAt ?? request.payment.createdAt,
        now: request.now,
        refundAmount: request.amount,
        sessionAmountKurus: data.amountKurus ?? toKurus(request.sessionAmount),
        sessionRefundedKurus: toKurus(request.sessionRefunded),
      });
      if (!plan.ok) return { ok: false, message: plan.error };

      const bankReference = {
        merchantOrderId: data.merchantOrderId ?? reference,
        orderId: data.orderId,
        rrn: data.rrn,
        stan: data.stan,
        provisionNumber: data.provisionNumber,
        amountKurus: plan.amountKurus,
      };
      const response =
        plan.operation === "SaleReversal"
          ? await cancelKuveytTurkPayment(config, bankReference)
          : await refundKuveytTurkPayment(config, bankReference, {
              partial: plan.operation === "PartialDrawback",
            });
      // Transport failures come back as KUVEYTTURK_TIMEOUT / _NETWORK_ERROR / _HTTP_5xx.
      const uncertain = !response.ok && /^KUVEYTTURK_(TIMEOUT|NETWORK_ERROR|HTTP_5)/.test(response.responseCode);
      return {
        ok: response.ok,
        uncertain,
        operation: plan.operation,
        gatewayRef: response.rrn ?? response.orderId,
        message: response.ok
          ? "Kuveyt Türk işlemi onayladı."
          : `Kuveyt Türk: ${response.message} (${response.responseCode})`,
        data: {
          responseCode: response.responseCode,
          orderId: response.orderId,
          rrn: response.rrn,
          stan: response.stan,
          provisionNumber: response.provisionNumber,
        },
      };
    }
    case "paytr": {
      const result = await refundPaytrPayment(config, {
        merchantOid: reference,
        amount: toFixed2(request.amount),
        referenceNo: request.refundId,
      });
      return { ...result, operation: "iade" };
    }
    case "iyzico":
      return refundIyzicoPayment(config.iyzico, {
        token: reference,
        amount: toFixed2(request.amount),
        conversationId: request.refundId,
      });
    case "stripe":
      return refundStripePayment({
        sessionId: reference,
        amountKurus: toKurus(request.amount),
        idempotencyKey: request.idempotencyKey,
      });
  }
}
